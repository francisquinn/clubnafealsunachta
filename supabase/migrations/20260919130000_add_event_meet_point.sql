-- Issue #98: add meet_point to events for a specific gathering location
-- separate from the venue (e.g., "main entrance", "room 3B", "by the fountain").
alter table public.events add column meet_point text;