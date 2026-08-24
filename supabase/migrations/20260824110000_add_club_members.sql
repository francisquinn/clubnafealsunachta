-- Issue #38: club membership/subscription.
--
-- A member has one global account (browsing/RSVP already work site-wide,
-- regardless of this table) but can register to specific clubs to receive
-- that club's news/updates. Registering is what would drive per-club
-- communications later (e.g. Mailchimp segmentation by city, see #55) — not
-- built here, this issue is schema + registration only.
create table public.club_members (
  member_id  uuid    not null references public.members(id) on delete cascade,
  club_id    integer not null references public.clubs(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (member_id, club_id)
);

alter table public.club_members enable row level security;
