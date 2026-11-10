import { describe, it, expect, vi, beforeEach } from "vitest";

// #223: the profile page's member lookup. The Supabase client is untyped, so
// these pin the case-insensitive match and the escaping astro check can't.
const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
  calls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("./supabase", async () => {
  const { stubFrom, stubQuery } = await import("../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            state.calls = calls;
            return { data: state.error ? null : state.rows, error: state.error };
          }),
      }),
    },
  };
});

import { findMemberByUsername } from "./memberProfile";

const alice = {
  id: "m1",
  username: "alice_b",
  full_name: null,
  display_full_name: false,
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  state.rows = [];
  state.error = null;
  state.calls = [];
});

describe("findMemberByUsername", () => {
  it("matches the username ignoring case, with LIKE wildcards escaped", async () => {
    state.rows = [alice];

    await expect(findMemberByUsername("Alice_B")).resolves.toEqual(alice);

    expect(state.calls).toContainEqual({ method: "ilike", args: ["username", "Alice\\_B"] });
    expect(state.calls.some((c) => c.method === "eq")).toBe(false);
  });

  it("returns null when no member has that username", async () => {
    await expect(findMemberByUsername("nobody")).resolves.toBeNull();
  });

  it("returns null and logs when the lookup fails", async () => {
    state.error = { message: "boom" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(findMemberByUsername("alice_b")).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith("Failed to load member for profile page:", "boom");
    consoleError.mockRestore();
  });
});
