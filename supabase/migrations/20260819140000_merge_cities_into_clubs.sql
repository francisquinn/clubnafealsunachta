-- Fold `cities` into `clubs`: creating a venue/event now always requires
-- an already-established club — there's no longer a "city known, no
-- chapter yet" state, so the separate `cities` table (added 2026-08-19,
-- see 20260819090000) is redundant. `clubs.name` carries the actual city
-- name directly; display stays derived as `CNF ${clubs.name}`.
-- github.com/francisquinn/clubnafealsunachta/issues/34

ALTER TABLE public.clubs ADD COLUMN name text;

UPDATE public.clubs SET name = cities.name
FROM public.cities
WHERE cities.id = public.clubs.city_id;

ALTER TABLE public.clubs ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.venues ADD COLUMN club_id integer;

UPDATE public.venues SET club_id = clubs.id
FROM public.clubs
WHERE clubs.city_id = public.venues.city_id;

-- Raises a clear error if any venue's city has no matching club, instead
-- of failing opaquely at the `set not null` step below (same pattern as
-- #29's migration).
do $$
declare
  orphaned_count integer;
begin
  select count(*) into orphaned_count from public.venues where club_id is null;

  if orphaned_count > 0 then
    raise exception 'Found % venue(s) whose city has no matching club. Every city with a venue must have a club before this migration can drop `cities` — create the missing club(s) first.', orphaned_count;
  end if;
end $$;

ALTER TABLE public.venues ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id);

ALTER TABLE public.venues
  ADD CONSTRAINT venues_name_club_id_key UNIQUE (name, club_id);

ALTER TABLE public.venues DROP CONSTRAINT venues_city_id_fkey;
ALTER TABLE public.venues DROP CONSTRAINT venues_name_city_id_key;
ALTER TABLE public.venues DROP COLUMN city_id;

ALTER TABLE public.clubs DROP CONSTRAINT clubs_city_id_fkey;
ALTER TABLE public.clubs DROP COLUMN city_id;

DROP TABLE public.cities;
