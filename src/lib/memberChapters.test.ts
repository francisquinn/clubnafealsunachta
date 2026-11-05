import { describe, it, expect, vi, beforeEach } from "vitest";

// #211: the profile's chapter list. The Supabase client is untyped, so these
// pin the select string and the row mapping that astro check can't.
const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[] | null,
  error: null as Error | null,
  calls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("./supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        chapter_members: () =>
          stubQuery((calls) => {
            state.calls = calls;
            return { data: state.rows, error: state.error };
          }),
      }),
    },
  };
});

import { loadMemberChapters } from "./memberChapters";

beforeEach(() => {
  state.rows = [];
  state.error = null;
  state.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadMemberChapters", () => {
  it("reads the member's chapters with their email setting", async () => {
    await loadMemberChapters("member-1");

    expect(state.calls).toEqual([
      { method: "select", args: ["chapter_id, emails_enabled, chapters(name)"] },
      { method: "eq", args: ["member_id", "member-1"] },
    ]);
  });

  it("maps each row and sorts by chapter name", async () => {
    state.rows = [
      { chapter_id: 1, emails_enabled: false, chapters: { name: "Trieste" } },
      { chapter_id: 2, emails_enabled: true, chapters: [{ name: "Online" }] },
    ];

    await expect(loadMemberChapters("member-1")).resolves.toEqual([
      { id: 2, name: "Online", emailsEnabled: true },
      { id: 1, name: "Trieste", emailsEnabled: false },
    ]);
  });

  it("returns an empty list for a member in no chapter", async () => {
    await expect(loadMemberChapters("member-1")).resolves.toEqual([]);
  });

  it("returns null when the lookup fails, rather than an empty list", async () => {
    state.error = new Error("boom");
    await expect(loadMemberChapters("member-1")).resolves.toBeNull();
  });
});
