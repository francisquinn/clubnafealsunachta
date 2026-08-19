## 1. Migration

- [x] 1.1 New migration file under `supabase/migrations/`: rename
      `locations` → `cities`, rename `venues.location_id` →
      `venues.city_id`, rename the `events_location_id_fkey`/
      `locations_name_key` constraints to match (or let Postgres's
      auto-generated names follow the rename — verify either way).
- [x] 1.2 Same migration: add `events.is_online boolean not null default
      false`.
- [x] 1.3 Same migration, data step: set `is_online = true` for every event
      whose `location_id` matched the "Online" row, before that row is
      dropped.
- [x] 1.4 Same migration: add `events_online_xor_venue` CHECK constraint
      (`is_online = false or venue_id is null`).
- [x] 1.5 Same migration: drop `events.location_id`, then delete the
      "Online" row from `cities`.
- [x] 1.6 Applied via `supabase db push` (Francis ran it directly — the
      classifier blocks destructive DB writes from being run
      automatically). Confirmed via `--dry-run` before and after: pending
      beforehand, "Remote database is up to date" afterward.

## 2. Server code

- [x] 2.1 `src/actions/events.ts`: `createEvent`/`updateEvent` — replace
      `location_id` handling with `is_online` (boolean form field), keep
      the venue upsert path for non-online events using `city_id` instead
      of `location_id`. Implemented via a shared `resolveVenue()` helper:
      an existing venue is looked up by the `venue_id` the form now sends
      directly; a "New venue…" submission (name + city, no id yet) is
      upserted, matching the form redesign in task 3.1.
- [x] 2.2 `src/actions/events.ts`: renamed `getLocations` → `getCities`,
      reading from `cities`; all call sites updated
      (`src/actions/index.ts`, `EventForm.tsx`, tests, mocks).
- [x] 2.3 `src/loaders/events.ts`: surfaces `is_online` on loaded event
      data; `location` (city) is now derived via `venue.city_id → cities`
      instead of a direct `events.location_id` lookup.

## 3. UI

- [x] 3.1 `EventForm.tsx`: replaced the "Online" city-dropdown entry with a
      dedicated "This event is online" checkbox (reusing the shared
      `Checkbox` component), and dropped the standalone city dropdown
      entirely (see design.md Decision 6): the Venue field is one dropdown
      of all venues + "New venue…"; "New venue…" asks for Name, URL, and
      City together. Submitting an existing venue sends its `venue_id`
      directly; only the "New venue…" path sends
      `city_id`/`location_name`/`location_url`.
- [x] 3.2 `EventList.tsx`: reads `is_online` instead of `meetingUrl`
      presence for online/city classification; "Online" is now a synthetic
      filter option added when any event is online, rather than emerging
      from a location row named "Online".
- [x] 3.3 `src/pages/events/[slug].astro`: reads `is_online` to decide the
      online-vs-venue detail branch (`meetingUrl` still used as the link
      href). Also fixed two more call sites doing the same `meetingUrl`-
      presence check found while implementing this, beyond what design.md's
      Context section originally enumerated: `src/pages/admin/events.astro`
      (admin list "Location" column) and `src/layouts/EventCard.tsx`
      (event card location line).

## 4. Tests

- [x] 4.1 Updated `EventForm.test.tsx` for the checkbox-based online toggle
      (`getLocations` mock → `getCities`, `location_id`/`locationId` →
      `city_id`/dropped, added coverage for the online checkbox toggling
      venue vs. meeting-URL fields and for edit-mode pre-checking from
      `initialData.isOnline`). Also fixed `EventList.test.tsx` and
      `script.test.ts` fixtures for the new required `isOnline` field, and
      added an `EventList` test confirming online/city classification now
      follows `isOnline` rather than a location name.
- [ ] 4.2 ~~Add/update coverage for `createEvent`/`updateEvent`~~ — this
      repo has no existing pattern for unit-testing action handlers
      (mocking `defineAction`/`supabaseAdmin`/`requireAdmin`); building
      that harness was spun out to
      [#49](https://github.com/francisquinn/clubnafealsunachta/issues/49)
      rather than done inline here. Online/venue exclusivity is enforced by
      the form UI (never shows both fields) and the DB `CHECK` constraint
      (task 1.4) in the meantime.
- [x] 4.3 `vitest run`: 105/105 passing. `astro check`: 0 errors, 0
      warnings (one pre-existing unrelated warning), 1 hint. Caught and
      fixed one real type error along the way: `EventCard.tsx`'s `href`
      lost its `meetingUrl`-truthy narrowing once the condition switched to
      `isOnline` — fixed with `event.meetingUrl ?? undefined`.

## 5. Verification

- [x] 5.1 Francis manually verified in dev: created `test`/`venue-test`/
      `online-test` events (in-person + online + new-venue-with-city flow),
      confirmed admin table/edit form round-trip. Surfaced two real issues
      along the way, both fixed: (a) the shared `Selector` component showed
      a stale dropdown value after browser back-navigation due to Chrome's
      native `<select>` form-state restoration fighting React's controlled
      value — fixed with `autoComplete="off"` (pre-existing bug, not
      introduced by this change, just newly visible); (b) discovered the
      live Netlify production build was already failing — see note below.
- [x] 5.2 Confirmed via `grep -rn "location_id\|=== .Online."` — zero
      `location_id` references remain; the one `=== "Online"` hit
      (`EventList.tsx`) is comparing against the synthetic UI filter
      option, not a DB row/location name, which is correct per design.md.
- [x] 5.3 Reviewed the PR diff before merge. Found and fixed one real
      regression: `EventForm.tsx`'s venue `<select>` still had a
      "— none —" option carried over from the old code. In the old model
      that was safe (the top-level city dropdown still set `location_id`
      directly, so "venue TBD" kept a known city); in the new model city is
      only ever known through a venue, so "— none —" silently produced a
      non-online event with **zero** location info — the exact regression
      task 3.1/design.md Decision 6 was meant to close, just reintroduced
      by leaving the option in place. Fixed by making the Venue field
      `required` (existing venue or "New venue", no "none" option). Also
      removed a small piece of dead weight: `Venue.city_id` in
      `EventForm.tsx`'s local type was no longer read after the
      city-pre-filter logic was removed.

**Note on production impact (found during 5.1):** applying the migration
(task 1.6) to the live Supabase project — needed to test against real
data — put production out of sync with `main`, since `main` still runs the
pre-migration code. Confirmed via the real Netlify deploy log: build failed
on `Could not find the table 'public.locations'` (it was renamed to
`cities`). Netlify's own auto-diagnosis suggested recreating the
`locations` table — **wrong**, that would undo the intended migration;
correct fix is shipping this branch's code, not reverting the schema.
Verified this branch's code builds clean against the now-migrated live
schema via `npm run build` (the same command Netlify runs) before treating
this as resolved. Net effect: production is stuck failing every rebuild
until this PR merges — treat merging as urgent, not routine.
