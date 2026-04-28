CREATE TABLE venues (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url  TEXT,
  city TEXT NOT NULL,
  UNIQUE(name, city)
);

CREATE TABLE events (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  date        TIMESTAMP WITH TIME ZONE NOT NULL,
  venue_id    INTEGER REFERENCES venues(id),
  slug        TEXT UNIQUE NOT NULL,
  instagram   TEXT,
  facebook    TEXT,
  meetup      TEXT,
  description TEXT,
  summary     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
