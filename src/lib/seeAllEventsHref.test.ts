import { describe, expect, it } from "vitest";
import { getSeeAllEventsHref } from "./seeAllEventsHref";

const now = new Date("2026-10-21T12:00:00Z");
const event = (date: string, slug: string) => ({
  date: new Date(date),
  location: { id: 1, name: slug, slug },
});

describe("getSeeAllEventsHref", () => {
  it("goes to the chapter of the next upcoming event", () => {
    const events = [event("2026-10-20T18:00:00Z", "trieste"), event("2026-10-23T18:00:00Z", "online")];
    expect(getSeeAllEventsHref(events, now)).toBe("/online/events");
  });

  it("follows any chapter, not just Trieste or Online", () => {
    expect(getSeeAllEventsHref([event("2026-10-23T18:00:00Z", "gorizia")], now)).toBe("/gorizia/events");
  });

  it("defaults to Trieste when there are no events", () => {
    expect(getSeeAllEventsHref([], now)).toBe("/trieste/events");
  });

  it("defaults to Trieste when only past events are shown", () => {
    expect(getSeeAllEventsHref([event("2026-10-20T18:00:00Z", "online")], now)).toBe("/trieste/events");
  });
});
