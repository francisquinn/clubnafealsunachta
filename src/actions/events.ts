import { defineAction, ActionError } from 'astro:actions';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { sendMailchimpEmail } from '../lib/mailchimp';
import { requireAdmin, isClubInScope, scopeToAdminClubs, type AdminScope } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';
import { DEFAULT_CLUB_SLUG, DEFAULT_CLUB_TIMEZONE } from '../lib/clubDefaults';
import { localWallTimeToUtc } from '../lib/timezone';
import { upsertRsvp } from './rsvps';

type ResolvedVenue = { id: number; name: string; url: string | null; club_id: number };

// #37: throwing wrapper around the shared isClubInScope predicate, for the
// server-action call sites below (resolveVenue/resolveEventClubId/updateEvent).
function assertClubInScope(admin: AdminScope, club_id: number | null) {
  if (isClubInScope(admin, club_id)) return;
  throw new ActionError({ code: 'FORBIDDEN', message: 'You are not an admin of that club' });
}

// Resolves the venue for a non-online event: an existing venue is looked up
// by id as-is, a "New venue…" submission (name + club, no id yet) is
// upserted. Returns null when the event is online or no venue was picked.
// `club_id` comes back on the venue itself — a venue always belongs to
// exactly one club, so that's also the event's hosting club (see #36).
// Every path is checked against the caller's admin scope (#37) so a
// club-scoped admin can't attach an event to, or create a venue under, a
// club they don't administer.
async function resolveVenue(formData: FormData, is_online: boolean, admin: AdminScope): Promise<ResolvedVenue | null> {
  if (is_online) return null;

  const selected_venue_id = formData.get('venue_id')
    ? Number(formData.get('venue_id'))
    : null;
  if (selected_venue_id) {
    const { data: venue, error } = await supabaseAdmin!
      .from('venues')
      .select('id, name, url, club_id')
      .eq('id', selected_venue_id)
      .single();

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    assertClubInScope(admin, venue.club_id);
    return venue;
  }

  const club_id = formData.get('club_id') ? Number(formData.get('club_id')) : null;
  const location_name = (formData.get('location_name') as string) || null;
  if (!club_id || !location_name) return null;
  assertClubInScope(admin, club_id);

  const location_url = (formData.get('location_url') as string) || null;
  const { data: venue, error } = await supabaseAdmin!
    .from('venues')
    .upsert({ name: location_name, url: location_url, club_id }, { onConflict: 'name,club_id' })
    .select('id, name, url, club_id')
    .single();

  if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  return venue;
}

// In-person: the hosting club is the venue's own club, not a separate
// choice — a venue always belongs to exactly one club, already scope-checked
// in resolveVenue. Online: no venue to derive it from, so it's an explicit
// form field. Either way, a null result (genuinely cross-chapter/global, see
// #36 - no venue picked counts as the same thing) is only allowed for a
// super admin, since a club-scoped admin has no standing to create an event
// outside every club they administer.
function resolveEventClubId(formData: FormData, is_online: boolean, venue: ResolvedVenue | null, admin: AdminScope): number | null {
  if (is_online) {
    const submitted = formData.get('event_club_id');
    if (!submitted) {
      assertClubInScope(admin, null);
      return null;
    }
    const club_id = Number(submitted);
    assertClubInScope(admin, club_id);
    return club_id;
  }
  if (!venue) {
    assertClubInScope(admin, null);
    return null;
  }
  return venue.club_id;
}

