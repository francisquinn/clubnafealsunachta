import type { Event } from "../types/types";
import { DEFAULT_CLUB_TIMEZONE } from "../lib/clubDefaults";

// `timeZone` is optional so blog posts (the one remaining caller that
// doesn't pass one) are unaffected — pass it explicitly for a date that must
// read as a specific timezone's calendar day regardless of where the code
// runs. Both event callers (the admin events list, and the public
// past-events list in EventList.tsx) now pass DEFAULT_CLUB_TIMEZONE (#75:
// rendering with no timeZone defaults to wherever the code executes — the
// server's UTC runtime for the admin page, the visitor's own browser for the
// client-hydrated public list — either of which can disagree with the
// club's actual local calendar day for a late-enough event).
export function formatBlogDate(date: Date, timeZone?: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return `${parts.month} ${parts.day}, ${parts.year}`;
}

// Always shown in the club's own local time (see DEFAULT_CLUB_TIMEZONE), not
// UTC and not the visitor's own timezone — a remote/online-event attendee in
// another timezone still needs "Fri Sep 4 @ 18:30" to mean the same instant
// as it does for a Trieste-based one. Previously read getUTCHours()/
// getUTCMinutes() directly, which happened to "work" only because of a
// separate storage bug (see timezone.ts) that stored the local wall-clock
// digits mislabeled as UTC — now that storage holds the true UTC instant,
// this has to do the real timezone conversion instead.
export function formatEventDate(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_CLUB_TIMEZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  // Midnight can format as "24" under hour12: false in some environments.
  const hour = parts.hour === "24" ? "0" : parts.hour;
  return `${parts.weekday} ${parts.month} ${parts.day} @ ${hour}:${parts.minute}`;
}

// #100: just the club-local "HH:mm" for an end time, appended to
// formatEventDate's start — e.g. "Fri Sep 4 @ 18:30–20:00". A bare end time
// reads fine here since it's always the same calendar day as the start (see
// the 20260914120000 migration's backfill and EventForm's default).
export function formatEventEndTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_CLUB_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const hour = parts.hour === "24" ? "0" : parts.hour;
  return `${hour}:${parts.minute}`;
}

// Shared "has this already happened" check, so every consumer compares
// dates the same way instead of each reimplementing `new Date(x) < new Date()`.
export function isPastDate(date: Date | string) {
  return new Date(date) < new Date();
}

// #97: keyed off the end time (#100), not the start — an event stays
// counted as "not past" for its whole run instead of flipping the moment it
// begins. This single change is what fixes the online-events-flip-to-past-
// at-start bug for every consumer (JoinEventButton, the add-to-calendar
// button, EventList's upcoming/past split) without touching them directly.
export function isEventExpired(event: Event | null) {
  return event ? isPastDate(event.endDate) : true;
}

export type EventLiveState = "upcoming" | "live" | "past";

// #97: the "on air" state — live from the start until the end time,
// upcoming before that, past after. `now` is a parameter (not read
// internally) purely so tests can pin it instead of faking the system clock.
export function getEventLiveState(event: Pick<Event, "date" | "endDate">, now: Date = new Date()): EventLiveState {
  if (now < new Date(event.date)) return "upcoming";
  if (now < new Date(event.endDate)) return "live";
  return "past";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
