import type { APIRoute } from "astro";
import { buildCalendarFeedIcs, toEventIcsData } from "../../lib/ics";
import { getChapterEventsStaticPaths, type ChapterEventsPath } from "../../lib/chapters";

// #80: one subscribable feed per chapter, at /[chapterSlug]/events.ics, with the
// same events as that chapter's events page. Prerendered like the rest of the
// site, so it updates on every build — the build hook already runs whenever
// an event is created or edited.
export const getStaticPaths = getChapterEventsStaticPaths;

export const GET: APIRoute<ChapterEventsPath["props"]> = ({ props }) => {
  const ics = buildCalendarFeedIcs(
    `Club na Fealsúnachta · ${props.chapter.name}`,
    props.events.map(toEventIcsData)
  );

  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
};
