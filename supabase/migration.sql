-- Step 1: Create venues table
CREATE TABLE venues (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url  TEXT,
  city TEXT NOT NULL,
  UNIQUE(name, city)
);

-- Step 2: Populate venues from existing event data
-- DISTINCT ON (location_name, city) picks one row per venue; prefer non-null URL
INSERT INTO venues (name, url, city)
SELECT DISTINCT ON (location_name, city) location_name, location_url, city
FROM events
WHERE location_name IS NOT NULL
ORDER BY location_name, city, location_url NULLS LAST;

-- Step 3: Add venue_id column (nullable during migration)
ALTER TABLE events ADD COLUMN venue_id INTEGER REFERENCES venues(id);

-- Step 4: Backfill venue_id on all existing events
UPDATE events e
SET venue_id = v.id
FROM venues v
WHERE e.location_name = v.name
  AND e.city = v.city;

-- Verify backfill before proceeding (should return 0 rows):
-- SELECT id, name FROM events WHERE venue_id IS NULL AND location_name IS NOT NULL;

-- Step 5: Drop old columns
ALTER TABLE events DROP COLUMN location_name;
ALTER TABLE events DROP COLUMN location_url;
ALTER TABLE events DROP COLUMN city;
