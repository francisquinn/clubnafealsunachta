import { defineAction, ActionError } from 'astro:actions';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { sendMailchimpEmail } from '../lib/mailchimp';
import { requireAdmin, isChapterInScope, scopeToAdminChapters, type AdminScope } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';
import { fetchLiveEvent } from '../lib/liveEvent';
import { DEFAULT_CHAPTER_TIMEZONE, ONLINE_CHAPTER_SLUG } from '../lib/chapterDefaults';
import { localWallTimeToUtc } from '../lib/timezone';
import { resolveUniqueSlug } from '../lib/slugDedup';
import { upsertRsvp } from './rsvps';
import { MIN_TAGS, normalizeTags, type EventTagSlug } from '../lib/eventTags';

type ResolvedVenue = { id: number; name: string; url: string | null; chapter_id: number };

// #37: throwing wrapper around the shared isChapterInScope predicate, for the
// server-action call sites below (resolveVenue/resolveEventChapterId/updateEvent).
// #177: when the Online lookup failed (see getAdminScope), an out-of-scope
// chapter may well be Online, so report that instead of a misleading FORBIDDEN.
function assertChapterInScope(admin: AdminScope, chapter_id: number) {
  if (isChapterInScope(admin, chapter_id)) return;
  if (admin.onlineUnavailable) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: "Couldn't load the Online chapter, try again in a moment" });
  }
  throw new ActionError({ code: 'FORBIDDEN', message: 'You are not an admin of that chapter' });
}

// #92: tags arrive as one form field per picked tag. Only slugs from the
// fixed list are kept, so a hand-edited request can't add a new one.
function parseTags(formData: FormData): EventTagSlug[] {
  const tags = normalizeTags(formData.getAll('tags').map(String));
  if (tags.length < MIN_TAGS) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Pick at least one tag' });
  }
  return tags;
}

// Resolves the venue for a non-online event: an existing venue is looked up
// by id as-is, a "New venue…" submission (name + chapter, no id yet) is
// upserted. Returns null when the event is online or no venue was picked.
// `chapter_id` comes back on the venue itself — a venue always belongs to
// exactly one chapter, so that's also the event's hosting chapter (see #36).
// Every path is checked against the caller's admin scope (#37) so a
// chapter-scoped admin can't attach an event to, or create a venue under, a
// chapter they don't administer. #177: the Online chapter never hosts a venue
// (every admin has it in scope, so the scope check alone wouldn't stop it) —
// otherwise an in-person event could land under Online.
async function resolveVenue(formData: FormData, is_online: boolean, admin: AdminScope): Promise<ResolvedVenue | null> {
  if (is_online) return null;
  const onlineChapterId = await getOnlineChapterId();

  const selected_venue_id = formData.get('venue_id')
    ? Number(formData.get('venue_id'))
    : null;
  if (selected_venue_id) {
    const { data: venue, error } = await supabaseAdmin!
      .from('venues')
      .select('id, name, url, chapter_id')
      .eq('id', selected_venue_id)
      .single();

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    assertNotOnlineVenue(venue.chapter_id, onlineChapterId);
    assertChapterInScope(admin, venue.chapter_id);
    return venue;
  }

  const chapter_id = formData.get('chapter_id') ? Number(formData.get('chapter_id')) : null;
  const location_name = (formData.get('location_name') as string) || null;
  if (!chapter_id || !location_name) return null;
  assertNotOnlineVenue(chapter_id, onlineChapterId);
  assertChapterInScope(admin, chapter_id);

  const location_url = (formData.get('location_url') as string) || null;
  const { data: venue, error } = await supabaseAdmin!
    .from('venues')
    .upsert({ name: location_name, url: location_url, chapter_id }, { onConflict: 'name,chapter_id' })
    .select('id, name, url, chapter_id')
    .single();

  if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  return venue;
}

async function getOnlineChapterId(): Promise<number> {
  const { data: onlineChapter, error } = await supabaseAdmin!
    .from('chapters')
    .select('id')
    .eq('slug', ONLINE_CHAPTER_SLUG)
    .single();
  if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  return onlineChapter.id;
}

function assertNotOnlineVenue(chapter_id: number, onlineChapterId: number) {
  if (chapter_id !== onlineChapterId) return;
  throw new ActionError({ code: 'BAD_REQUEST', message: 'The Online chapter has no venues' });
}