export const createEvent = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const name = formData.get('name') as string;
    const rawDate = formData.get('date') as string;
    const slug = formData.get('slug') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;

    if (!name || !rawDate || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    // rawDate is a naive "YYYY-MM-DDTHH:mm" from a timezone-less
    // datetime-local input — always the club's own local wall-clock time
    // (see DEFAULT_CLUB_TIMEZONE), never UTC. Converted to a real UTC
    // instant here, once, before it reaches storage or the Mailchimp draft
    // below.
    const date = localWallTimeToUtc(rawDate, DEFAULT_CLUB_TIMEZONE).toISOString();

    const venue = await resolveVenue(formData, is_online, admin);
    const event_club_id = resolveEventClubId(formData, is_online, venue, admin);

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert([{
        name,
        date,
        slug,
        is_online,
        venue_id: venue?.id ?? null,
        club_id: event_club_id,
        created_by: admin.memberId,
        meeting_url,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
      }])
      .select()
      .single();

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    // #27: the host is assumed to be attending their own event — seeded as a
    // real RSVP row (not a bumped count) so it behaves like anyone else's:
    // shows up in the named "Going" list, and the host can clear it later via
    // the same RSVP widget if their plans change. Goes through the same
    // write path setEventRsvp uses, so the row can't drift out of shape.
    // Best-effort, like the Mailchimp draft below — shouldn't block event
    // creation if it fails.
    const { error: rsvpError } = await upsertRsvp(admin.memberId, event.id, 'going');
    if (rsvpError) {
      console.error(`Failed to seed host RSVP for event "${slug}":`, rsvpError.message);
    }

    triggerNetlifyBuild();

    // #39: events are routed under /[clubSlug]/events — a cross-chapter
    // event (event_club_id null) has no club of its own to link into, so
    // the draft email falls back to the one club that exists today. A
    // single-row lookup, not getAllClubs() — no need to fetch every club
    // just to read one slug (and event_club_id null can never match a row
    // anyway, so that path would always fetch and discard the whole table).
    let club_slug: string = DEFAULT_CLUB_SLUG;
    if (event_club_id !== null) {
      const { data: club, error: clubError } = await supabaseAdmin
        .from('clubs')
        .select('slug')
        .eq('id', event_club_id)
        .single();
      if (clubError) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: clubError.message });
      club_slug = club.slug;
    }

    await sendMailchimpEmail({
      name,
      date,
      slug,
      club_slug,
      meeting_url,
      venue_name: venue?.name ?? null,
      venue_url: venue?.url ?? null,
    }).catch((e) => console.error('Mailchimp draft creation failed:', e));

    return { success: true };
  }
});

export const updateEvent = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const slug = formData.get('slug') as string;
    const name = formData.get('name') as string;
    const rawDate = formData.get('date') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;

    if (!name || !rawDate || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    // See createEvent — same naive-local-to-UTC conversion, same reasoning.
    const date = localWallTimeToUtc(rawDate, DEFAULT_CLUB_TIMEZONE).toISOString();

    // A club-scoped admin also can't be allowed to edit an event they don't
    // currently administer, even if their submitted new venue/club would
    // otherwise pass scope - check the event's existing club before touching it.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('events')
      .select('club_id')
      .eq('slug', slug)
      .single();
    if (existingError) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: existingError.message });
    assertClubInScope(admin, existing.club_id);

    const venue = await resolveVenue(formData, is_online, admin);
    const event_club_id = resolveEventClubId(formData, is_online, venue, admin);

    const { error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        date,
        is_online,
        venue_id: venue?.id ?? null,
        club_id: event_club_id,
        meeting_url,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
      })
      .eq('slug', slug);

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    triggerNetlifyBuild();

    return { success: true };
  }
});

// #37: only used by the admin-only EventForm, so now gated and scoped like
// getVenues below - a club-scoped admin should only ever see the clubs they
// administer in the hosting-club/new-venue-club dropdowns.
export const getClubs = defineAction({
  handler: async (_, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabase) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const query = scopeToAdminClubs(supabase.from('clubs').select('id, name').order('name'), admin, 'id');
    const { data, error } = await query;

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }
});

export const getVenues = defineAction({
  handler: async (_, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabase) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const query = scopeToAdminClubs(supabase.from('venues').select('id, name, url, club_id').order('name'), admin, 'club_id');
    const { data, error } = await query;

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }
});
