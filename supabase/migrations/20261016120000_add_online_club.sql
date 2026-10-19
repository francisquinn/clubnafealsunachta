-- Issue #177: Online becomes a chapter of its own instead of online events
-- being "cross-chapter" (club_id null, shown under every club — #60).
-- Adds the club and moves every online event onto it, so /online/events
-- and its feed pick them up — including any pinned to a city club (none
-- today), since every online event belongs to Online.
do $$
declare
  online_id integer;
begin
  insert into public.clubs (slug, name)
  values ('online', 'Online')
  on conflict (slug) do nothing;

  select id into online_id from public.clubs where slug = 'online';

  update public.events
  set club_id = online_id
  where is_online = true;
end $$;
