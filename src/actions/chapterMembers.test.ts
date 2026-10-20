import { describe, it, expect, vi, beforeEach } from "vitest";

// Handler-level tests for updateChapterMemberships. Astro actions don't expose
// their `handler` in tests, so `defineAction` is mocked to return the
// definition object as-is (giving us the raw handler to invoke) and
// `ActionError` is stubbed with the same shape the real class throws
// (`code` + `message`). The Supabase admin client is mocked table by table,
// same chained shape as real supabase-js, with `state` letting each test
// control exactly what comes back. Mailchimp is mocked wholesale so no test
// can make a live API call (see #55) — state.tagError forces a tag call to
// fail so the best-effort sync path can be exercised.
const state = vi.hoisted(() => ({
  payload: { memberId: "member-1", isAdmin: false } as { memberId: string; isAdmin: boolean } | null,
  existingChapterIds: [] as number[],
  chaptersQueryError: null as Error | null,
  insertError: null as Error | null,
  insertRows: [] as { member_id: string; chapter_id: number }[],
  deleteError: null as Error | null,
  deleteMemberId: null as string | null,
  deleteNotOp: null as string | null,
  deleteNotColumn: null as string | null,
  upsertOptions: null as Record<string, unknown> | null,
  // #55: data the Mailchimp tag sync reads back (member email + every
  // chapter's id/slug), plus a way to make a tag call fail.
  memberEmail: null as string | null,
  memberEmailError: null as Error | null,
  allChapters: [] as { id: number; slug: string }[],
  allChaptersError: null as Error | null,
  tagError: null as Error | null,
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
        // #55: chapter validation is `select('id').in(...)`; the Mailchimp tag
        // sync reads every chapter with `select('id, slug')`. Branch on the
        // field list to serve each shape.
        chapters: () =>
          stubQuery((calls) => {
            if (callArgs(calls, "select")[0] === "id, slug") {
              return { data: state.allChapters, error: state.allChaptersError };
            }
            const ids = (callArgs(calls, "in")[1] ?? []) as number[];
            return {
              data: ids.filter((id) => state.existingChapterIds.includes(id)).map((id) => ({ id })),
              error: state.chaptersQueryError,
            };
          }),
        members: () =>
          stubQuery(() => ({
            data: state.memberEmail ? { email: state.memberEmail } : null,
            error: state.memberEmailError,
          })),
        chapter_members: () =>
          stubQuery((calls) => {
            if (calls.some((call) => call.method === "upsert")) {
              state.insertRows = callArgs(calls, "upsert")[0] as { member_id: string; chapter_id: number }[];
              state.upsertOptions = callArgs(calls, "upsert")[1] as Record<string, unknown>;
              return { error: state.insertError };
            }
            // delete().eq() is awaitable as-is (every chapter unselected) or
            // followed by .not().
            state.deleteMemberId = callArgs(calls, "eq")[1] as string;
            const notArgs = callArgs(calls, "not");
            if (notArgs.length) {
              state.deleteNotColumn = notArgs[0] as string;
              state.deleteNotOp = notArgs[2] as string;
            }
            return { error: state.deleteError };
          }),
      }),
    },
  };
});

vi.mock("../lib/mailchimp", () => ({
  addChapterTag: vi.fn(async () => {
    if (state.tagError) throw state.tagError;
  }),
  removeChapterTag: vi.fn(async () => {
    if (state.tagError) throw state.tagError;
  }),
}));

import { updateChapterMemberships } from "./chapterMembers";
import { addChapterTag, removeChapterTag } from "../lib/mailchimp";

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

