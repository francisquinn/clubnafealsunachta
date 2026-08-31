import type { Event } from "../types/types";

export function formatBlogDate(date: Date): string {
  return `${date.toLocaleDateString("en-US", {
    month: "short",
  })} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatEventDate(date: Date): string {
  return `${date.toLocaleDateString("en-US", {
    weekday: "short",
  })} ${date.toLocaleDateString("en-US", {
    month: "short",
  })} ${date.getUTCDate()} @ ${date.getUTCHours()}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")}`;
}

export function isEventExpired(event: Event | null) {
  return event ? new Date(event.date) < new Date() : true;
}

// #52: display name for an event's hosting chapter. Clubs only store the
// city name (see 20260819140000_merge_cities_into_clubs.sql — "display stays
// derived as `CNF ${clubs.name}`"), so the derived form goes here. A null
// name means a genuinely cross-chapter/global event with no chapter of its
// own, which falls back to the parent org.
export function formatClubName(name: string | null): string {
  return name ? `CNF ${name}` : "Club na Fealsúnachta";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
