import { describe, it, expect, vi, beforeEach } from "vitest";

// Handler-level tests for updateChapterMemberships. Astro actions don't expose
// their `handler` in tests, so `defineAction` is mocked to return the
// definition object as-is (giving us the raw handler to invoke) and
// `ActionError` is stubbed with the same shape the real class throws
// (`code` + `message`). The Supabase admin client is mocked table by table,
// same chained shape as real supabase-js, with `state` letting each test
// control exactly what comes back and recording every write.
// #211: profile settings can only leave chapters and switch their emails, and
// only for the chapters the form showed (`chapter_shown`) and, for emails,
// only boxes that changed (`chapter_emails_was`), so a stale form can't undo
// a join or an email choice made in another tab.
type Write = { method: "delete" | "update"; values?: unknown; memberId: unknown; chapterIds: unknown };

const state = vi.hoisted(() => ({
  payload: { memberId: "member-1", isAdmin: false } as { memberId: string; isAdmin: boolean } | null,
  writeError: null as Error | null,
  writes: [] as Write[],
}));

vi.mock("astro:actions", async () => (await import("../test/astroActions")).mockActionModule());

vi.mock("../lib/auth", () => ({
  verifySession: async (token?: string) => (token ? state.payload : null),
}));

// Mocking ../lib/supabase (below) also skips its `import "dotenv/config"`
// side effect, so SUPABASE_* / JWT_SECRET never load from .env — none of
// them are read here (verifySession is mocked, supabaseAdmin is
// replaced), so that's fine.
vi.mock("../lib/supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  const callArgs = (calls: { method: string; args: unknown[] }[], method: string) =>
    calls.find((call) => call.method === method)?.args ?? [];
  return {
    supabaseAdmin: {
      from: stubFrom({
        chapter_members: () =>
          stubQuery((calls) => {
            const write = calls.find((call) => call.method === "delete" || call.method === "update");
            if (write) {
              state.writes.push({
                method: write.method as Write["method"],
                values: write.args[0],
                memberId: callArgs(calls, "eq")[1],
                chapterIds: callArgs(calls, "in")[1],
              });
              return { error: state.writeError };
            }
            throw new Error("unexpected chapter_members read");
          }),
      }),
    },
  };
});

import { updateChapterMemberships } from "./chapterMembers";

// The mocked defineAction above returns the definition object (not Astro's
// real client wrapper), so the raw handler is what reaches `handler`.
const action = updateChapterMemberships as unknown as {
  handler: (formData: FormData, context: { cookies: { get: (name: string) => { value: string } | null } }) => Promise<{ success: boolean; chapter_ids: number[] }>;
};

function makeContext(session?: string) {
  return {
    cookies: {
      get: (name: string) => (name === "session" && session ? { value: session } : null),
    },
  };
}

function run(formData: FormData, session = "session-token") {
  return action.handler(formData, makeContext(session));
}

function form(fields: Record<string, string[]>) {
  const formData = new FormData();
  for (const [name, values] of Object.entries(fields)) {
    for (const value of values) formData.append(name, value);
  }
  return formData;
}

function writeOf(method: Write["method"], values?: unknown) {
  return state.writes.find((write) => write.method === method && (values === undefined || JSON.stringify(write.values) === JSON.stringify(values)));
}

describe("updateChapterMemberships", () => {
  beforeEach(() => {
    state.payload = { memberId: "member-1", isAdmin: false };
    state.writeError = null;
    state.writes = [];
  });

  it("rejects with UNAUTHORIZED when there is no session cookie", async () => {
    await expect(run(new FormData(), "")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.writes).toEqual([]);
  });

  it("rejects with UNAUTHORIZED when the session token does not verify", async () => {
    state.payload = null;

    await expect(run(new FormData(), "session-token")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.writes).toEqual([]);
  });

  it("keeps ticked chapters, leaves unticked ones and switches the emails that changed", async () => {
    const result = await run(
      form({ chapter_shown: ["1", "2", "3"], chapter_id: ["1", "2", "1"], chapter_emails: ["2", "3"], chapter_emails_was: ["1"] })
    );

    expect(result).toEqual({ success: true, chapter_ids: [1, 2] });
    expect(writeOf("delete")).toEqual({ method: "delete", values: undefined, memberId: "member-1", chapterIds: [3] });
    // Chapter 3's email tick is ignored: it's being left.
    expect(writeOf("update", { emails_enabled: true })).toMatchObject({ memberId: "member-1", chapterIds: [2] });
    expect(writeOf("update", { emails_enabled: false })).toMatchObject({ memberId: "member-1", chapterIds: [1] });
    expect(state.writes).toHaveLength(3);
  });

  it("leaves every shown chapter when nothing is ticked", async () => {
    await expect(run(form({ chapter_shown: ["1", "2"] }))).resolves.toEqual({ success: true, chapter_ids: [] });

    expect(state.writes).toEqual([{ method: "delete", values: undefined, memberId: "member-1", chapterIds: [1, 2] }]);
  });

  it("writes nothing when the form showed no chapters", async () => {
    await expect(run(new FormData())).resolves.toEqual({ success: true, chapter_ids: [] });
    expect(state.writes).toEqual([]);
  });

  it("leaves alone a chapter the form didn't show, e.g. one joined in another tab since", async () => {
    // A stale tab showed only chapter 1; the member has since joined 2 and
    // opted in to its emails elsewhere.
    await run(form({ chapter_shown: ["1"], chapter_id: ["1"], chapter_emails_was: ["1"] }));

    expect(writeOf("delete")).toBeUndefined();
    expect(state.writes).toEqual([{ method: "update", values: { emails_enabled: false }, memberId: "member-1", chapterIds: [1] }]);
  });

  it("leaves an untouched email box alone, so a stale tab can't undo an opt-out made elsewhere", async () => {
    // The tab loaded with chapter 1's emails on and the box still ticked;
    // the member has since turned them off in another tab.
    await run(form({ chapter_shown: ["1"], chapter_id: ["1"], chapter_emails: ["1"], chapter_emails_was: ["1"] }));

    expect(state.writes).toEqual([]);
  });

  it("never touches a ticked chapter that wasn't shown, so the form can't be used to join", async () => {
    await run(form({ chapter_shown: ["1"], chapter_id: ["1", "2"], chapter_emails: ["2"] }));

    expect(state.writes.flatMap((write) => write.chapterIds as number[])).not.toContain(2);
  });

  it("ignores blank or malformed chapter ids instead of treating them as chapter ids", async () => {
    const result = await run(form({ chapter_shown: ["1", ""], chapter_id: ["1", "", "abc"], chapter_emails: ["", "1"] }));

    expect(result).toEqual({ success: true, chapter_ids: [1] });
    expect(writeOf("delete")).toBeUndefined();
    expect(writeOf("update", { emails_enabled: true })).toMatchObject({ chapterIds: [1] });
  });

  it("rejects with INTERNAL_SERVER_ERROR when a write fails", async () => {
    state.writeError = new Error("boom");

    await expect(run(form({ chapter_shown: ["1", "2"], chapter_id: ["1"] }))).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
