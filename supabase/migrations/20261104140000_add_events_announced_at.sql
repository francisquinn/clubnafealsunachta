-- Issue #205: the site emails a new event to its chapter's opted-in members
-- once the event's page is live (the netlify/functions/deploy-succeeded
-- function). announced_at marks events that have been emailed,
-- or claimed for emailing, so a later deploy never sends them again.
--
-- Every existing event is stamped as announced, so the first deploy after
-- this doesn't email old events.

alter table public.events
  add column announced_at timestamp with time zone;

update public.events set announced_at = now();
