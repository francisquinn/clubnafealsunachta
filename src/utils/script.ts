import type { Event } from "../types/types";
import { DEFAULT_CLUB_TIMEZONE } from "../lib/clubDefaults";

export function formatBlogDate(date: Date): string {
  return `${date.toLocaleDateString("en-US", {
    month: "short",
  })} ${date.getDate()}, ${date.getFullYear()}`;
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
