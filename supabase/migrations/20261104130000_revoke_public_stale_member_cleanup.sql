-- Issue #212: delete_stale_unverified_members() was granted to anon and
-- authenticated (20260817135719), so anyone with the public key could call
-- it through the API. Only pg_cron runs it, as postgres, so revoking the
-- public grants breaks nothing. Postgres grants execute to public by
-- default, so that is revoked too.

revoke all on function public.delete_stale_unverified_members() from public, anon, authenticated;
