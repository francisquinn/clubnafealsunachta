export const prerender = false;
import type { APIRoute } from "astro";
import { buildEventIcs } from "../../../lib/ics";
import { fetchLiveEvent, liveEventToIcsData } from "../../../lib/liveEvent";

// #197: live counterpart of the static [eventSlug].ics.ts — what "Apple
// Calendar" points at once the event page has refreshed its data, so the file
// reflects edits made since the last build. Same real same-origin .ics (no
// data: URI, see #76).
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? "";
  let live;
  try {
    live = await fetchLiveEvent(slug);
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
  if (!live) return new Response("Not found", { status: 404 });
  return new Response(buildEventIcs(liveEventToIcsData(slug, live)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
};
