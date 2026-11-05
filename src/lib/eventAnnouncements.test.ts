// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// #205: announcePendingEvents claims unannounced events in one update, then
// emails each live one to its chapter's opted-in, verified members (not the
// host). Supabase is a per-table stub and the SMTP transport a recorder.
const state = vi.hoisted(() => ({
  configured: true,
  claimed: [] as Record<string, unknown>[],
  claimFilters: [] as unknown[][],
  claimValues: null as unknown,
  membersByChapter: {} as Record<number, Record<string, unknown>[]>,
  memberFilters: [] as unknown[][],
  sent: [] as Record<string, any>[],
  failFor: new Set<string>(),
  updateError: null as Error | null,
  unsubscribeFilters: [] as unknown[][],
  closed: false,
  chapter: { name: "Trieste" } as { name: string } | null,
  chapterError: null as Error | null,
}));

vi.mock("./email", () => ({
  CLUB_FROM: "Club <club@example.com>",
  ANNOUNCEMENT_CONNECTIONS: 3,
  isEmailConfigured: () => state.configured,
  createPooledTransport: () => ({
    sendMail: async (message: Record<string, any>) => {
      if (state.failFor.has(message.to)) throw new Error("SMTP down");
      state.sent.push(message);
    },
    close: () => {
      state.closed = true;
    },
  }),
}));

vi.mock("./supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        chapters: () => stubQuery(() => ({ data: state.chapter, error: state.chapterError })),
        events: () =>
          stubQuery((calls) => {
            state.claimValues = calls.find((call) => call.method === "update")?.args[0];
            state.claimFilters = calls.filter((call) => call.method === "is" || call.method === "lte").map((call) => call.args);
            return { data: state.claimed, error: null };
          }),
        chapter_members: () =>
          stubQuery((calls) => {
            const filters = calls.filter((call) => call.method === "eq").map((call) => call.args);
            if (calls.some((call) => call.method === "update")) {
              state.unsubscribeFilters = filters;
              return { error: state.updateError };
            }
            state.memberFilters = filters;
            const chapterId = filters.find(([column]) => column === "chapter_id")?.[1] as number;
            return { data: state.membersByChapter[chapterId] ?? [], error: null };
          }),
      }),
    },
  };
});

import { announcePendingEvents, formatAnnouncementWhen, resolveUnsubscribePage, unsubscribeFromChapter } from "./eventAnnouncements";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./emailLinks";

const NOW = new Date("2099-01-01T12:00:00Z");
const BUILT_BEFORE = new Date("2099-01-01T11:55:00Z");

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Philosophy Night",
    slug: "philosophy-night",
    date: "2099-01-08T17:30:00Z",
    end_date: "2099-01-08T19:30:00Z",
    is_online: false,
    meeting_url: null,
    description: "Is free will an illusion?\nBring a friend.",
    created_by: "host",
    chapter_id: 1,
    venues: { name: "Polo Toti", url: "https://maps.example/toti" },
    chapters: { name: "Trieste", slug: "trieste", timezone: "Europe/Rome" },
    ...overrides,
  };
}

const member = (id: string, overrides: Record<string, unknown> = {}) => ({
  members: { id, email: `${id}@example.com`, email_verified_at: "2026-01-01T00:00:00Z", ...overrides },
});

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

