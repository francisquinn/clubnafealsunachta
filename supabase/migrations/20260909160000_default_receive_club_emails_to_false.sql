-- Flip #57/#69's email opt-in to explicit: nobody has actually gone through
-- a real opt-in flow yet (the feature was only just built, still unreleased
-- — this PR hasn't merged to main), so the `true` default from the previous
-- migration doesn't reflect anyone's real choice. Members must now actively
-- check the box and save to start receiving club emails.
--
-- Applies retroactively, not just to future rows: every existing member
-- goes to false too, since none of them ever really opted in.
alter table public.members
  alter column receive_club_emails set default false;

update public.members
  set receive_club_emails = false;
