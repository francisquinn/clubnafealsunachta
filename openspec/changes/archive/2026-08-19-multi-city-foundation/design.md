## Context

Current schema (`supabase/migrations/20260817135719_remote_schema.sql`):
`locations(id, name unique)` holds real cities *and* a row named `"Online"`;
`venues(id, name, url, location_id → locations)`; `events(..., venue_id →
venues, location_id → locations, meeting_url)`. An event can point at
`location_id` directly (used today only for the "Online" row) or indirectly
via `venue_id → venues.location_id` (a real venue in a real city).

"Online-ness" is currently determined multiple different, inconsistent ways
across the codebase (found during implementation — two more call sites than
originally scoped here, `admin/events.astro` and `EventCard.tsx`):
- Admin form (`EventForm.tsx`): `locations.find(id).name === "Online"`
- Public event list filter (`EventList.tsx`): presence of `meetingUrl`
- Event detail page (`[slug].astro`): presence of `event.data.meetingUrl`
- Admin events list (`admin/events.astro`): presence of `event.data.meetingUrl`
- Event card (`EventCard.tsx`, used on the homepage/past-events grid):
  presence of `event.meetingUrl`

`meeting_url` itself is a legitimate, separate field (the actual join link)
and is out of scope — only the *classification* signal changes.

