import { describe, it, expect, vi, beforeEach } from "vitest";

// Local, per-test control over both Supabase and the content collection —
// mutable `state`/`mockEvents` the mock factories read at call time, while
// `vi.resetModules()` + a fresh dynamic import gives each test its own
// getAllClubs() cache (see clubs.ts) instead of leaking across tests.
const state: {
  clubsList: { id: number; name: string; slug: string }[] | null;
  clubsError: { message: string } | null;
  fromCalls: number;
} = { clubsList: null, clubsError: null, fromCalls: 0 };

let mockEvents: unknown[] = [];

vi.mock("./supabase", () => ({
  supabase: null,
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "clubs") throw new Error(`Unexpected table: ${table}`);
      state.fromCalls += 1;
      return { select: () => Promise.resolve({ data: state.clubsList, error: state.clubsError }) };
    },
  },
}));

vi.mock("astro:content", () => ({
  getCollection: () => Promise.resolve(mockEvents),
}));

beforeEach(() => {
  vi.resetModules();
  state.clubsList = null;
  state.clubsError = null;
  state.fromCalls = 0;
  mockEvents = [];
});

async function importClubs() {
  return import("./clubs");
}

describe("getAllClubs", () => {
  it("throws when the clubs table comes back empty, refusing to silently build zero pages", async () => {
    state.clubsList = [];
    const { getAllClubs } = await importClubs();

    await expect(getAllClubs()).rejects.toThrow(/zero clubs/);
  });

  it("clears its cache on failure so a later retry can succeed", async () => {
    state.clubsList = [];
    const { getAllClubs } = await importClubs();
    await expect(getAllClubs()).rejects.toThrow();

    state.clubsList = [{ id: 1, name: "Trieste", slug: "trieste" }];
    await expect(getAllClubs()).resolves.toEqual(state.clubsList);
  });

  it("memoizes a successful result — a second call doesn't hit Supabase again", async () => {
    state.clubsList = [{ id: 1, name: "Trieste", slug: "trieste" }];
    const { getAllClubs } = await importClubs();

    const first = await getAllClubs();
    state.clubsList = [{ id: 2, name: "Oslo", slug: "oslo" }]; // would change the answer if re-fetched
    const second = await getAllClubs();

    expect(second).toEqual(first);
    expect(second).toEqual([{ id: 1, name: "Trieste", slug: "trieste" }]);
    expect(state.fromCalls).toBe(1);
  });
});

describe("getEventClubStaticPaths", () => {
  it("gives a club-scoped event exactly one path, under its own club", async () => {
    state.clubsList = [
      { id: 1, name: "Trieste", slug: "trieste" },
      { id: 2, name: "Oslo", slug: "oslo" },
    ];
    mockEvents = [
      { data: { slug: "philosophy-night", location: { id: 1, name: "Trieste", slug: "trieste" } } },
    ];
    const { getEventClubStaticPaths } = await importClubs();

    const paths = await getEventClubStaticPaths();

    expect(paths).toEqual([
      { params: { clubSlug: "trieste", eventSlug: "philosophy-night" }, props: { event: mockEvents[0] } },
    ]);
  });

  it("fans a cross-chapter event (location: null) out across every existing club", async () => {
    state.clubsList = [
      { id: 1, name: "Trieste", slug: "trieste" },
      { id: 2, name: "Oslo", slug: "oslo" },
    ];
    mockEvents = [{ data: { slug: "global-meetup", location: null } }];
    const { getEventClubStaticPaths } = await importClubs();

    const paths = await getEventClubStaticPaths();

    expect(paths.map((p) => p.params.clubSlug).sort()).toEqual(["oslo", "trieste"]);
    paths.forEach((p) => expect(p.params.eventSlug).toBe("global-meetup"));
  });
});
