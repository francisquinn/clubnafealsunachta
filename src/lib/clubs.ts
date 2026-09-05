import { getCollection } from 'astro:content';
import { supabaseAdmin } from './supabase';
import type { EventCollection } from '../types/types';

export type Club = { id: number; name: string; slug: string };

// Re-exported for server-side call sites (actions, page frontmatter) that
// already import from this module — see src/lib/clubDefaults.ts for why the
// constant itself lives in its own zero-dependency file instead of here.
export { DEFAULT_CLUB_SLUG } from './clubDefaults';

// Single source of truth for "every club that exists" — used by the events
// loader (to resolve an event's club) and by the [clubSlug] static routes
// (#39) to know which club-prefixed pages to build, including a club with
// zero events yet.
//
// Memoized per build/process: [eventSlug].astro and [eventSlug].ics.ts each
// run their own getStaticPaths (Astro doesn't share state between route
// files), and without this cache both independently hit Supabase for the
// exact same "every club" data. Caching also closes a real divergence risk —
// two live, unmemoized queries a moment apart could see a different club
// list if the clubs table changed mid-build, desyncing which .ics files
// exist from which event pages link to them. A rejected fetch clears the
// cache so a real Supabase outage doesn't wedge every future call in the
// same process into a stale failure.
let clubsPromise: Promise<Club[]> | null = null;

async function fetchAllClubs(): Promise<Club[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
  }

  const { data, error } = await supabaseAdmin.from('clubs').select('id, name, slug');
  if (error) {
    throw new Error(`Failed to fetch clubs from Supabase: ${error.message}`);
  }

  if (data === null || data.length === 0) {
    throw new Error('getAllClubs() returned zero clubs — refusing to silently build zero club pages. Check the clubs table and Supabase config.');
  }

  return data;
}

export async function getAllClubs(): Promise<Club[]> {
  if (!clubsPromise) {
    clubsPromise = fetchAllClubs().catch((error) => {
      clubsPromise = null;
      throw error;
    });
  }
  return clubsPromise;
}

// #39: the set of club slugs a given event belongs under — the club it's
// actually scoped to, or, for a genuinely cross-chapter event (location
// null), every club that exists (the "visible everywhere" decision). Shared
// by both [clubSlug] route files so the membership rule can't drift between
// the list page and the detail page's getStaticPaths.
export function clubSlugsForEvent(location: { slug: string } | null, allClubSlugs: string[]): string[] {
  return location ? [location.slug] : allClubSlugs;
}

export type EventClubPath = {
  params: { clubSlug: string; eventSlug: string };
  props: { event: EventCollection };
};

// The getStaticPaths shared by [eventSlug].astro and [eventSlug].ics.ts —
// every event/club pair that needs a page, kept in exactly one place instead
// of copy-pasted so the two routes can't drift out of lockstep with each
// other.
export async function getEventClubStaticPaths(): Promise<EventClubPath[]> {
  const [events, clubs] = await Promise.all([getCollection('event'), getAllClubs()]);
  const clubSlugs = clubs.map((c) => c.slug);

  return events.flatMap((event) =>
    clubSlugsForEvent(event.data.location, clubSlugs).map((clubSlug) => ({
      params: { clubSlug, eventSlug: event.data.slug },
      props: { event },
    }))
  );
}
