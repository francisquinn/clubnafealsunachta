import { describe, it, expect, vi, beforeEach } from "vitest";

let mockEvents: unknown[] = [];
const getCollectionMock = vi.hoisted(() => vi.fn());
vi.mock("astro:content", () => ({ getCollection: getCollectionMock }));


const event = (slug: string, chapter: string) => ({ data: { slug, location: { slug: chapter } } });

let findMovedEventPath: (path: string) => Promise<string | null>;

beforeEach(async () => {
  // Fresh module per test: the slug map is memoized at module level.
  vi.resetModules();
  ({ findMovedEventPath } = await import("./movedEventRedirect"));
  getCollectionMock.mockReset();
  getCollectionMock.mockImplementation(() => Promise.resolve(mockEvents));
  mockEvents = [event("talk-one", "gorizia"), event("talk-two", "trieste")];
});

describe("findMovedEventPath", () => {
  it("points a stale chapter prefix at the event's current chapter", async () => {
    expect(await findMovedEventPath("/trieste/events/talk-one")).toBe("/gorizia/events/talk-one");
  });

  it("keeps the .ics extension", async () => {
    expect(await findMovedEventPath("/trieste/events/talk-one.ics")).toBe("/gorizia/events/talk-one.ics");
  });

  it("tolerates a trailing slash", async () => {
    expect(await findMovedEventPath("/trieste/events/talk-one/")).toBe("/gorizia/events/talk-one");
  });

  it("returns null when the chapter is already correct", async () => {
    expect(await findMovedEventPath("/trieste/events/talk-two")).toBeNull();
  });

  it("returns null for an unknown event", async () => {
    expect(await findMovedEventPath("/trieste/events/nope")).toBeNull();
  });

  it("returns null for non-event paths", async () => {
    expect(await findMovedEventPath("/trieste/events")).toBeNull();
    expect(await findMovedEventPath("/about")).toBeNull();
  });

  it("reads the collection once across lookups", async () => {
    await findMovedEventPath("/trieste/events/talk-one");
    await findMovedEventPath("/trieste/events/talk-two.ics");

    expect(getCollectionMock).toHaveBeenCalledTimes(1);
  });

  it("retries after the collection read rejects", async () => {
    getCollectionMock.mockRejectedValueOnce(new Error("boom"));

    await expect(findMovedEventPath("/trieste/events/talk-one")).rejects.toThrow("boom");
    expect(await findMovedEventPath("/trieste/events/talk-one")).toBe("/gorizia/events/talk-one");
  });
});
