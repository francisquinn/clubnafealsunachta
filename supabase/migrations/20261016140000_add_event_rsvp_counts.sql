-- Issue #182: RSVP counts per event, counted in the database. The build-time
-- loader and the cards' getGoingCounts action used to fetch one row per RSVP
-- and tally in JS, which the Data API's max_rows (1000) silently cuts short.
-- This returns one row per event instead, and only events with at least one
-- RSVP (callers treat a missing event as all zeros).
--
-- event_slugs null means every event (the loader); a list limits it to those
-- events (the cards). Invoker rights, so the rsvps RLS still applies: only
-- the service role sees any rows, and execute is limited to it anyway.
create function public.event_rsvp_counts(event_slugs text[] default null)
returns table (event_id integer, slug text, going integer, maybe integer, not_going integer)
language sql
stable
set search_path = ''
as $$
  select
    e.id,
    e.slug,
    (count(*) filter (where r.status = 'going'))::integer,
    (count(*) filter (where r.status = 'maybe'))::integer,
    (count(*) filter (where r.status = 'not_going'))::integer
  from public.rsvps r
  join public.events e on e.id = r.event_id
  where event_slugs is null or e.slug = any (event_slugs)
  group by e.id, e.slug;
$$;

revoke execute on function public.event_rsvp_counts(text[]) from public, anon, authenticated;
grant execute on function public.event_rsvp_counts(text[]) to service_role;
