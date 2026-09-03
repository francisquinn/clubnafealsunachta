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
