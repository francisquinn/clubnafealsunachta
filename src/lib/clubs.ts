import { getCollection } from 'astro:content';
import { supabaseAdmin } from './supabase';
import type { EventCollection } from '../types/types';
import { ONLINE_CLUB_SLUG } from './clubDefaults';

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
// Memoized per build/process: events.astro and events.ics.ts each run their
// own getStaticPaths (Astro doesn't share state between route files), and
// without this cache both independently hit Supabase for the exact same
// "every club" data. Caching also closes a real divergence risk — two live,
// unmemoized queries a moment apart could see a different club list if the
// clubs table changed mid-build, desyncing which feeds exist from which
// events pages link to them. A rejected fetch clears the
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

// #177: the events-page chapter picker's options — city chapters
// alphabetically, Online last.
export function sortChaptersForPicker(clubs: Club[]): { name: string; slug: string }[] {
  return clubs
    .map(({ name, slug }) => ({ name, slug }))
    .sort((a, b) => Number(a.slug === ONLINE_CLUB_SLUG) - Number(b.slug === ONLINE_CLUB_SLUG) || a.name.localeCompare(b.name));
}

export type EventClubPath = {
  params: { clubSlug: string; eventSlug: string };
  props: { event: EventCollection };
};

// The getStaticPaths shared by [eventSlug].astro and [eventSlug].ics.ts —
// one page per event, under its own club, kept in exactly one place instead
// of copy-pasted so the two routes can't drift out of lockstep with each
// other.
export async function getEventClubStaticPaths(): Promise<EventClubPath[]> {
  const events = await getCollection('event');

  return events.map((event) => ({
    params: { clubSlug: event.data.location.slug, eventSlug: event.data.slug },
    props: { event },
  }));
}

export type ClubEventsPath = {
  params: { clubSlug: string };
  props: { club: Club; events: EventCollection[] };
};

// The getStaticPaths shared by events.astro and the events.ics feed (#80) —
// one entry per club with that club's events, so the list page and the
// calendar feed always agree on which events a club shows. Every club gets
// a path, including one with zero events yet.
export async function getClubEventsStaticPaths(): Promise<ClubEventsPath[]> {
  const [clubs, events] = await Promise.all([
    getAllClubs(),
    getCollection('event') as Promise<EventCollection[]>,
  ]);
  return clubs.map((club) => ({
    params: { clubSlug: club.slug },
    props: {
      club,
      events: events.filter((event) => event.data.location.slug === club.slug),
    },
  }));
}
