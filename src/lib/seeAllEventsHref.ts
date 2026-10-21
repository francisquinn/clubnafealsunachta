import { DEFAULT_CHAPTER_SLUG } from "./chapterDefaults";
import type { Event } from "../types/types";

// #194: the home page's "See all events" goes to the chapter of the next
// upcoming event shown there, or the default chapter's page when there is none.
export function getSeeAllEventsHref(events: Pick<Event, "date" | "location">[], now = new Date()): string {
  const next = events.find((e) => e.date > now);
  return `/${next?.location.slug ?? DEFAULT_CHAPTER_SLUG}/events`;
}
