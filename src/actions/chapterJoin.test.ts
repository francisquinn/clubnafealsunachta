import { describe, it, expect, vi, beforeEach } from "vitest";

// Handler-level tests for joinChapter and getChapterMembership; same mocking
// approach as chapterMembers.test.ts (defineAction returns the definition, the
// Supabase admin client is a per-table stub, Mailchimp is mocked wholesale).
const state = vi.hoisted(() => ({
  payload: { memberId: "member-1", isAdmin: false } as { memberId: string; isAdmin: boolean } | null,
  chapter: { id: 2, slug: "online" } as { id: number; slug: string } | null,
  chapterError: null as Error | null,
  upsertError: null as Error | null,
  upsertRows: null as { member_id: string; chapter_id: number }[] | null,
  upsertOptions: null as Record<string, unknown> | null,
  membership: null as { chapter_id: number } | null,
  membershipError: null as Error | null,
  membershipFilters: [] as unknown[][],
  memberEmail: "a@example.com" as string | null,
  tagError: null as Error | null,
}));

vi.mock("astro:actions", async () => (await import("../test/astroActions")).mockActionModule());

vi.mock("../lib/auth", () => ({
  verifySession: async (token?: string) => (token ? state.payload : null),
}));

vi.mock("../lib/supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        chapters: () => stubQuery(() => ({ data: state.chapter, error: state.chapterError })),
        members: () => stubQuery(() => ({ data: state.memberEmail ? { email: state.memberEmail } : null, error: null })),
        chapter_members: () =>
          stubQuery((calls) => {
            const upsert = calls.find((call) => call.method === "upsert");
            if (upsert) {
              state.upsertRows = upsert.args[0] as { member_id: string; chapter_id: number }[];
              state.upsertOptions = upsert.args[1] as Record<string, unknown>;
              return { error: state.upsertError };
            }
            state.membershipFilters = calls.filter((call) => call.method === "eq").map((call) => call.args);
            return { data: state.membership, error: state.membershipError };
          }),
      }),
    },
  };
});

vi.mock("../lib/mailchimp", () => ({
  addChapterTag: vi.fn(async () => {
    if (state.tagError) throw state.tagError;
  }),
  removeChapterTag: vi.fn(),
}));

import { joinChapter, getChapterMembership } from "./chapterMembers";
import { addChapterTag } from "../lib/mailchimp";

type Handler<T> = {
  handler: (input: { chapterId: number }, context: { cookies: { get: (name: string) => { value: string } | null } }) => Promise<T>;
};
const join = joinChapter as unknown as Handler<{ joined: boolean }>;
const membership = getChapterMembership as unknown as Handler<{ joined: boolean }>;

function ctx(session?: string) {
  return { cookies: { get: (name: string) => (name === "session" && session ? { value: session } : null) } };
}

beforeEach(() => {
  state.payload = { memberId: "member-1", isAdmin: false };
  state.chapter = { id: 2, slug: "online" };
  state.chapterError = null;
  state.upsertError = null;
  state.upsertRows = null;
  state.upsertOptions = null;
  state.membership = null;
  state.membershipError = null;
  state.membershipFilters = [];
  state.memberEmail = "a@example.com";
  state.tagError = null;
  vi.mocked(addChapterTag).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("joinChapter", () => {
  it("rejects a logged-out visitor", async () => {
    await expect(join.handler({ chapterId: 2 }, ctx())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.upsertRows).toBeNull();
  });

  it("answers NOT_FOUND for a chapter that does not exist", async () => {
    state.chapter = null;
    await expect(join.handler({ chapterId: 99 }, ctx("token"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.upsertRows).toBeNull();
  });

  it("adds just that one membership, tolerating a repeat, and tags Mailchimp", async () => {
    await expect(join.handler({ chapterId: 2 }, ctx("token"))).resolves.toEqual({ joined: true });
    expect(state.upsertRows).toEqual([{ member_id: "member-1", chapter_id: 2 }]);
    expect(state.upsertOptions).toMatchObject({ onConflict: "member_id,chapter_id", ignoreDuplicates: true });
    expect(addChapterTag).toHaveBeenCalledWith("a@example.com", "online");
  });

  it("fails with INTERNAL_SERVER_ERROR when the insert fails", async () => {
    state.upsertError = new Error("boom");
    await expect(join.handler({ chapterId: 2 }, ctx("token"))).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(addChapterTag).not.toHaveBeenCalled();
  });

  it("still succeeds when the Mailchimp tag fails", async () => {
    state.tagError = new Error("mailchimp down");
    await expect(join.handler({ chapterId: 2 }, ctx("token"))).resolves.toEqual({ joined: true });
  });
});

describe("getChapterMembership", () => {
  it("rejects a logged-out visitor", async () => {
    await expect(membership.handler({ chapterId: 2 }, ctx())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("reports not joined when there is no row, filtering by this member and chapter", async () => {
    await expect(membership.handler({ chapterId: 2 }, ctx("token"))).resolves.toEqual({ joined: false });
    expect(state.membershipFilters).toEqual([["member_id", "member-1"], ["chapter_id", 2]]);
  });

  it("reports joined when the row exists", async () => {
    state.membership = { chapter_id: 2 };
    await expect(membership.handler({ chapterId: 2 }, ctx("token"))).resolves.toEqual({ joined: true });
  });

  it("fails with INTERNAL_SERVER_ERROR on a query error", async () => {
    state.membershipError = new Error("boom");
    await expect(membership.handler({ chapterId: 2 }, ctx("token"))).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
