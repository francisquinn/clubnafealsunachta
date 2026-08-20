-- Issue #36: scope events to a specific club.
--
-- `club_id` is nullable by design, not a strict "every event must belong
-- to one chapter" FK: a non-null value means a specific club organizes the
-- event (in-person or online), null means a genuinely cross-chapter/global
-- event (e.g. one Francis hosts himself, not tied to any single chapter) —
-- same idea as `posts` staying unscoped. See #52 for the events-page
-- filtering/display follow-up this enables.
alter table public.events add column club_id integer references public.clubs(id);

-- Backfill: every event to date, online or in-person, was run by the one
-- club (Trieste) — see #34's/#29's migrations for the same backfill
-- pattern. Raises a clear error if that club is missing, instead of
-- silently leaving every existing row unscoped.
do $$
declare
  trieste_id integer;
begin
  select id into trieste_id from public.clubs where slug = 'trieste';

  if trieste_id is null then
    raise exception 'Backfill expects a club with slug ''trieste'' to exist (every event to date was run by that club). Adjust this migration before running it against an environment without that club.';
  end if;

  update public.events set club_id = trieste_id where club_id is null;
end $$;
