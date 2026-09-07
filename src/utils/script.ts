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

// Shared "has this already happened" check, so every consumer compares
// dates the same way instead of each reimplementing `new Date(x) < new Date()`.
export function isPastDate(date: Date | string) {
  return new Date(date) < new Date();
}

export function isEventExpired(event: Event | null) {
  return event ? isPastDate(event.date) : true;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
