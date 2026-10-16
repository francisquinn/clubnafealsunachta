import type { APIRoute } from "astro";
import { buildCalendarFeedIcs, toEventIcsData } from "../../lib/ics";
import { getClubEventsStaticPaths, type ClubEventsPath } from "../../lib/clubs";

// #80: one subscribable feed per club, at /[clubSlug]/events.ics, with the
// same events as that club's events page. Prerendered like the rest of the
// site, so it updates on every build — the build hook already runs whenever
// an event is created or edited.
export const getStaticPaths = getClubEventsStaticPaths;

export const GET: APIRoute<ClubEventsPath["props"]> = ({ props }) => {
  const ics = buildCalendarFeedIcs(
    `Club na Fealsúnachta · ${props.club.name}`,
    props.events.map(toEventIcsData)
  );

  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
};
