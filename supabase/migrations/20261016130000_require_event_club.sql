-- Issue #177: every event belongs to a chapter. Online events were moved to
-- the Online chapter by 20261016120000_add_online_club.sql; this closes the
-- last gap — an in-person event with no venue used to be "cross-chapter"
-- (club_id null, shown under every club). Any such leftover goes to Trieste,
-- the only city chapter today (same fallback #36 used), and club_id becomes
-- required so a chapter-less event can't come back.
do $$
declare
  trieste_id integer;
begin
  select id into trieste_id from public.clubs where slug = 'trieste';

  if trieste_id is null and exists (select 1 from public.events where club_id is null) then
    raise exception 'Backfill expects a club with slug ''trieste'' to exist (the only city chapter so far) for events that still have no chapter. Adjust this migration before running it against an environment without that club.';
  end if;

  update public.events
  set club_id = trieste_id
  where club_id is null;
end $$;

alter table public.events alter column club_id set not null;
