import { getCollection } from 'astro:content';
import { supabaseAdmin } from './supabase';
import type { EventCollection } from '../types/types';
import { ONLINE_CHAPTER_SLUG } from './chapterDefaults';

// The page copy columns (#132) are all nullable; see chapterContent.ts for how
// a chapter without them is shown.
export type Chapter = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  photo?: string | null;
  meeting_when?: string | null;
  meeting_venue?: { name: string; url: string | null } | null;
  chat_url?: string | null;
  what_to_expect?: string[] | null;
  social?: { name: string; href: string; icon: string }[] | null;
  // IANA zone the chapter's event times are in. Not read yet — see
  // DEFAULT_CHAPTER_TIMEZONE.
  timezone?: string;
};

const CHAPTER_COLUMNS =
  'id, name, slug, description, photo, meeting_when, meeting_venue:venues!meeting_venue_id(name, url), chat_url, what_to_expect, social, timezone';

// Re-exported for server-side call sites (actions, page frontmatter) that
// already import from this module — see src/lib/chapterDefaults.ts for why the
// constant itself lives in its own zero-dependency file instead of here.
export { DEFAULT_CHAPTER_SLUG } from './chapterDefaults';

// Single source of truth for "every chapter that exists" — used by the events
// loader (to resolve an event's chapter) and by the [chapterSlug] static routes
// (#39) to know which chapter-prefixed pages to build, including a chapter with
// zero events yet.
//
// Memoized per build/process: events.astro and events.ics.ts each run their
// own getStaticPaths (Astro doesn't share state between route files), and
// without this cache both independently hit Supabase for the exact same
// "every chapter" data. Caching also closes a real divergence risk — two live,
// unmemoized queries a moment apart could see a different chapter list if the
// chapters table changed mid-build, desyncing which feeds exist from which
// events pages link to them. A rejected fetch clears the
// cache so a real Supabase outage doesn't wedge every future call in the
// same process into a stale failure.
let chaptersPromise: Promise<Chapter[]> | null = null;

async function fetchAllChapters(): Promise<Chapter[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
  }

  const { data, error } = await supabaseAdmin.from('chapters').select(CHAPTER_COLUMNS);
  if (error) {
    throw new Error(`Failed to fetch chapters from Supabase: ${error.message}`);
  }

  if (data === null || data.length === 0) {
    throw new Error('getAllChapters() returned zero chapters — refusing to silently build zero chapter pages. Check the chapters table and Supabase config.');
  }

  // Without generated types the client types the venue embed as an array; it's
  // a many-to-one, so at runtime it's a single object (or null).
  return data as unknown as Chapter[];
}

export async function getAllChapters(): Promise<Chapter[]> {
  if (!chaptersPromise) {
    chaptersPromise = fetchAllChapters().catch((error) => {
      chaptersPromise = null;
      throw error;
    });
  }
  return chaptersPromise;
}

// #177: the events-page chapter picker's options — city chapters
// alphabetically, Online last.
export function sortChaptersForPicker(chapters: Chapter[]): { name: string; slug: string }[] {
  return chapters
    .map(({ name, slug }) => ({ name, slug }))
    .sort((a, b) => Number(a.slug === ONLINE_CHAPTER_SLUG) - Number(b.slug === ONLINE_CHAPTER_SLUG) || a.name.localeCompare(b.name));
}

export type EventChapterPath = {
  params: { chapterSlug: string; eventSlug: string };
  props: { event: EventCollection };
};

// The getStaticPaths shared by [eventSlug].astro and [eventSlug].ics.ts —
// one page per event, under its own chapter, kept in exactly one place instead
// of copy-pasted so the two routes can't drift out of lockstep with each
// other.
export async function getEventChapterStaticPaths(): Promise<EventChapterPath[]> {
  const events = await getCollection('event');

  return events.map((event) => ({
    params: { chapterSlug: event.data.location.slug, eventSlug: event.data.slug },
    props: { event },
  }));
}

export type ChapterEventsPath = {
  params: { chapterSlug: string };
  props: { chapter: Chapter; events: EventCollection[] };
};

// The getStaticPaths shared by events.astro and the events.ics feed (#80) —
// one entry per chapter with that chapter's events, so the list page and the
// calendar feed always agree on which events a chapter shows. Every chapter gets
// a path, including one with zero events yet.
export async function getChapterEventsStaticPaths(): Promise<ChapterEventsPath[]> {
  const [chapters, events] = await Promise.all([
    getAllChapters(),
    getCollection('event') as Promise<EventCollection[]>,
  ]);
  return chapters.map((chapter) => ({
    params: { chapterSlug: chapter.slug },
    props: {
      chapter,
      events: events.filter((event) => event.data.location.slug === chapter.slug),
    },
  }));
}
