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
  })} ${date.getDate()} @ ${date.getHours()}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function isEventExpired(event: Event | null) {
  return event ? new Date(event.date) < new Date() : true;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
