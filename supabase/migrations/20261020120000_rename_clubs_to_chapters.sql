-- Issue #178: the site says "chapter", so the data model does too. Renames
-- only, no data changes: Postgres carries grants, foreign keys, RLS and
-- policies over to the renamed tables and columns, and column defaults
-- reference the sequence by oid, so the sequence rename is safe.
--
-- The matching code ships in the same deploy: run this right before the
-- epic's merge, so the window is only the Netlify build. Until the new
-- code is live, the old code still queries clubs/club_id/club_admins, so
-- event and venue saves fail, chapter admins lose /admin, membership saves
-- fail, and any build-hook rebuild fails. Public pages are prebuilt and
-- keep working. If the deploy has to be rolled back, reverse these renames
-- too.

-- Tables
alter table public.clubs rename to chapters;
alter table public.club_admins rename to chapter_admins;
alter table public.club_members rename to chapter_members;

-- Columns
alter table public.events rename column club_id to chapter_id;
alter table public.venues rename column club_id to chapter_id;
alter table public.chapter_admins rename column club_id to chapter_id;
alter table public.chapter_members rename column club_id to chapter_id;
alter table public.members rename column receive_club_emails to receive_chapter_emails;

-- Sequence
alter sequence public.clubs_id_seq rename to chapters_id_seq;

-- Constraints (renaming a primary key or unique constraint renames its index)
alter table public.chapters rename constraint clubs_pkey to chapters_pkey;
alter table public.chapters rename constraint clubs_slug_key to chapters_slug_key;
alter table public.chapters rename constraint clubs_slug_lowercase_check to chapters_slug_lowercase_check;

alter table public.events rename constraint events_club_id_fkey to events_chapter_id_fkey;

alter table public.venues rename constraint venues_club_id_fkey to venues_chapter_id_fkey;
alter table public.venues rename constraint venues_name_club_id_key to venues_name_chapter_id_key;

alter table public.chapter_admins rename constraint club_admins_pkey to chapter_admins_pkey;
alter table public.chapter_admins rename constraint club_admins_member_id_fkey to chapter_admins_member_id_fkey;
alter table public.chapter_admins rename constraint club_admins_club_id_fkey to chapter_admins_chapter_id_fkey;

alter table public.chapter_members rename constraint club_members_pkey to chapter_members_pkey;
alter table public.chapter_members rename constraint club_members_member_id_fkey to chapter_members_member_id_fkey;
alter table public.chapter_members rename constraint club_members_club_id_fkey to chapter_members_chapter_id_fkey;

-- Policies
alter policy "public read clubs" on public.chapters rename to "public read chapters";

-- PostgREST caches the schema; reload it so the API sees the new names.
notify pgrst, 'reload schema';
