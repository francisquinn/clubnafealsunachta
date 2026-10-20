import { describe, it, expect, vi, beforeEach } from "vitest";

// Local, per-test control over both Supabase and the content collection —
// mutable `state`/`mockEvents` the mock factories read at call time, while
// `vi.resetModules()` + a fresh dynamic import gives each test its own
// getAllChapters() cache (see chapters.ts) instead of leaking across tests.
const state: {
  chaptersList: { id: number; name: string; slug: string }[] | null;
  chaptersError: { message: string } | null;
  fromCalls: number;
} = { chaptersList: null, chaptersError: null, fromCalls: 0 };

let mockEvents: unknown[] = [];

vi.mock("./supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  return {
    supabase: null,
    supabaseAdmin: {
      from: stubFrom({
        chapters: () => {
          state.fromCalls += 1;
          return stubQuery(() => ({ data: state.chaptersList, error: state.chaptersError }));
        },
      }),
    },
  };
});

vi.mock("astro:content", () => ({
  getCollection: () => Promise.resolve(mockEvents),
}));

beforeEach(() => {
  vi.resetModules();
  state.chaptersList = null;
  state.chaptersError = null;
  state.fromCalls = 0;
  mockEvents = [];
});

async function importChapters() {
  return import("./chapters");
}

describe("getAllChapters", () => {
  it("throws when the chapters table comes back empty, refusing to silently build zero pages", async () => {
    state.chaptersList = [];
    const { getAllChapters } = await importChapters();

    await expect(getAllChapters()).rejects.toThrow(/zero chapters/);
  });

  it("clears its cache on failure so a later retry can succeed", async () => {
    state.chaptersList = [];
    const { getAllChapters } = await importChapters();
    await expect(getAllChapters()).rejects.toThrow();

    state.chaptersList = [{ id: 1, name: "Trieste", slug: "trieste" }];
    await expect(getAllChapters()).resolves.toEqual(state.chaptersList);
  });

  it("memoizes a successful result — a second call doesn't hit Supabase again", async () => {
    state.chaptersList = [{ id: 1, name: "Trieste", slug: "trieste" }];
    const { getAllChapters } = await importChapters();

    const first = await getAllChapters();
    state.chaptersList = [{ id: 2, name: "Oslo", slug: "oslo" }]; // would change the answer if re-fetched
    const second = await getAllChapters();

    expect(second).toEqual(first);
    expect(second).toEqual([{ id: 1, name: "Trieste", slug: "trieste" }]);
    expect(state.fromCalls).toBe(1);
  });
});

describe("getEventChapterStaticPaths", () => {
  it("gives an event exactly one path, under its own chapter", async () => {
    mockEvents = [
      { data: { slug: "philosophy-night", location: { id: 1, name: "Trieste", slug: "trieste" } } },
    ];
    const { getEventChapterStaticPaths } = await importChapters();

    const paths = await getEventChapterStaticPaths();

    expect(paths).toEqual([
      { params: { chapterSlug: "trieste", eventSlug: "philosophy-night" }, props: { event: mockEvents[0] } },
    ]);
  });
});

describe("getChapterEventsStaticPaths", () => {
  it("gives every chapter a path with only its own events", async () => {
    state.chaptersList = [
      { id: 1, name: "Trieste", slug: "trieste" },
      { id: 2, name: "Oslo", slug: "oslo" },
    ];
    const triesteEvent = { data: { slug: "philosophy-night", location: { id: 1, name: "Trieste", slug: "trieste" } } };
    const osloEvent = { data: { slug: "fjord-talk", location: { id: 2, name: "Oslo", slug: "oslo" } } };
    mockEvents = [triesteEvent, osloEvent];
    const { getChapterEventsStaticPaths } = await importChapters();

    const paths = await getChapterEventsStaticPaths();

    expect(paths).toEqual([
      { params: { chapterSlug: "trieste" }, props: { chapter: state.chaptersList[0], events: [triesteEvent] } },
      { params: { chapterSlug: "oslo" }, props: { chapter: state.chaptersList[1], events: [osloEvent] } },
    ]);
  });

  it("still gives a chapter with no events a path", async () => {
    state.chaptersList = [{ id: 1, name: "Trieste", slug: "trieste" }];
    const { getChapterEventsStaticPaths } = await importChapters();

    const paths = await getChapterEventsStaticPaths();

    expect(paths).toEqual([{ params: { chapterSlug: "trieste" }, props: { chapter: state.chaptersList[0], events: [] } }]);
  });
});

describe("sortChaptersForPicker", () => {
  it("lists city chapters alphabetically with Online last, keeping only name and slug", async () => {
    const { sortChaptersForPicker } = await importChapters();

    expect(
      sortChaptersForPicker([
        { id: 9, name: "Online", slug: "online" },
        { id: 2, name: "Trieste", slug: "trieste" },
        { id: 3, name: "Dublin", slug: "dublin" },
      ])
    ).toEqual([
      { name: "Dublin", slug: "dublin" },
      { name: "Trieste", slug: "trieste" },
      { name: "Online", slug: "online" },
    ]);
  });
});
