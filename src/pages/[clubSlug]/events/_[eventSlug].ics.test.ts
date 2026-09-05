import { describe, it, expect } from "vitest";
import { GET } from "./[eventSlug].ics";
import { buildEventIcs, toEventIcsData } from "../../../lib/ics";
import type { EventCollection } from "../../../types/types";

// A fake collection entry — only the fields toEventIcsData/buildEventIcs
// actually read, cast to EventCollection since the real schema also carries
// unrelated fields (location, social, rsvpCounts, ...) this route never uses.
const event = {
  data: {
    name: "Test Talk",
    date: new Date("2026-09-06T08:18:00Z"),
    isOnline: false,
    venue: { name: "Test Venue", url: null },
    meetingUrl: null,
    slug: "test-talk",
    description: null,
    summary: null,
  },
} as unknown as EventCollection;

describe("GET /:clubSlug/events/:eventSlug.ics", () => {
  it("serves the event's ICS content with the calendar content-type", async () => {
    const response = await GET({ props: { event } } as Parameters<typeof GET>[0]);
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    // Locks in the route's wiring (props.event -> toEventIcsData -> buildEventIcs)
    // rather than re-testing buildEventIcs itself, which has its own coverage
    // in src/lib/ics.test.ts.
    expect(body).toBe(buildEventIcs(toEventIcsData(event)));
    expect(body).toContain("SUMMARY:Test Talk");
  });
});
