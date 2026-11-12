-- When the member last asked for an email-change link, so the request can be
-- rate-limited (#219): without it, anyone with an account could send the
-- club's "Confirm your new email" message to any address on a loop.
alter table public.members add column email_change_sent_at timestamptz;
