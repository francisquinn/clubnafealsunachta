// #39: the one chapter that exists today. Single source of truth for every
// "no better chapter to link into" fallback (an admin form's URL preview
// before a real chapter picker exists, the nav's Events link outside a chapter
// page) — until a "choose your city" landing page exists, this is the only
// reasonable default. Update all call sites' behaviour together, not just
// this value, once a second chapter exists.
//
// Deliberately kept in its own zero-dependency module rather than
// src/lib/chapters.ts: both call sites above are client-hydrated React
// components (NavMenu, EventForm), and chapters.ts imports
// the Supabase admin client — importing from it would drag that whole
// module (and its secret-key-reading env access) into the client bundle.
export const DEFAULT_CHAPTER_SLUG = 'trieste';

// Fallback IANA zone for a chapter that has none (see chapterTimezone below):
// the zone every event's wall-clock time (entered via a timezone-less
// datetime-local input) is in is its chapter's `timezone`. See
// src/lib/timezone.ts for where this crosses the UTC/local boundary.
export const DEFAULT_CHAPTER_TIMEZONE = 'Europe/Rome';

// #233: every chapter has its own `timezone` (chapters.timezone), and an
// event's times are in its chapter's zone. DEFAULT_CHAPTER_TIMEZONE is only
// the fallback for a chapter whose zone isn't usable (missing, or not a real
// zone), so a bad value never shows times in the visitor's own zone. Lives here, not in chapters.ts, for the same
// client-bundle reason as the constants above.
// An unknown zone (a typo in the column, which has no check constraint) is
// treated as missing: Intl throws a RangeError on it, which would otherwise
// fail the whole static build and every admin events page.
const validZones = new Set<string>();
export function chapterTimezone(timezone?: string | null): string {
  if (!timezone) return DEFAULT_CHAPTER_TIMEZONE;
  if (validZones.has(timezone)) return timezone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return DEFAULT_CHAPTER_TIMEZONE;
  }
  validZones.add(timezone);
  return timezone;
}

// #177: Online is a chapter of its own (every online event belongs to it),
// open to every admin rather than administered on its own — see
// getAdminScope and resolveEventChapterId.
export const ONLINE_CHAPTER_SLUG = 'online';
