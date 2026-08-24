-- Issue #39 follow-up: correct a side effect of the #36 backfill.
--
-- #36's migration set every event's null club_id to Trieste's id, with no
-- special case for online events — reasonable at the time (Trieste was the
-- only club, so it was the best available default), but it means these 6
-- online events look exactly like an admin explicitly chose Trieste as
-- their hosting club, when in fact that choice didn't exist yet when they
-- were created. Unlike in-person events (whose club comes from their venue,
-- a real fact), a no-venue online event has nothing backing "Trieste"
-- beyond the backfill's default value.
--
-- The most recent online event created after the hosting-club choice
-- actually existed (human-with-a-side-of-chips) was deliberately left
-- unset by its creator — this migration applies that same call
-- retroactively to the events created before the choice existed, rather
-- than leaving them pinned to Trieste by migration accident. Matches the
-- "genuinely cross-chapter, visible on every club's page" treatment #39
-- gives to a null club_id.
--
-- Targeted by slug, not a blanket "every online event" update, so any
-- online event a club-scoped admin has since deliberately assigned to a
-- specific club is left untouched.
update public.events
set club_id = null
where is_online = true
  and slug in (
    'can-travel-shape-us',
    'resolutions',
    'are-we-present',
    'bad-idea',
    'one-and-only',
    'better-than-whom'
  );
