-- Rethink of #57/#69: club association and email opt-in are two separate
-- decisions, not one. `club_members` already existed and stays as-is (which
-- clubs a member is associated with — identity, shown on profile); this adds
-- the other half, a single flag for whether they want event emails at all.
-- It is NOT per-club: if on, it applies to every club the member is
-- associated with via `club_members` (see #55's Mailchimp sync); a member
-- can't opt into one associated club's emails and out of another's.
--
-- Default true preserves today's live behaviour (every existing member is
-- already Mailchimp-tagged for every club they're in, via #64) — this
-- column governs that tagging going forward, so flipping the default to
-- false here would silently unsubscribe everyone.
alter table public.members
  add column receive_club_emails boolean not null default true;
