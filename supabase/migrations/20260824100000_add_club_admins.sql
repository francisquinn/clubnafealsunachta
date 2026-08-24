-- Issue #37: per-club admin roles.
--
-- `members.is_admin` stays as the super-admin override (manages every club).
-- This new join table layers per-club admin rights on top: a member can be
-- an admin of one or more specific clubs without being a super admin.
create table public.club_admins (
  member_id  uuid    not null references public.members(id) on delete cascade,
  club_id    integer not null references public.clubs(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (member_id, club_id)
);

alter table public.club_admins enable row level security;

-- Backfill: every member who is currently a super admin also gets a
-- club_admins row for Trieste, so nothing regresses if super-admin is ever
-- removed from someone later — same backfill pattern as #34/#36.
do $$
declare
  trieste_id integer;
begin
  select id into trieste_id from public.clubs where slug = 'trieste';

  if trieste_id is null then
    raise exception 'Backfill expects a club with slug ''trieste'' to exist (every current admin is scoped to that club). Adjust this migration before running it against an environment without that club.';
  end if;

  insert into public.club_admins (member_id, club_id)
  select id, trieste_id from public.members where is_admin = true
  on conflict (member_id, club_id) do nothing;
end $$;
