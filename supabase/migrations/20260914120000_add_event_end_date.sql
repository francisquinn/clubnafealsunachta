-- #100: adds an end time to events, alongside the existing start-only `date`
-- column. #97's "on air" logic needs an end time on every event (not just
-- new ones) to compute correctly, so this is backfilled rather than left
-- null for historical rows.
--
-- Backfill target: each event's own local calendar day at 20:00
-- Europe/Rome — the club's usual end time. Confirmed against live data
-- 2026-09-14: none of the 65 existing events start at or after 19:00 local,
-- so a same-day 20:00 end never lands before (or equal to) its own start.
-- Francis will manually correct the handful of events whose real end time
-- differed from 20:00 via the admin edit form.
--
-- Same double `AT TIME ZONE` trick as the 2026-09-04 date-timezone-bug fix:
-- `date AT TIME ZONE 'Europe/Rome'` strips the timestamptz down to naive
-- Rome-local wall-clock digits, `::date` takes just the calendar day, then
-- the second `AT TIME ZONE 'Europe/Rome'` reinterprets "that day at 20:00"
-- as Rome-local and derives the real UTC instant (Postgres's tz database
-- resolves CET/CEST per row automatically).
alter table public.events add column end_date timestamptz;

update public.events
set end_date = (
  (date at time zone 'Europe/Rome')::date + time '20:00'
) at time zone 'Europe/Rome';

-- NOT NULL + a sanity CHECK once every row is backfilled — EventForm now
-- requires an end time the same way it already requires a start time
-- (defaulting to 20:00), so this isn't left optional going forward either.
alter table public.events
  alter column end_date set not null,
  add constraint events_end_date_after_date check (end_date > date);
