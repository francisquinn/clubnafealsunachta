-- Follow-up to #30's books table (20260829150000_add_books.sql), reshaping
-- it per Francis's call on the reading page's actual scope:
--   - `blurb` is dropped: the reading page is a straight visual "books I've
--     read and recommend" list, not per-book written commentary.
--   - `goodreads_url` replaces the dropped commentary as the one piece of
--     "more info" a visitor gets — a manual link, since Goodreads has had no
--     public API since 2020 and can't be looked up programmatically.
--   - `cover_image_url` stays the same column/shape; only *how* it gets
--     populated changes (admin upload instead of a pasted URL), handled in
--     src/actions/books.ts.

ALTER TABLE public.books DROP COLUMN blurb;
ALTER TABLE public.books ADD COLUMN goodreads_url text;

-- Book covers: same public-read/service-role-write shape as the books table
-- itself. Admin uploads go through supabaseAdmin (service role), which
-- bypasses storage RLS the same way it bypasses table RLS elsewhere in this
-- codebase, so no insert/update/delete policy is needed here.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read book covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'book-covers');
