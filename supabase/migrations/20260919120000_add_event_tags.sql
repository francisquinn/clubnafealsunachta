-- Issue #92: add tags to events for categorization and filtering.
-- Uses a text array for simplicity — a dedicated tag table would be
-- overkill for the current scope (free-form admin tags, no need for
-- cross-event referential integrity or autocomplete).
alter table public.events add column tags text[] not null default '{}';

-- GIN index for fast "events containing this tag" lookups (used by
-- the events list page's tag filter).
create index events_tags_gin_idx on public.events using gin (tags);