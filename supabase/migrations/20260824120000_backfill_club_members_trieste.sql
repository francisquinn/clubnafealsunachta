-- Issue #38 follow-up: the registration UI was pulled back out of this PR
-- (no self-serve way to join a club yet), so every existing member is
-- backfilled onto Trieste — the only real club — to preserve today's
-- behaviour (everyone gets the one club's updates) until real registration
-- ships. Same defensive pattern as the #34/#36/#37 seed/backfill migrations.
do $$
declare
  trieste_id integer;
begin
  select id into trieste_id from public.clubs where slug = 'trieste';

  if trieste_id is null then
    raise exception 'Backfill expects a club with slug ''trieste'' to exist. Adjust this migration before running it against an environment without that club.';
  end if;

  insert into public.club_members (member_id, club_id)
  select id, trieste_id from public.members
  on conflict (member_id, club_id) do nothing;
end $$;
