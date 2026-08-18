-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_graphql;

CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE SEQUENCE public.events_id_seq AS integer;

CREATE SEQUENCE public.locations_id_seq AS integer;

CREATE SEQUENCE public.posts_id_seq AS integer;

CREATE SEQUENCE public.venues_id_seq AS integer;

CREATE FUNCTION public.delete_stale_unverified_members()
  RETURNS void
  LANGUAGE sql
  AS $function$
  DELETE FROM members
  WHERE email_verified_at IS NULL
    AND created_at < NOW() - INTERVAL '30 days';
$function$;

GRANT ALL ON FUNCTION public.delete_stale_unverified_members() TO anon;

GRANT ALL ON FUNCTION public.delete_stale_unverified_members() TO authenticated;

GRANT ALL ON FUNCTION public.delete_stale_unverified_members() TO service_role;

CREATE TABLE public.events (
  id          integer                  DEFAULT nextval('public.events_id_seq'::regclass) NOT NULL,
  name        text                     NOT NULL,
  date        timestamp with time zone NOT NULL,
  slug        text                     NOT NULL,
  instagram   text,
  facebook    text,
  meetup      text,
  description text,
  summary     text,
  created_at  timestamp with time zone DEFAULT now(),
  venue_id    integer,
  location_id integer,
  meeting_url text
);

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;

GRANT ALL ON SEQUENCE public.events_id_seq TO anon;

GRANT ALL ON SEQUENCE public.events_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.events_id_seq TO service_role;

ALTER TABLE public.events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events
  ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_slug_key UNIQUE (slug);

GRANT ALL ON public.events TO anon;

GRANT ALL ON public.events TO authenticated;

GRANT ALL ON public.events TO service_role;

CREATE TRIGGER "rebuild-on-event-change"
  AFTER INSERT OR DELETE OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request('https://api.netlify.com/build_hooks/69ef16eb933e0dd40db64ab7', 'POST', '{"Content-type":"application/json"}', '{}', '5000');

CREATE POLICY "public read events" ON public.events
  FOR SELECT
  USING (true);

CREATE TABLE public.locations (
  id   integer DEFAULT nextval('public.locations_id_seq'::regclass) NOT NULL,
  name text    NOT NULL
);

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;

GRANT ALL ON SEQUENCE public.locations_id_seq TO anon;

GRANT ALL ON SEQUENCE public.locations_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.locations_id_seq TO service_role;

ALTER TABLE public.locations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.locations
  ADD CONSTRAINT locations_name_key UNIQUE (name);

ALTER TABLE public.locations
  ADD CONSTRAINT locations_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);

GRANT ALL ON public.locations TO anon;

GRANT ALL ON public.locations TO authenticated;

GRANT ALL ON public.locations TO service_role;

CREATE POLICY "Enable read access for all users" ON public.locations
  FOR SELECT
  USING (true);

CREATE TABLE public.members (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  email             text                     NOT NULL,
  password_hash     text                     NOT NULL,
  created_at        timestamp with time zone DEFAULT now(),
  is_admin          boolean                  DEFAULT false NOT NULL,
  username          text                     NOT NULL,
  email_verified_at timestamp with time zone,
  full_name         text,
  display_full_name boolean                  DEFAULT false NOT NULL
);

ALTER TABLE public.members
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.members
  ADD CONSTRAINT members_email_key UNIQUE (email);

ALTER TABLE public.members
  ADD CONSTRAINT members_pkey PRIMARY KEY (id);

GRANT ALL ON public.members TO anon;

GRANT ALL ON public.members TO authenticated;

GRANT ALL ON public.members TO service_role;

CREATE UNIQUE INDEX members_username_lower_idx ON public.members (lower(username));

CREATE TABLE public.posts (
  id         integer                  DEFAULT nextval('public.posts_id_seq'::regclass) NOT NULL,
  title      text                     NOT NULL,
  slug       text                     NOT NULL,
  author     text                     NOT NULL,
  date       timestamp with time zone NOT NULL,
  body       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;

GRANT ALL ON SEQUENCE public.posts_id_seq TO anon;

GRANT ALL ON SEQUENCE public.posts_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.posts_id_seq TO service_role;

ALTER TABLE public.posts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_slug_key UNIQUE (slug);

GRANT ALL ON public.posts TO anon;

GRANT ALL ON public.posts TO authenticated;

GRANT ALL ON public.posts TO service_role;

CREATE TABLE public.venues (
  id          integer DEFAULT nextval('public.venues_id_seq'::regclass) NOT NULL,
  name        text    NOT NULL,
  url         text,
  location_id integer NOT NULL
);

ALTER SEQUENCE public.venues_id_seq OWNED BY public.venues.id;

GRANT ALL ON SEQUENCE public.venues_id_seq TO anon;

GRANT ALL ON SEQUENCE public.venues_id_seq TO authenticated;

GRANT ALL ON SEQUENCE public.venues_id_seq TO service_role;

ALTER TABLE public.venues
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);

ALTER TABLE public.venues
  ADD CONSTRAINT venues_name_location_id_key UNIQUE (name, location_id);

ALTER TABLE public.venues
  ADD CONSTRAINT venues_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);

GRANT ALL ON public.venues TO anon;

GRANT ALL ON public.venues TO authenticated;

GRANT ALL ON public.venues TO service_role;

CREATE POLICY "public read venues" ON public.venues
  FOR SELECT
  USING (true);
