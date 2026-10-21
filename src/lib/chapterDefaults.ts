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

// Same "one chapter exists today" reasoning as DEFAULT_CHAPTER_SLUG, for the one
// piece of chapter data that isn't a display fallback: the IANA zone every
// event's wall-clock time (entered via a timezone-less datetime-local input)
// is actually in. See src/lib/timezone.ts for where this crosses the
// UTC/local boundary. Revisit alongside DEFAULT_CHAPTER_SLUG once a second real
// chapter (in a different timezone) exists.
export const DEFAULT_CHAPTER_TIMEZONE = 'Europe/Rome';

// #177: Online is a chapter of its own (every online event belongs to it),
// open to every admin rather than administered on its own — see
// getAdminScope and resolveEventChapterId.
export const ONLINE_CHAPTER_SLUG = 'online';
