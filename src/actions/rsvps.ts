import { defineAction, ActionError } from 'astro:actions';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession } from '../lib/auth';
import { unwrapRelation } from '../lib/supabaseRelations';
import { getDisplayName } from '../lib/memberDisplay';
import {
  isRsvpStatus,
  type RsvpCounts,
  type RsvpLists,
  type RsvpMember,
  type RsvpState,
  type RsvpStatus,
} from '../lib/rsvpTypes';

type RsvpRow = {
  member_id: string;
  status: RsvpStatus;
  // Only rows with a resolvable member survive fetchRsvpRows' filter, so a
  // built state never holds a row whose member came back null (a deleted
  // member would leave a dangling FK unless the FK's ON DELETE CASCADE ran).
  members: RsvpMember;
};

// Resolves an event's id from its slug, rejecting unknown slugs up front so a
// stale/tampered page gets a clear 400 instead of an opaque FK/empty-result
// failure further down.
async function resolveEventId(slug: string): Promise<number> {
  const { data, error } = await supabaseAdmin!
    .from('events')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Event not found' });
  }
  return data.id;
}

async function fetchRsvpRows(eventId: number): Promise<RsvpRow[]> {
  const { data, error } = await supabaseAdmin!
    .from('rsvps')
    .select('member_id, status, members(id, username, full_name, display_full_name, avatar_url)')
    .eq('event_id', eventId);

  if (error) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }

  // #27: members who respond "not_going" are still counted alongside the
  // "going"/"maybe" heads, so a status the schema CHECK already guarantees is
  // kept as-is while a (theoretically impossible) stray row is skipped rather
  // than crashing the aggregation.
  return (data ?? [])
    .map((row) => ({
      member_id: row.member_id,
      status: row.status,
      members: unwrapRelation<RsvpMember>(row.members),
    }))
    .filter(
      (row): row is RsvpRow =>
        typeof row.member_id === 'string' &&
        row.members !== null &&
        isRsvpStatus(row.status)
    );
}

// Builds the page-level RSVP state from the event's raw rows:
//   - `counts` are aggregate and public (always returned).
//   - `lists` + `myStatus` are member-only — built only when a memberId is
//     supplied, so an anonymous visitor can never learn who rsvp'd.
function buildRsvpState(rows: RsvpRow[], memberId: string | null): RsvpState {
  const counts: RsvpCounts = { going: 0, maybe: 0, not_going: 0 };
  const lists: RsvpLists | null = memberId
    ? { going: [], maybe: [], not_going: [] }
    : null;
  let myStatus: RsvpStatus | null = null;

  for (const row of rows) {
    counts[row.status] += 1;
    if (lists) lists[row.status].push(row.members);
    if (row.member_id === memberId) myStatus = row.status;
  }

  if (lists) {
    for (const status of Object.keys(lists) as RsvpStatus[]) {
      lists[status].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    }
  }

  return { counts, myStatus, lists };
}

// The one write path for "member_id's status on event_id is X" — an upsert
// on the (member_id, event_id) PK, since setting an RSVP is always "my
// current status is X" rather than append-only. Shared by setEventRsvp and
// createEvent's best-effort host seed, so the row shape (including the
// updated_at audit stamp) can't drift between the two call sites.
export async function upsertRsvp(memberId: string, eventId: number, status: RsvpStatus) {
  return supabaseAdmin!
    .from('rsvps')
    .upsert(
      {
        member_id: memberId,
        event_id: eventId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,event_id' }
    );
}

// One round-trip per page visit (client:load island): aggregate counts for
// everyone, plus the member's own status and the full named breakdowns only
// when a valid session cookie is present. The counts returned here are
// fresher than what the static build baked into the page — the island
// renders whichever it has, falling back to the baked-in numbers if the
// fetch fails (e.g. the rsvps table isn't deployed yet).
export const getEventRsvps = defineAction({
  handler: async ({ slug }: { slug: string }, context) => {
    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    if (typeof slug !== 'string' || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing event slug' });
    }

    const eventId = await resolveEventId(slug);

    const token = context.cookies.get('session')?.value;
    const payload = await verifySession(token);
    const memberId = payload?.memberId ?? null;

    const rows = await fetchRsvpRows(eventId);
    return buildRsvpState(rows, memberId);
  },
});

// #180: the event cards' "N going", for every card on a page in one call.
// Like getEventRsvps it exists because RSVPs don't rebuild the static pages,
// so the build-time count goes stale. Counts only (public, same as the
// event page's summary), keyed by slug; a slug with no going RSVPs, or one
// that matches no event, comes back as 0. #182: counted in the database by
// event_rsvp_counts (one row per event, so the Data API's 1000-row limit
// caps events, not RSVPs), and the cap matches that limit.
const MAX_GOING_COUNT_SLUGS = 1000;
const MAX_SLUG_LENGTH = 200;

export const getGoingCounts = defineAction({
  handler: async ({ slugs }: { slugs: string[] }) => {
    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    if (
      !Array.isArray(slugs) ||
      slugs.some((slug) => typeof slug !== 'string' || !slug || slug.length > MAX_SLUG_LENGTH)
    ) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slugs must be a list of event slugs' });
    }
    const uniqueSlugs = [...new Set(slugs)];
    if (uniqueSlugs.length > MAX_GOING_COUNT_SLUGS) {
      throw new ActionError({ code: 'BAD_REQUEST', message: `At most ${MAX_GOING_COUNT_SLUGS} events at a time` });
    }

    const counts: Record<string, number> = Object.fromEntries(uniqueSlugs.map((slug) => [slug, 0]));
    if (uniqueSlugs.length === 0) return counts;

    const { data, error } = await supabaseAdmin.rpc('event_rsvp_counts', { event_slugs: uniqueSlugs });

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    for (const row of (data ?? []) as { slug: string; going: number }[]) {
      if (row.slug in counts) counts[row.slug] = row.going;
    }
    return counts;
  },
});

export const setEventRsvp = defineAction({
  handler: async ({ slug, status }: { slug: string; status: RsvpStatus | null }, context) => {
    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    if (typeof slug !== 'string' || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing event slug' });
    }
    if (status !== null && !isRsvpStatus(status)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Status must be one of going, maybe, not_going, or null to clear' });
    }

    const token = context.cookies.get('session')?.value;
    const payload = await verifySession(token);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const eventId = await resolveEventId(slug);

    if (status === null) {
      // Re-clicking your own active status clears your RSVP — there's no
      // fourth "no status" value in the schema, you just have no row.
      const { error } = await supabaseAdmin
        .from('rsvps')
        .delete()
        .eq('member_id', payload.memberId)
        .eq('event_id', eventId);

      if (error) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
    } else {
      const { error } = await upsertRsvp(payload.memberId, eventId, status);

      if (error) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
    }

    const rows = await fetchRsvpRows(eventId);
    return buildRsvpState(rows, payload.memberId);
  },
});