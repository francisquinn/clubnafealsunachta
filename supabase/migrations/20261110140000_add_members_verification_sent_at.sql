-- When the last verification email went out, so resending a link can be
-- rate-limited per member (#220). Null for members who verified before this
-- column existed or were auto-verified.
alter table public.members add column verification_sent_at timestamptz;

-- Count the 30 days from the latest link rather than from signup, so a link
-- resent on day 29 can't outlive the account it confirms. Capped at 33 days
-- from signup (a 3-day link's lifetime past day 30), so resending can't keep
-- an unconfirmed signup, and the address it holds, alive for ever.
-- CREATE OR REPLACE keeps the grants revoked in 20261104130000.
create or replace function public.delete_stale_unverified_members()
returns void
language sql
as $$
  delete from members
  where email_verified_at is null
    and least(
      greatest(created_at, verification_sent_at) + interval '30 days',
      created_at + interval '33 days'
    ) < now();
$$;