beforeEach(() => {
  state.configured = true;
  state.claimed = [];
  state.claimFilters = [];
  state.claimValues = null;
  state.membersByChapter = {};
  state.memberFilters = [];
  state.sent = [];
  state.failFor = new Set();
  state.updateError = null;
  state.unsubscribeFilters = [];
  state.closed = false;
  state.chapter = { name: "Trieste" };
  state.chapterError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function run(options: { clock?: () => number; budgetMs?: number } = {}) {
  return announcePendingEvents("https://club.example", BUILT_BEFORE, { now: NOW, ...options });
}

describe("formatAnnouncementWhen", () => {
  it("gives the day and start time in the chapter's own time", () => {
    expect(formatAnnouncementWhen(new Date("2099-01-08T17:30:00Z"), "Europe/Rome")).toBe("Thursday 8 January @ 18:30");
  });

  it("follows daylight saving", () => {
    expect(formatAnnouncementWhen(new Date("2099-07-09T16:30:00Z"), "Europe/Rome")).toBe("Thursday 9 July @ 18:30");
  });
});

describe("announcePendingEvents", () => {
  it("claims, in one update, every unannounced event saved before the deploy started", async () => {
    await run();
    expect(state.claimFilters).toEqual([["announced_at", null], ["created_at", BUILT_BEFORE.toISOString()]]);
    expect(state.claimValues).toEqual({ announced_at: expect.any(String) });
  });

  it("emails opted-in, verified members of the chapter, but not the host", async () => {
    state.claimed = [event()];
    state.membersByChapter[1] = [member("ana"), member("host"), member("unverified", { email_verified_at: null })];

    const result = await run();

    expect(result).toEqual({ events: 1, sent: 1, failed: 0, skipped: 0 });
    expect(state.memberFilters).toEqual([["chapter_id", 1], ["emails_enabled", true]]);
    expect(state.sent.map((message) => message.to)).toEqual(["ana@example.com"]);
    expect(state.closed).toBe(true);
  });

  it("writes the event details, links and one-click unsubscribe headers", async () => {
    state.claimed = [event()];
    state.membersByChapter[1] = [member("ana")];

    await run();
    const message = state.sent[0]!;

    expect(message.subject).toBe("New event in Trieste: Philosophy Night");
    expect(message.text).toContain("Thursday 8 January @ 18:30");
    expect(message.text).toContain("Polo Toti");
    expect(message.text).toContain("https://club.example/trieste/events/philosophy-night");
    expect(message.text).not.toContain(".ics");
    expect(message.html).toContain("Is free will an illusion?");
    expect(message.headers).toEqual({ "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

    const oneClick = new URL(message.list.unsubscribe);
    expect(oneClick.pathname).toBe("/api/unsubscribe");
    expect(verifyUnsubscribeToken(oneClick.searchParams.get("t")!)).toEqual({ memberId: "ana", chapterId: 1 });
    expect(message.text).toContain(`https://club.example/email/unsubscribe?t=${oneClick.searchParams.get("t")}`);
  });

  it("includes the meeting link for an online event", async () => {
    state.claimed = [event({ is_online: true, meeting_url: "https://meet.example/x", venues: null })];
    state.membersByChapter[1] = [member("ana")];

    await run();

    expect(state.sent[0]!.text).toContain("Online: https://meet.example/x");
  });

  it("claims but never emails an event that has already ended", async () => {
    state.claimed = [event({ date: "2098-12-01T17:30:00Z", end_date: "2098-12-01T19:30:00Z" })];
    state.membersByChapter[1] = [member("ana")];

    await expect(run()).resolves.toEqual({ events: 0, sent: 0, failed: 0, skipped: 0 });
    expect(state.sent).toEqual([]);
  });

  it("carries on past a failed send and counts it", async () => {
    state.claimed = [event()];
    state.membersByChapter[1] = [member("ana"), member("bo")];
    state.failFor = new Set(["ana@example.com"]);

    await expect(run()).resolves.toEqual({ events: 1, sent: 1, failed: 1, skipped: 0 });
    expect(state.sent.map((message) => message.to)).toEqual(["bo@example.com"]);
  });

  it("escapes event text in the HTML", async () => {
    state.claimed = [event({ name: "<b>Night</b>", description: "a < b" })];
    state.membersByChapter[1] = [member("ana")];

    await run();

    expect(state.sent[0]!.html).not.toContain("<b>Night</b>");
    expect(state.sent[0]!.html).toContain("a &lt; b");
  });

  it("stops starting sends once the time budget is spent, and counts who was missed", async () => {
    state.claimed = [event()];
    state.membersByChapter[1] = [member("ana"), member("bo"), member("cy"), member("di"), member("ed")];
    let time = 0;
    // Each clock read moves time on 10ms; the budget allows only the first reads.
    const clock = () => (time += 10);

    const result = await run({ clock, budgetMs: 35 });

    expect(result.sent + result.skipped).toBe(5);
    expect(result.skipped).toBeGreaterThan(0);
    expect(result.sent).toBeGreaterThan(0);
    expect(state.closed).toBe(true);
  });

  it("claims nothing when email isn't configured, so events wait for a deploy that can send", async () => {
    state.configured = false;
    state.claimed = [event()];

    await expect(run()).resolves.toEqual({ events: 0, sent: 0, failed: 0, skipped: 0 });
    expect(state.claimValues).toBeNull();
  });
});

describe("unsubscribeFromChapter", () => {
  it("turns off that member's emails for that chapter only", async () => {
    await expect(unsubscribeFromChapter("ana", 1)).resolves.toBe(true);
    expect(state.unsubscribeFilters).toEqual([["member_id", "ana"], ["chapter_id", 1]]);
  });

  it("reports a failed update", async () => {
    state.updateError = new Error("boom");
    await expect(unsubscribeFromChapter("ana", 1)).resolves.toBe(false);
  });
});

describe("resolveUnsubscribePage", () => {
  const token = () => createUnsubscribeToken("ana", 1);

  it("only asks on GET, so a mail scanner opening the link changes nothing", async () => {
    await expect(resolveUnsubscribePage(token(), "GET")).resolves.toEqual({ state: "confirm", chapterName: "Trieste" });
    expect(state.unsubscribeFilters).toEqual([]);
  });

  it("unsubscribes when the button is pressed", async () => {
    await expect(resolveUnsubscribePage(token(), "POST")).resolves.toEqual({ state: "done", chapterName: "Trieste" });
    expect(state.unsubscribeFilters).toEqual([["member_id", "ana"], ["chapter_id", 1]]);
  });

  it("rejects a missing or forged token without touching anything", async () => {
    for (const bad of [null, "", `${token()}x`]) {
      await expect(resolveUnsubscribePage(bad, "POST")).resolves.toEqual({ state: "invalid", chapterName: null });
    }
    expect(state.unsubscribeFilters).toEqual([]);
  });

  it("calls a deleted chapter invalid, but a failed lookup an error", async () => {
    state.chapter = null;
    await expect(resolveUnsubscribePage(token(), "GET")).resolves.toMatchObject({ state: "invalid" });
    state.chapterError = new Error("down");
    await expect(resolveUnsubscribePage(token(), "GET")).resolves.toMatchObject({ state: "error" });
  });

  it("reports a failed unsubscribe", async () => {
    state.updateError = new Error("boom");
    await expect(resolveUnsubscribePage(token(), "POST")).resolves.toMatchObject({ state: "error" });
  });
});
