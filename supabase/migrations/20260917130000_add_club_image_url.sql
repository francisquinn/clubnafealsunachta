-- #86: club membership badge on the profile page. The badge shows a photo
-- representing the chapter (e.g. Piazza Unità for Trieste) instead of an
-- icon/illustration — decided after a couple of rejected illustrated
-- directions. `image_url` mirrors `books.cover_image_url` /
-- `members.avatar_url`: a plain public Storage URL, no crop/border baked
-- in — the circular mask + gold ring are CSS on the frontend
-- (`.cnf-club-badge`), same split `.cnf-avatar` already uses for member
-- photos.
ALTER TABLE public.clubs ADD COLUMN image_url text;

-- Same public-read/service-role-write shape as book-covers
-- (20260910160000_reshape_books_add_covers_bucket.sql). No upload UI exists
-- yet — a club's image is seeded directly (service role), same posture as
-- club_admins/club_members shipping without an assignment UI.
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-images', 'club-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read club images" ON storage.objects
  FOR SELECT USING (bucket_id = 'club-images');
