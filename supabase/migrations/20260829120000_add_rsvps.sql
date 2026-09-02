-- Issue #27: RSVP for event availability.
--
-- A member declares their expected attendance at a specific event. One row
-- per (member, event): a member revisiting the event page changes their own
-- status in place rather than stacking duplicate rows.
--
-- `status` is restricted to the three states the public page can render
-- ("going", "maybe", "not going"); the CHECK constraint keeps a bad write
-- (from a stale client or a future refactor) from ever landing. `updated_at`
-- is the last time the status was set/changed — used for auditing and to
-- surface "most recent RSVPs" if that ever becomes a list feature.
create table public.rsvps (
  member_id  uuid    not null references public.members(id) on delete cascade,
  event_id   integer not null references public.events(id) on delete cascade,
  status     text    not null check (status in ('going', 'maybe', 'not_going')),
  updated_at timestamp with time zone default now(),
  primary key (member_id, event_id)
);

-- Lookups for a single event's RSVPs (the event page and both RSVP actions)
-- filter on event_id alone, which the composite PK can't serve.
create index rsvps_event_id_idx on public.rsvps (event_id);

alter table public.rsvps enable row level security;