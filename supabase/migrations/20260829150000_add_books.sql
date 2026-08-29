-- Issue #30: reading page with recommended books.
--
-- Books shown on the public reading page give new and prospective members a
-- quick sense of what the club reads and discusses. A flat standalone list:
-- no linkage to past events/discussions yet. `title`, `author` and `blurb`
-- (a short "why it's here") are the required content; `cover_image_url` is
-- optional metadata entered by hand today — auto-fetching from a books API is
-- a possible later enhancement, not part of this change. `slug` mirrors the
-- posts pattern so admin create/edit routes can key off it like /posts do.

CREATE SEQUENCE public.books_id_seq AS integer;

CREATE TABLE public.books (
  id              integer                  DEFAULT nextval('public.books_id_seq'::regclass) NOT NULL,
  title           text                     NOT NULL,
  author          text                     NOT NULL,
  slug            text                     NOT NULL,
  blurb           text                     NOT NULL,
  cover_image_url text,
  created_at      timestamp with time zone DEFAULT now()
);

ALTER SEQUENCE public.books_id_seq OWNED BY public.books.id;

GRANT ALL ON SEQUENCE public.books_id_seq TO anon;
GRANT ALL ON SEQUENCE public.books_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.books_id_seq TO service_role;

ALTER TABLE public.books
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.books
  ADD CONSTRAINT books_pkey PRIMARY KEY (id);

ALTER TABLE public.books
  ADD CONSTRAINT books_slug_key UNIQUE (slug);

GRANT ALL ON public.books TO anon;
GRANT ALL ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;

-- Books are public reading-page content shown to anonymous visitors, so the
-- whole table is readable without any session — same as events/venues/clubs.
CREATE POLICY "public read books" ON public.books
  FOR SELECT USING (true);