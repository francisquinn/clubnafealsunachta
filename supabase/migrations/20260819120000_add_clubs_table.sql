-- Add `clubs` table: the actual chapter entity for multi-city support.
-- Kept separate from `cities` so a city can host a one-off event without
-- becoming a full chapter. Display name is derived (`CNF ${city.name}`),
-- not stored. See openspec/changes/multi-city-foundation/ (part 1) and
-- github.com/francisquinn/clubnafealsunachta/issues/34.

CREATE SEQUENCE public.clubs_id_seq AS integer;

CREATE TABLE public.clubs (
  id         integer                  DEFAULT nextval('public.clubs_id_seq'::regclass) NOT NULL,
  city_id    integer                  NOT NULL,
  slug       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER SEQUENCE public.clubs_id_seq OWNED BY public.clubs.id;

GRANT ALL ON SEQUENCE public.clubs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.clubs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.clubs_id_seq TO service_role;

ALTER TABLE public.clubs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_slug_key UNIQUE (slug);

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_slug_lowercase_check CHECK (slug = lower(slug));

GRANT ALL ON public.clubs TO anon;
GRANT ALL ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;

CREATE POLICY "public read clubs" ON public.clubs
  FOR SELECT USING (true);

-- Seed: Trieste is the current, only club. Raises a clear error if this is
-- run against an environment with cities but not the expected one, instead
-- of silently seeding no club at all (see #29's migration for the same
-- pattern) — but a completely empty cities table (a fresh/local database,
-- which never had Trieste since that row predates migrations) creates it
-- rather than erroring, so this runs clean on local dev too.
do $$
declare
  trieste_id integer;
begin
  select id into trieste_id from public.cities where name = 'Trieste';

  if trieste_id is null then
    if exists (select 1 from public.cities) then
      raise exception 'Seed expects a city named ''Trieste'' to exist. Adjust this migration before running it against an environment without that city.';
    end if;

    insert into public.cities (name) values ('Trieste') returning id into trieste_id;
  end if;

  insert into public.clubs (city_id, slug) values (trieste_id, 'trieste');
end $$;
