# Backlog

- **User registration:** Create registration flow. Users would need to be approved before being granted access.

# 2026-06-06

## Fixed

- **EventList.test.tsx**: Fixed `UpcomingEvent` mock prop name `events` → `event` to match the real component interface. Resolved 3 test failures.
- **.gitignore**: Added `.opencode/` and `opencode.json` entries to allow local-only agent configurations to remain untracked by git.
- **NewsletterForm.tsx**: Removed deprecated `FormEvent` import; uses `React.SyntheticEvent` inline instead.
- **SuggestTopicForm.tsx**: Removed unused `formRef` variable.
- **ContactForm.tsx, EventForm.tsx, LoginForm.tsx, NewsletterForm.tsx, PostForm.tsx**: Replaced deprecated `React.FormEvent` with `React.SyntheticEvent` (structurally identical — `FormEvent<T>` is a deprecated type alias for `SyntheticEvent<T>` in React 19). Eliminates all 5 remaining `ts(6385)` deprecation hints.