// In-person: the hosting chapter is the venue's own chapter, not a separate
// choice — a venue always belongs to exactly one chapter, already scope-checked
// in resolveVenue. Online (#177): always the Online chapter, whatever the
// form sent — every chapter admin has it in scope (see getAdminScope). Every
// event needs a chapter, so an in-person event with no venue is refused for
// everyone, super admins included (events.chapter_id is NOT NULL).
async function resolveEventChapterId(is_online: boolean, venue: ResolvedVenue | null, admin: AdminScope): Promise<number> {
  if (is_online) {
    const onlineChapterId = await getOnlineChapterId();
    assertChapterInScope(admin, onlineChapterId);
    return onlineChapterId;
  }
  if (!venue) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Pick a venue so the event has a chapter' });
  }
  return venue.chapter_id;
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
    const rawEndDate = formData.get('end_date') as string;
    const rawSlug = formData.get('slug') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;
    const meet_point = (formData.get('meet_point') as string) || null;

    if (!name || !rawDate || !rawEndDate || !rawSlug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    const tags = parseTags(formData);

    if (!/^[a-z0-9-]+$/.test(rawSlug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    const slug = await resolveUniqueSlug(supabaseAdmin, 'events', rawSlug);

    // rawDate/rawEndDate are naive "YYYY-MM-DDTHH:mm" from timezone-less
    // datetime-local inputs — always the chapter's own local wall-clock time
    // (see DEFAULT_CHAPTER_TIMEZONE), never UTC. Converted to real UTC instants
    // here, once, before either reaches storage or the Mailchimp draft below.
    const date = localWallTimeToUtc(rawDate, DEFAULT_CHAPTER_TIMEZONE).toISOString();
    const end_date = localWallTimeToUtc(rawEndDate, DEFAULT_CHAPTER_TIMEZONE).toISOString();

    // #100: an end time before (or equal to) the start isn't a real event
    // window — checked here rather than left to the DB's own
    // events_end_date_after_date constraint so a bad submission comes back
    // as a normal form error instead of a raw Postgres failure.
    if (end_date <= date) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'End time must be after the start time' });
    }

    const venue = await resolveVenue(formData, is_online, admin);
    const event_chapter_id = await resolveEventChapterId(is_online, venue, admin);

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert([{
        name,
        date,
        end_date,
        slug,
        is_online,
        venue_id: venue?.id ?? null,
        chapter_id: event_chapter_id,
        created_by: admin.memberId,
        meeting_url,
        meet_point,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
        tags,
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

    // #39: events are routed under /[chapterSlug]/events, and the chapter's slug
    // also picks the Mailchimp segment the draft goes to (#64). A single-row
    // lookup, not getAllChapters() — no need to fetch every chapter just to read
    // one slug.
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from('chapters')
      .select('slug')
      .eq('id', event_chapter_id)
      .single();
    if (chapterError) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: chapterError.message });

    await sendMailchimpEmail({
      name,
      date,
      slug,
      chapter_slug: chapter.slug,
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
    const rawEndDate = formData.get('end_date') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;
    const meet_point = (formData.get('meet_point') as string) || null;

    if (!name || !rawDate || !rawEndDate || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    const tags = parseTags(formData);

    // See createEvent — same naive-local-to-UTC conversion, same reasoning.
    const date = localWallTimeToUtc(rawDate, DEFAULT_CHAPTER_TIMEZONE).toISOString();
    const end_date = localWallTimeToUtc(rawEndDate, DEFAULT_CHAPTER_TIMEZONE).toISOString();

    if (end_date <= date) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'End time must be after the start time' });
    }

    // A chapter-scoped admin also can't be allowed to edit an event they don't
    // currently administer, even if their submitted new venue/chapter would
    // otherwise pass scope - check the event's existing chapter before touching it.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('events')
      .select('chapter_id')
      .eq('slug', slug)
      .single();
    if (existingError) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: existingError.message });
    assertChapterInScope(admin, existing.chapter_id);

    const venue = await resolveVenue(formData, is_online, admin);
    const event_chapter_id = await resolveEventChapterId(is_online, venue, admin);

    const { error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        date,
        end_date,
        is_online,
        venue_id: venue?.id ?? null,
        chapter_id: event_chapter_id,
        meeting_url,
        meet_point,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
        tags,
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
// getVenues below - a chapter-scoped admin should only ever see the chapters they
// administer in the hosting-chapter/new-venue-chapter dropdowns.
export const getChapters = defineAction({
  handler: async (_, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabase) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const query = scopeToAdminChapters(supabase.from('chapters').select('id, name, slug').order('name'), admin, 'id');
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

    const query = scopeToAdminChapters(supabase.from('venues').select('id, name, url, chapter_id').order('name'), admin, 'chapter_id');
    const { data, error } = await query;

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }
});

// #197: fresh schedule/meeting-link/calendar inputs for the prerendered event
// page's islands to swap in on hydration (same idea as getEventRsvps).
// Scope: only the Join online button, the "Online"/venue link and the
// calendar links are live. The date/time text on the page stays build-time.
export const getEventLive = defineAction({
  handler: async ({ slug }: { slug: string }) => {
    if (typeof slug !== 'string' || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing event slug' });
    }
    let live;
    try {
      live = await fetchLiveEvent(slug);
    } catch {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load event' });
    }
    // NOT_FOUND (not BAD_REQUEST) so the page's islands can tell "event was
    // deleted since the build" from a transient failure and hide themselves.
    if (!live) throw new ActionError({ code: 'NOT_FOUND', message: 'Event not found' });
    return live;
  },
});
