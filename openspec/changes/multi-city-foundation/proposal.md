## Why

CNF is currently modeled as a single club in a single city (Trieste). Francis
wants to let other CNF chapters open in other cities — one shared brand, one
shared membership (join once, attend/browse any chapter), not independent
white-label clubs. The current schema can't express this: `locations`
conflates real cities with a fake "Online" row, and there is no concept of a
"club" distinct from a city at all. This change lays the two foundational
schema pieces the rest of the multi-city work (per-club admin, membership,
routing, scoped actions) depends on: a clean `cities` table and an explicit
`events.is_online` flag. Scoped to GitHub issues #32 and #33 only — the first
two, unblocked steps in the multi-city epic (#35).

## What Changes

- Rename `locations` → `cities`, containing real cities only. Existing rows
  that represent the "Online" pseudo-location are dropped from this table
  once `is_online` (below) takes over that meaning.
- `venues.location_id` → `venues.city_id`, referencing the new `cities` table.
- Add `events.is_online` (boolean). An event is either tied to a venue (which
  has a city) or marked online — no more sentinel "Online" row in the
  location table.
- **BREAKING**: any code or query that reads `events.location_id` pointing at
  the "Online" sentinel row must switch to checking `events.is_online`
  instead. This proposal removes that sentinel row as part of the migration.
- Backfill: every existing event currently pointing at the "Online" sentinel
  location gets `is_online = true` and `location_id` cleared; all other
  events keep their real venue/city linkage untouched.

## Capabilities

### New Capabilities
- `event-location`: covers how an event's location is represented — either a
  real venue in a real city, or online — replacing the old single
  `locations` table that conflated both cases.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities predate this change)

## Impact

- **Schema**: new migration(s) under `supabase/migrations/` — rename
  `locations` table to `cities`, rename `venues.location_id` to
  `venues.city_id` (FK to `cities`), add `events.is_online boolean not null
  default false`, backfill, then drop the old sentinel "Online" city row.
- **Code**: `src/actions/events.ts` (event create/update, currently sets
  `location_id`), `src/loaders/` (event/venue content loaders), any
  `getLocations`/`getVenues` action and their call sites, `events.astro`
  listing page's location filter, event detail page's online/venue branch
  (`src/pages/events/[slug].astro`) which currently branches on
  `event.data.meetingUrl` presence but will now also have `is_online`
  available as the authoritative signal.
- **No admin-gating changes**: `getLocations`/equivalent stays public read
  data per existing convention; nothing here changes who can write events.
- **Blocks unblocked by this change**: #34 (`clubs` table), and everything
  downstream in the epic (#36–#40) that's blocked by #34.
