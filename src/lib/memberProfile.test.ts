import { describe, it, expect, vi, beforeEach } from "vitest";

// #223: the profile page's member lookup. The Supabase client is untyped, so
// these pin the case-insensitive match and the escaping astro check can't.
const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
  calls: [] as { method: string; args: unknown[] }[],
  rsvpCount: 0 as number | null,
  rsvpError: null as { message: string } | null,
  rsvpCalls: [] as { method: string; args: unknown[] }[],
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
        rsvps: () =>
          stubQuery((calls) => {
            state.rsvpCalls = calls;
            return { count: state.rsvpError ? null : state.rsvpCount, error: state.rsvpError };
          }),
      }),
    },
  };
});

import { findMemberByUsername, countPastGoingRsvps } from "./memberProfile";

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
  state.rsvpCount = 0;
  state.rsvpError = null;
  state.rsvpCalls = [];
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

describe("countPastGoingRsvps", () => {
  it("counts only this member's going RSVPs to events that have ended", async () => {
    state.rsvpCount = 3;
    const before = Date.now();

    await expect(countPastGoingRsvps("m1")).resolves.toBe(3);

    expect(state.rsvpCalls).toContainEqual({
      method: "select",
      args: ["event_id, events!inner(end_date)", { count: "exact", head: true }],
    });
    expect(state.rsvpCalls).toContainEqual({ method: "eq", args: ["member_id", "m1"] });
    expect(state.rsvpCalls).toContainEqual({ method: "eq", args: ["status", "going"] });
    const endFilter = state.rsvpCalls.find((c) => c.method === "lt");
    expect(endFilter?.args[0]).toBe("events.end_date");
    expect(new Date(String(endFilter?.args[1])).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("returns 0 when the count comes back null", async () => {
    state.rsvpCount = null;
    await expect(countPastGoingRsvps("m1")).resolves.toBe(0);
  });

  it("returns 0 and logs when the lookup fails", async () => {
    state.rsvpError = { message: "boom" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(countPastGoingRsvps("m1")).resolves.toBe(0);
    expect(consoleError).toHaveBeenCalledWith("Failed to load past events for profile page:", "boom");

    consoleError.mockRestore();
  });
});
