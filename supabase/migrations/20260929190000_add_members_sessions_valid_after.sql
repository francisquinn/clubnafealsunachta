-- Session revocation. Sessions are stateless 30-day JWTs, so on their own
-- they can't be cut off before they expire. A session token is only honoured
-- if it was issued at or after this timestamp (NULL = no cutoff). Set when a
-- member resets a forgotten password, so a session held by whoever had access
-- to the account before the reset stops working. See verifySession in
-- src/lib/auth.ts.
ALTER TABLE public.members ADD COLUMN sessions_valid_after timestamptz;
