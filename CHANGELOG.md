# Backlog

- **User registration:** Create registration flow. Users would need to be approved before being granted access.

# 2026-09-20

## Fixed

- **content.config.ts**: Added `tags` to the event collection's Zod schema — it was missing from PR work so far, so the content layer stripped `data.tags` after validation and the EventList tag filter would never have seen any tags. Covered by a new assertion in `eventsLoader.test.ts`.
- **EventCard.tsx**: Tags now render on event cards unconditionally (issue #92 asked for tags on cards, but the `showTags` prop was never passed by any caller). The opt-in prop was removed.
- **EventForm.tsx**: Consolidated three duplicated `meet_point` fields into one shared field rendered once for in-person events — the new-venue branch previously rendered it twice (duplicate DOM ids, and the copy carrying `defaultValue` was shadowed on edit).
- **actions/events.ts**: Extracted duplicated tag parsing into a shared `parseTags` helper; tags are lowercased so "Workshop" and "workshop" don't become two filter options.
- **event.css**: Consolidated two near-duplicate `.cnf-event__tags`/`.cnf-event__tag` blocks into one.
- **EventList.tsx**: Removed redundant `allTags.length > 0` guard around the tag selector (the render function already early-returns); `renderTagSelector` return type widened to `JSX.Element | null` (fixes a `tsc` error).
- **profile/[username].astro**: Removed unused `formatBlogDate` import left over from the query-reduction change. **AdminLayout.astro**: removed unused `pageTitle` destructure (astro-check warning).
- Trailing newlines added to `auth.test.ts`, `events.test.ts`, and the two event migrations.

# 2026-06-06

## Fixed

- **EventList.test.tsx**: Fixed `UpcomingEvent` mock prop name `events` → `event` to match the real component interface. Resolved 3 test failures.
- **.gitignore**: Added `.opencode/` and `opencode.json` entries to allow local-only agent configurations to remain untracked by git.
- **NewsletterForm.tsx**: Removed deprecated `FormEvent` import; uses `React.SyntheticEvent` inline instead.
- **SuggestTopicForm.tsx**: Removed unused `formRef` variable.
- **ContactForm.tsx, EventForm.tsx, LoginForm.tsx, NewsletterForm.tsx, PostForm.tsx**: Replaced deprecated `React.FormEvent` with `React.SyntheticEvent` (structurally identical — `FormEvent<T>` is a deprecated type alias for `SyntheticEvent<T>` in React 19). Eliminates all 5 remaining `ts(6385)` deprecation hints.
