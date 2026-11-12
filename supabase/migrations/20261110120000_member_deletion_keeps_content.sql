-- Issue #210: members can delete their own account. Their posts and events
-- stay on the site under "Former member", so the author columns become
-- nullable and are cleared when the member row goes. Additive: existing rows
-- keep their author, and the old code never writes a null.

alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references public.members(id) on delete set null;

alter table public.events alter column created_by drop not null;
alter table public.events drop constraint events_created_by_fkey;
alter table public.events
  add constraint events_created_by_fkey
  foreign key (created_by) references public.members(id) on delete set null;
