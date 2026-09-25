-- #95: one cover image per blog post, shown between the byline and the body
-- and reused as the post's og:image. Same shape as book covers
-- (20260910160000_reshape_books_add_covers_bucket.sql): a nullable URL
-- column plus a public-read bucket that only the service role writes to.

ALTER TABLE public.posts ADD COLUMN cover_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-covers', 'post-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read post covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-covers');
