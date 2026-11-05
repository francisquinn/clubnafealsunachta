-- Issue #211: chapter membership only comes from the chapter page's "Join
-- chapter" button, and chapter event emails only go to members who tick the
-- box in the welcome modal (#205 sends them).
--
-- Every existing membership is cleared: the August backfill
-- (20260824120000) put every member in Trieste before anyone could choose,
-- so none of these rows is proof of consent. Members rejoin from the
-- chapter page.
--
-- The email preference moves from one flag per member to one per chapter
-- membership, off until the member opts in. members.receive_chapter_emails
-- is dropped: nothing reads it, and every row is false since 20260909160000.
--
-- One transaction, so a failed step can't leave the memberships deleted
-- with the schema unchanged when this is run by hand.

begin;

delete from public.chapter_members;

alter table public.chapter_members
  add column emails_enabled boolean not null default false;

alter table public.members
  drop column receive_chapter_emails;

commit;

notify pgrst, 'reload schema';
