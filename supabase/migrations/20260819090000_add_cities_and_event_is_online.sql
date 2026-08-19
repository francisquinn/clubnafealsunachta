-- Rename locations -> cities (cities holds real geographic cities only,
-- no more "Online" pseudo-location), add events.is_online as the single
-- authoritative online/offline signal, backfill from the old "Online"
-- sentinel, then drop it and the now-unused events.location_id.
-- See openspec/changes/multi-city-foundation/ for the full proposal/design.

ALTER TABLE public.locations RENAME TO cities;

ALTER TABLE public.cities RENAME CONSTRAINT locations_pkey TO cities_pkey;
ALTER TABLE public.cities RENAME CONSTRAINT locations_name_key TO cities_name_key;

ALTER SEQUENCE public.locations_id_seq RENAME TO cities_id_seq;

ALTER TABLE public.venues RENAME COLUMN location_id TO city_id;
ALTER TABLE public.venues RENAME CONSTRAINT venues_location_id_fkey TO venues_city_id_fkey;
ALTER TABLE public.venues RENAME CONSTRAINT venues_name_location_id_key TO venues_name_city_id_key;

ALTER TABLE public.events ADD COLUMN is_online boolean NOT NULL DEFAULT false;

UPDATE public.events
SET is_online = true
WHERE location_id = (SELECT id FROM public.cities WHERE name = 'Online');

ALTER TABLE public.events
  ADD CONSTRAINT events_online_xor_venue CHECK (is_online = false OR venue_id IS NULL);

ALTER TABLE public.events DROP CONSTRAINT events_location_id_fkey;
ALTER TABLE public.events DROP COLUMN location_id;

DELETE FROM public.cities WHERE name = 'Online';
