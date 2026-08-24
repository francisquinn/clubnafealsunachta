import { supabaseAdmin } from './supabase';

export type Club = { id: number; name: string; slug: string };

// Re-exported for server-side call sites (actions, page frontmatter) that
// already import from this module — see src/lib/clubDefaults.ts for why the
// constant itself lives in its own zero-dependency file instead of here.
export { DEFAULT_CLUB_SLUG } from './clubDefaults';

// Single source of truth for "every club that exists" — used by the events
// loader (to resolve an event's club) and by the [clubSlug] static routes
// (#39) to know which club-prefixed pages to build, including a club with
// zero events yet.
export async function getAllClubs(): Promise<Club[]> {
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

// #39: the set of club slugs a given event belongs under — the club it's
// actually scoped to, or, for a genuinely cross-chapter event (location
// null), every club that exists (the "visible everywhere" decision). Shared
// by both [clubSlug] route files so the membership rule can't drift between
// the list page and the detail page's getStaticPaths.
export function clubSlugsForEvent(location: { slug: string } | null, allClubSlugs: string[]): string[] {
  return location ? [location.slug] : allClubSlugs;
}
