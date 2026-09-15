-- #70: member avatars, with self-serve upload from /profile/edit.

ALTER TABLE public.members ADD COLUMN avatar_url text;

-- Avatars: same public-read/service-role-write shape as book-covers
-- (20260910160000_reshape_books_add_covers_bucket.sql) — a member's own
-- upload goes through supabaseAdmin (service role) in src/actions/avatar.ts,
-- which bypasses storage RLS the same way it bypasses table RLS elsewhere in
-- this codebase, so no insert/update/delete policy is needed here. Public
-- read is required since avatars render for anonymous visitors too (the
-- event page's "Hosted by" byline is public, not just logged-in members).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
