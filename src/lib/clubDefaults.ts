// #39: the one club that exists today. Single source of truth for every
// "no better club to link into" fallback (a genuinely cross-chapter event's
// canonical URL/CTA link, an admin form's URL preview before a real club
// picker exists, a legacy un-prefixed page) — until a "choose your city"
// landing page exists, this is the only reasonable default. Update all call
// sites' behaviour together, not just this value, once a second club exists.
//
// Deliberately kept in its own zero-dependency module rather than
// src/lib/clubs.ts: several of the call sites above are client-hydrated
// React components (EventCard, NavMenu, EventForm), and clubs.ts imports
// the Supabase admin client — importing from it would drag that whole
// module (and its secret-key-reading env access) into the client bundle.
export const DEFAULT_CLUB_SLUG = 'trieste';
