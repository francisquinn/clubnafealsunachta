import { describe, it, expect, vi, beforeEach } from "vitest";

// Handler-level tests for updateClubMemberships. Astro actions don't expose
// their `handler` in tests, so `defineAction` is mocked to return the
// definition object as-is (giving us the raw handler to invoke) and
// `ActionError` is stubbed with the same shape the real class throws
// (`code` + `message`). The Supabase admin client is mocked table by table,
// same chained shape as real supabase-js, with `state` letting each test
// control exactly what comes back.
const state = vi.hoisted(() => ({
  payload: { memberId: "member-1", isAdmin: false } as { memberId: string; isAdmin: boolean } | null,
  existingClubIds: [] as number[],
  clubsQueryError: null as Error | null,
  insertError: null as Error | null,
  insertRows: [] as { member_id: string; club_id: number }[],
  deleteError: null as Error | null,
  deleteMemberId: null as string | null,
  deleteNotOp: null as string | null,
}));

vi.mock("astro:actions", () => {
  class MockActionError extends Error {
    code: string;
    constructor(params: { message?: string; code: string }) {
      super(params.message);
      this.name = "ActionError";
      this.code = params.code;
    }
  }
  return {
    defineAction: (definition: { accept: string; handler: unknown }) => definition,
    ActionError: MockActionError,
  };
});

vi.mock("../lib/auth", () => ({
  verifySessionToken: () => state.payload,
}));

// Mocking ../lib/supabase (below) also skips its `import "dotenv/config"`
// side effect, so SUPABASE_* / JWT_SECRET never load from .env — none of
// them are read here (verifySessionToken is mocked, supabaseAdmin is
// replaced), so that's fine.
vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "clubs") {
        return {
          select: () => ({
            in: (_column: string, ids: number[]) =>
              Promise.resolve({
                data: ids.filter((id) => state.existingClubIds.includes(id)).map((id) => ({ id })),
                error: state.clubsQueryError,
              }),
          }),
        };
      }
      if (table === "club_members") {
        return {
          upsert: (rows: { member_id: string; club_id: number }[]) => {
            state.insertRows = rows;
            return Promise.resolve({ error: state.insertError });
          },
          delete: () => ({
            eq: (_column: string, memberId: string) => {
              state.deleteMemberId = memberId;
              const deleteChain = {
                not: (_column2: string, _operation: string, opValue: string) => {
                  state.deleteNotOp = opValue;
                  return Promise.resolve({ error: state.deleteError });
                },
              };
              // Awaitable (no .not when every club is being unselected) and
              // chainable (.not returns the final error result).
              return Object.assign(deleteChain, Promise.resolve({ error: state.deleteError }));
            },
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { updateClubMemberships } from "./clubMembers";

// The mocked defineAction above returns the definition object (not Astro's
// real client wrapper), so the raw handler is what reaches `handler`.
const action = updateClubMemberships as unknown as {
  handler: (formData: FormData, context: { cookies: { get: (name: string) => { value: string } | null } }) => Promise<{ success: boolean; club_ids: number[] }>;
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

describe("updateClubMemberships", () => {
  beforeEach(() => {
    state.payload = { memberId: "member-1", isAdmin: false };
    state.existingClubIds = [];
    state.clubsQueryError = null;
    state.insertError = null;
    state.insertRows = [];
    state.deleteError = null;
    state.deleteMemberId = null;
    state.deleteNotOp = null;
  });

  it("rejects with UNAUTHORIZED when there is no session cookie", async () => {
    await expect(run(new FormData(), "")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects with UNAUTHORIZED when the session token does not verify", async () => {
    state.payload = null;

    await expect(run(new FormData(), "session-token")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("registers the member to each selected club and unregisters the rest", async () => {
    state.existingClubIds = [1, 2];
    const formData = new FormData();
    formData.append("club_id", "1");
    formData.append("club_id", "2");
    formData.append("club_id", "1"); // duplicate — one membership per (member, club)

    await expect(run(formData)).resolves.toEqual({ success: true, club_ids: [1, 2] });

    expect(state.insertRows).toEqual([
      { member_id: "member-1", club_id: 1 },
      { member_id: "member-1", club_id: 2 },
    ]);
    expect(state.deleteMemberId).toBe("member-1");
    expect(state.deleteNotOp).toBe("(1,2)");
  });

  it("unregisters from every club when nothing is checked", async () => {
    await expect(run(new FormData())).resolves.toEqual({ success: true, club_ids: [] });

    expect(state.insertRows).toEqual([]);
    expect(state.deleteMemberId).toBe("member-1");
    expect(state.deleteNotOp).toBeNull();
  });

  it("ignores blank or malformed club_id values instead of treating them as club ids", async () => {
    state.existingClubIds = [1];
    const formData = new FormData();
    formData.append("club_id", "1");
    formData.append("club_id", "");

    await expect(run(formData)).resolves.toEqual({ success: true, club_ids: [1] });

    expect(state.insertRows).toEqual([{ member_id: "member-1", club_id: 1 }]);
    expect(state.deleteNotOp).toBe("(1)");
  });

  it("rejects with BAD_REQUEST when a selected club does not exist", async () => {
    state.existingClubIds = [1];
    const formData = new FormData();
    formData.append("club_id", "1");
    formData.append("club_id", "99");

    await expect(run(formData)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.insertRows).toEqual([]);
  });

  it("rejects with INTERNAL_SERVER_ERROR when the clubs lookup fails", async () => {
    state.existingClubIds = [1];
    state.clubsQueryError = new Error("boom");
    const formData = new FormData();
    formData.append("club_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects with INTERNAL_SERVER_ERROR when the membership insert fails", async () => {
    state.existingClubIds = [1];
    state.insertError = new Error("boom");
    const formData = new FormData();
    formData.append("club_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects with INTERNAL_SERVER_ERROR when the membership delete fails", async () => {
    state.existingClubIds = [1];
    state.deleteError = new Error("boom");
    const formData = new FormData();
    formData.append("club_id", "1");

    await expect(run(formData)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});