describe("updateChapterMemberships", () => {
  beforeEach(() => {
    state.payload = { memberId: "member-1", isAdmin: false };
    state.existingChapterIds = [];
    state.chaptersQueryError = null;
    state.insertError = null;
    state.insertRows = [];
    state.deleteError = null;
    state.deleteMemberId = null;
    state.deleteNotOp = null;
    state.deleteNotColumn = null;
    state.upsertOptions = null;
    state.memberEmail = null;
    state.memberEmailError = null;
    state.allChapters = [];
    state.allChaptersError = null;
    state.tagError = null;
    vi.mocked(addChapterTag).mockClear();
    vi.mocked(removeChapterTag).mockClear();
  });

  it("rejects with UNAUTHORIZED when there is no session cookie", async () => {
    await expect(run(new FormData(), "")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("rejects with UNAUTHORIZED when the session token does not verify", async () => {
    state.payload = null;

    await expect(run(new FormData(), "session-token")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("registers to each selected chapter and tags on in Mailchimp", async () => {
    state.existingChapterIds = [1, 2];
    state.memberEmail = "member@example.com";
    state.allChapters = [
      { id: 1, slug: "trieste" },
      { id: 2, slug: "rome" },
      { id: 3, slug: "venice" },
    ];
    const formData = new FormData();
    formData.append("chapter_id", "1");
    formData.append("chapter_id", "2");
    formData.append("chapter_id", "1"); // duplicate — one membership per (member, chapter)

    await expect(run(formData)).resolves.toEqual({ success: true, chapter_ids: [1, 2] });

    expect(state.insertRows).toEqual([
      { member_id: "member-1", chapter_id: 1 },
      { member_id: "member-1", chapter_id: 2 },
    ]);
    expect(state.deleteMemberId).toBe("member-1");
    expect(state.deleteNotOp).toBe("(1,2)");
    // Plain strings the type checker can't see: must match chapter_members' key and column.
    expect(state.upsertOptions).toEqual({ onConflict: "member_id,chapter_id", ignoreDuplicates: true });
    expect(state.deleteNotColumn).toBe("chapter_id");

    // #55: selected chapters tagged on; unselected chapter left behind tagged off.
    expect(addChapterTag).toHaveBeenCalledWith("member@example.com", "trieste");
    expect(addChapterTag).toHaveBeenCalledWith("member@example.com", "rome");
    expect(removeChapterTag).toHaveBeenCalledWith("member@example.com", "venice");
    expect(addChapterTag).toHaveBeenCalledTimes(2);
    expect(removeChapterTag).toHaveBeenCalledTimes(1);
  });

  it("unregisters from every chapter and tags every chapter off when nothing is checked", async () => {
    state.memberEmail = "member@example.com";
    state.allChapters = [
      { id: 1, slug: "trieste" },
      { id: 2, slug: "rome" },
    ];

    await expect(run(new FormData())).resolves.toEqual({ success: true, chapter_ids: [] });

    expect(state.insertRows).toEqual([]);
    expect(state.deleteMemberId).toBe("member-1");
    expect(state.deleteNotOp).toBeNull();

    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).toHaveBeenCalledWith("member@example.com", "trieste");
    expect(removeChapterTag).toHaveBeenCalledWith("member@example.com", "rome");
  });

  it("ignores blank or malformed chapter_id values instead of treating them as chapter ids", async () => {
    state.existingChapterIds = [1];
    state.memberEmail = "member@example.com";
    state.allChapters = [{ id: 1, slug: "trieste" }];
    const formData = new FormData();
    formData.append("chapter_id", "1");
    formData.append("chapter_id", "");

    await expect(run(formData)).resolves.toEqual({ success: true, chapter_ids: [1] });

    expect(state.insertRows).toEqual([{ member_id: "member-1", chapter_id: 1 }]);
    expect(state.deleteNotOp).toBe("(1)");
  });

  it("skips the Mailchimp sync entirely when the member has no stored email", async () => {
    state.existingChapterIds = [1];
    state.memberEmail = null;
    state.allChapters = [{ id: 1, slug: "trieste" }];
    const formData = new FormData();
    formData.append("chapter_id", "1");

    await expect(run(formData)).resolves.toEqual({ success: true, chapter_ids: [1] });

    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("keeps the membership update successful when a Mailchimp tag call fails", async () => {
    state.existingChapterIds = [1];
    state.memberEmail = "member@example.com";
    state.allChapters = [{ id: 1, slug: "trieste" }];
    state.tagError = new Error("Mailchimp is down");
    const formData = new FormData();
    formData.append("chapter_id", "1");

    await expect(run(formData)).resolves.toEqual({ success: true, chapter_ids: [1] });

    expect(addChapterTag).toHaveBeenCalledWith("member@example.com", "trieste");
  });

  it("rejects with BAD_REQUEST when a selected chapter does not exist", async () => {
    state.existingChapterIds = [1];
    state.memberEmail = "member@example.com";
    state.allChapters = [{ id: 1, slug: "trieste" }];
    const formData = new FormData();
    formData.append("chapter_id", "1");
    formData.append("chapter_id", "99");

    await expect(run(formData)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.insertRows).toEqual([]);
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("rejects with INTERNAL_SERVER_ERROR when the chapters lookup fails", async () => {
    state.existingChapterIds = [1];
    state.chaptersQueryError = new Error("boom");
    const formData = new FormData();
    formData.append("chapter_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("rejects with INTERNAL_SERVER_ERROR when the membership insert fails", async () => {
    state.existingChapterIds = [1];
    state.insertError = new Error("boom");
    const formData = new FormData();
    formData.append("chapter_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });

  it("rejects with INTERNAL_SERVER_ERROR when the membership delete fails", async () => {
    state.existingChapterIds = [1];
    state.deleteError = new Error("boom");
    const formData = new FormData();
    formData.append("chapter_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(addChapterTag).not.toHaveBeenCalled();
    expect(removeChapterTag).not.toHaveBeenCalled();
  });
});