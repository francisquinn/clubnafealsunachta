-- When the last verification email went out, so resending a link can be
-- rate-limited per member (#220). Null for members who verified before this
-- column existed or were auto-verified.
alter table public.members add column verification_sent_at timestamptz;
