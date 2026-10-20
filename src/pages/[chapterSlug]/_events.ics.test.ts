import { describe, it, expect } from "vitest";
import { GET, getStaticPaths } from "./events.ics";
import { getChapterEventsStaticPaths } from "../../lib/chapters";
import type { EventCollection } from "../../types/types";

// Fake collection entries with only the fields toEventIcsData reads.
function makeEvent(slug: string, name: string): EventCollection {
  return {
    data: {
      name,
      date: new Date("2026-09-06T17:00:00Z"),
      endDate: new Date("2026-09-06T18:30:00Z"),
      isOnline: false,
      venue: { name: "Test Venue", url: null },
      meetingUrl: null,
      meetPoint: null,
      slug,
      description: null,
      summary: null,
    },
  } as unknown as EventCollection;
}

const chapter = { id: 1, name: "Trieste", slug: "trieste" };

async function get(events: EventCollection[]) {
  return GET({ props: { chapter, events } } as unknown as Parameters<typeof GET>[0]);
}

describe("GET /:chapterSlug/events.ics", () => {
  // Builds one feed per chapter from the same helper as the events page, so
  // every page's subscribe link has a feed behind it.
  it("builds its pages from the same chapter list as the events page", () => {
    expect(getStaticPaths).toBe(getChapterEventsStaticPaths);
  });

  it("serves a calendar feed named after the chapter, with the calendar content-type", async () => {
    const response = await get([makeEvent("talk-one", "Talk One")]);
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(body).toContain("X-WR-CALNAME:Club na Fealsúnachta · Trieste");
  });

  it("includes one VEVENT per event, each with its own UID and reminder", async () => {
    const body = await (await get([makeEvent("talk-one", "Talk One"), makeEvent("talk-two", "Talk Two")])).text();

    expect(body.split("BEGIN:VEVENT")).toHaveLength(3);
    expect(body.split("BEGIN:VALARM")).toHaveLength(3);
    expect(body).toContain("UID:event-talk-one@clubnafealsunachta.com");
    expect(body).toContain("UID:event-talk-two@clubnafealsunachta.com");
  });

  it("serves a valid empty calendar for a chapter with no events", async () => {
    const body = await (await get([])).text();

    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(body).toMatch(/\r\nEND:VCALENDAR\r\n$/);
    expect(body).not.toContain("BEGIN:VEVENT");
  });
});
