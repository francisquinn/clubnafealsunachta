-- Issue #29: link post authors and event creators to members
--
-- Posts: replace free-text `author` with a proper FK to members.
alter table public.posts add column author_id uuid references public.members(id);

-- Events: add `created_by` FK to members.
alter table public.events add column created_by uuid references public.members(id);

-- Backfill: Francis has been the only post author and event creator to
-- date (confirmed 2026-08-18), so both columns default every existing row
-- to his account. Resolved case-insensitively by username, matching the
-- app's own uniqueness rule (members_username_lower_idx is on
-- lower(username)) rather than a case-sensitive literal match. Raises a
-- clear error if this is run against an environment without that member,
-- instead of silently leaving the columns null and failing opaquely at
-- the `set not null` step below.
do $$
declare
  francis_id uuid;
begin
  select id into francis_id from public.members where lower(username) = lower('ephcue');

  if francis_id is null then
    raise exception 'Backfill expects a member with username ''ephcue'' to exist (Francis has been the only post author/event creator so far). Adjust this migration before running it against an environment without that member.';
  end if;

  update public.posts set author_id = francis_id where author_id is null;
  update public.events set created_by = francis_id where created_by is null;
end $$;

alter table public.posts alter column author_id set not null;
alter table public.posts drop column author;

alter table public.events alter column created_by set not null;
