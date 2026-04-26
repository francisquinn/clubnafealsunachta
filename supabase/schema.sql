CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  city TEXT DEFAULT 'Trieste',
  location_name TEXT,
  location_url TEXT,
  slug TEXT UNIQUE NOT NULL,
  instagram TEXT,
  facebook TEXT,
  meetup TEXT,
  description TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);