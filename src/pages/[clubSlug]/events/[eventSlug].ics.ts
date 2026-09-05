import type { APIRoute } from "astro";
import { buildEventIcs, toEventIcsData } from "../../../lib/ics";
import { getEventClubStaticPaths } from "../../../lib/clubs";
import type { EventCollection } from "../../../types/types";

// Same club/event pairing as [eventSlug].astro's own getStaticPaths — a
// shared helper (src/lib/clubs.ts) instead of a copy-pasted one, so every
// event page that exists is guaranteed to have a matching .ics file at the
// same clubSlug/eventSlug pair.
export const getStaticPaths = getEventClubStaticPaths;

// A real same-origin .ics file, not a `data:` URI — WebKit blocks top-level
// navigation to `data:` URLs (an anti-phishing restriction), which is why
// tapping "Apple Calendar" in real iOS Safari did nothing at all (#76). No
// Content-Disposition here: leaving it unset lets AddToCalendarButton's own
// `download` attribute (present for every browser except real Safari) decide
// save-vs-native-handoff per browser, same as before.
export const GET: APIRoute<{ event: EventCollection }> = ({ props }) => {
  const ics = buildEventIcs(toEventIcsData(props.event));

  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
};