See proposal.md for motivation (multi-city chapters, `cities` needs to hold
real cities only for #34's `clubs.city_id` to make sense).

## Goals / Non-Goals

**Goals:**
- One authoritative, explicit signal (`events.is_online`) for whether an
  event is online — replacing all three inconsistent checks above.
- `cities` (renamed from `locations`) contains only real cities, unblocking
  #34 (`clubs.city_id → cities`).
- Zero data loss / zero broken links for existing events during migration.

**Non-Goals:**
- No changes to `meeting_url` itself, or to how the join link is displayed.
- No changes to who can create/edit events (`requireAdmin` gating untouched).
- Not building `clubs`, `club_admins`, or routing — that's #34 onward.
- Not changing the admin form's visual layout beyond what dropping the
  "Online" location entry requires (see Decisions).

## Decisions

**1. Add `events.is_online boolean not null default false` rather than
making it nullable or an enum.** A plain boolean is the actual domain shape
(online XOR venue-based) and matches the existing `is_admin`/
`display_full_name` boolean convention already used elsewhere in this
schema. An enum would be over-engineering for a two-state field.

**2. Rename in place (`locations` → `cities`, `venues.location_id` →
`venues.city_id`) rather than create a new table and migrate data across.**
Same shape, same keys, only the concept narrows (real cities only, "Online"
row removed) and the name changes to match. A rename preserves existing
foreign key relationships and row ids with minimal migration risk, versus a
parallel-table approach that would need a cutover step for no benefit here.

**3. `events.location_id` is dropped entirely, not renamed.** Today it's set
directly only for the "Online" sentinel case (see `events.ts`) — real venues
already carry their own city via `venue_id → venues.city_id`, so
`events.location_id` was doing double duty as an ad-hoc "online" flag. Once
`is_online` takes over that job, the column has no remaining purpose;
keeping it around as dead data invites exactly the kind of ambiguous
"online" signal this change is trying to eliminate.

**4. Constrain online/venue exclusivity at the database level with a CHECK
constraint**, not just in application code:
```sql
alter table events add constraint events_online_xor_venue
  check (is_online = false or venue_id is null);
```
Application code (`createEvent`/`updateEvent`) is the primary enforcement
point, but a CHECK constraint is cheap insurance against future direct-SQL
edits or a missed code path drifting into an inconsistent state — consistent
with this project's general preference for enforcing invariants close to the
data (e.g. FK constraints already used throughout).

**5. Admin form drops the "Online" entry from the city dropdown entirely**,
replaced by a separate "This event is online" checkbox (already how
`isOnline` branches the form's rendering today — `EventForm.tsx` already has
an `isOnline`-driven conditional, it's just currently derived from the
location name instead of being the source of truth itself). This directly
follows from removing the "Online" pseudo-city.

**6. Admin form drops the standalone "City" dropdown entirely — venue
selection no longer has a city pre-filter step.** Implementing task 2.1
surfaced a real gap: today an admin can pick a city with venue left as
"— none —" (venue TBD, city known), which sets `events.location_id`
directly. Once city is only reachable through a venue (Decision 3), that
"city known, no venue" state has nowhere to live. The eventual fix is
admins scoped to a club/city (#37, needs #34's `clubs`/`club_admins` first)
so city is implicit from the admin's club — out of scope here. For now,
with #34/#37 not yet built and only one real city existing, the chosen
interim shape points the same direction without depending on them: the
Venue field becomes a single dropdown of **all** venues (today
indistinguishable from "Trieste's venues" since there's only one city) plus
"New venue…"; picking "New venue…" asks for Name, URL, and **City**
(dropdown of real cities) together, since a venue must have a city
(Requirement: "A venue belongs to a real city"). This removes the "city
chosen, venue TBD" state outright — city is only ever chosen at
venue-creation time, never on its own — and needs no rework when #34/#37
land: "all venues" narrows to "venues in the admin's club" as a filter
added on top, not a reshape of this flow.

One further simplification this enables: because the venue dropdown now
carries `venue_id` directly, `createEvent`/`updateEvent` use that id as-is
for an existing venue instead of re-upserting it by
`(name, city_id)` on every save — the upsert-by-name path is now used only
for the "New venue…" case, where no id exists yet.

## Risks / Trade-offs

- **[Risk]** Backfill must correctly identify every event currently using
  the "Online" sentinel before that row is dropped, or those events lose
  their online status silently.
  → **Mitigation**: migration sets `is_online = true` for every event whose
  `location_id` matches the sentinel row's id, and `venue_id is null`, in
  the same transaction that drops the sentinel row — never a separate,
  later step where the sentinel could already be gone.

- **[Risk]** Three call sites currently derive "online" three different
  ways (see Context); missing one during implementation leaves an
  inconsistency (e.g. detail page still branches on `meetingUrl` while the
  list now trusts `is_online`).
  → **Mitigation**: tasks.md enumerates all three call sites explicitly;
  each switches to reading `is_online` from the loader/query result.

- **[Trade-off]** Dropping `events.location_id` instead of keeping it as a
  deprecated column is a one-way migration (BREAKING, per proposal.md). This
  is acceptable because it's the only column whose sole purpose was the
  sentinel-row hack this change removes; keeping dead columns around adds
  more long-term confusion than a clean cut does for a project at this
  scale (personal project, single admin, no external API consumers).

## Migration Plan

1. New migration file: create `cities` alongside the existing `locations`
   is not needed — this is a rename, not a parallel table (see Decision 2).
   `ALTER TABLE locations RENAME TO cities;`
   `ALTER TABLE venues RENAME COLUMN location_id TO city_id;` (FK follows
   automatically in Postgres on column rename).
2. Same migration: `ALTER TABLE events ADD COLUMN is_online boolean NOT
   NULL DEFAULT false;`
3. Same migration, data step: `UPDATE events SET is_online = true WHERE
   location_id = (SELECT id FROM cities WHERE name = 'Online');`
4. Same migration: add the CHECK constraint from Decision 4.
5. Same migration: `ALTER TABLE events DROP COLUMN location_id;`, then
   `DELETE FROM cities WHERE name = 'Online';`
6. Update `src/actions/events.ts` (drop `location_id` handling, add
   `is_online` handling, keep `venue_id` upsert path for non-online events),
   `src/loaders/events.ts` (surface `is_online` instead of deriving from
   `meetingUrl`/location name), `EventForm.tsx` (checkbox instead of
   "Online" dropdown entry), `EventList.tsx` and `[slug].astro` (read
   `is_online` instead of `meetingUrl` presence for classification).
7. Apply via `supabase db push` per project convention (real migration, not
   hand-edited `schema.sql`).

**Rollback**: since steps 1–5 run as one migration, a failed apply rolls
back atomically (Postgres DDL transaction). Rolling back *after* a
successful deploy would need a reverse migration (re-add `location_id`,
re-insert the "Online" row, drop `is_online`) — acceptable for a personal
project with no other environments to keep in sync, and not expected to be
needed given the scenarios in `specs/event-location/spec.md` cover the
migration behavior directly.
