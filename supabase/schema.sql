CREATE TABLE members (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username          TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  is_admin          BOOLEAN DEFAULT FALSE NOT NULL,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case-insensitive uniqueness: display keeps the typed casing, but
-- "JohnDoe" and "johndoe" can't both be registered.
CREATE UNIQUE INDEX members_username_lower_idx ON members (lower(username));

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE TABLE locations (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO locations (name) VALUES ('Trieste'), ('Online');

CREATE TABLE venues (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT,
  location_id INTEGER REFERENCES locations(id),
  UNIQUE(name, location_id)
);

CREATE TABLE posts (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  author     TEXT NOT NULL,
  date       TIMESTAMP WITH TIME ZONE NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE events (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  date        TIMESTAMP WITH TIME ZONE NOT NULL,
  location_id INTEGER REFERENCES locations(id),
  venue_id    INTEGER REFERENCES venues(id),
  slug        TEXT UNIQUE NOT NULL,
  instagram   TEXT,
  facebook    TEXT,
  meetup      TEXT,
  description TEXT,
  summary     TEXT,
  meeting_url TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data retention: an unverified signup never became a real member, so
-- there's no ongoing purpose to justify keeping the email + password hash
-- (GDPR storage limitation, Art. 5(1)(e)). Admin-created members are
-- auto-verified on insert (see createAccount(..., autoVerify)), so this
-- only ever touches abandoned public sign-ups.
CREATE OR REPLACE FUNCTION delete_stale_unverified_members()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM members
  WHERE email_verified_at IS NULL
    AND created_at < NOW() - INTERVAL '30 days';
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'delete-stale-unverified-members',
  '0 3 * * *', -- daily at 03:00 UTC
  $$SELECT delete_stale_unverified_members()$$
);
