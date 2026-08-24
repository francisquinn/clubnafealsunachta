import { describe, it, expect, vi, beforeEach } from "vitest";

// #37: getAdminScope/requireAdmin resolve super-admin vs per-club scope by
// querying members/club_admins live - mock the two tables independently so
// each test controls exactly what comes back, same shape as the real
// supabase-js chain (`.from().select().eq()[.single()]`).
const state = vi.hoisted(() => ({
  members: null as { is_admin: boolean } | null,
  clubAdmins: [] as { club_id: number }[],
}));

vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "members") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.members }) }) }) };
      }
      if (table === "club_admins") {
        return { select: () => ({ eq: () => Promise.resolve({ data: state.clubAdmins }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { getAdminScope, requireAdmin, createSessionToken, isClubInScope } from "./auth";

// Mocking ./supabase (above) also skips its `import "dotenv/config"` side
// effect, so JWT_SECRET never gets loaded from .env - set it directly
// instead of relying on that transitive load.
process.env.JWT_SECRET ??= "test-secret";

function makeRequest(cookie: string): Request {
  return { headers: { get: (name: string) => (name.toLowerCase() === "cookie" ? cookie : null) } } as unknown as Request;
}

beforeEach(() => {
  state.members = null;
  state.clubAdmins = [];
});

describe("getAdminScope", () => {
  it("grants isSuperAdmin with no clubIds when members.is_admin is true", async () => {
    state.members = { is_admin: true };
    state.clubAdmins = [{ club_id: 1 }]; // should be ignored once super admin is found

    const scope = await getAdminScope("member-1");

    expect(scope).toEqual({ memberId: "member-1", isSuperAdmin: true, clubIds: [] });
  });

  it("resolves clubIds from club_admins when not a super admin", async () => {
    state.members = { is_admin: false };
    state.clubAdmins = [{ club_id: 1 }, { club_id: 2 }];

    const scope = await getAdminScope("member-2");

    expect(scope).toEqual({ memberId: "member-2", isSuperAdmin: false, clubIds: [1, 2] });
  });

  it("fails closed with no rights when the member row is missing", async () => {
    state.members = null;

    const scope = await getAdminScope("ghost");

    expect(scope).toEqual({ memberId: "ghost", isSuperAdmin: false, clubIds: [] });
  });
});

describe("requireAdmin", () => {
  it("returns null when there is no session cookie", async () => {
    expect(await requireAdmin(makeRequest(""))).toBeNull();
  });

  it("returns the scope for a super admin", async () => {
    state.members = { is_admin: true };
    const token = createSessionToken("member-1", true);

    const scope = await requireAdmin(makeRequest(`session=${token}`));

    expect(scope).toEqual({ memberId: "member-1", isSuperAdmin: true, clubIds: [] });
  });

  it("returns the scope for a club-scoped (non-super) admin", async () => {
    state.members = { is_admin: false };
    state.clubAdmins = [{ club_id: 3 }];
    const token = createSessionToken("member-2", false);

    const scope = await requireAdmin(makeRequest(`session=${token}`));

    expect(scope).toEqual({ memberId: "member-2", isSuperAdmin: false, clubIds: [3] });
  });

  it("returns null for a member with no super-admin flag and no club_admins rows", async () => {
    state.members = { is_admin: false };
    state.clubAdmins = [];
    const token = createSessionToken("member-3", false);

    expect(await requireAdmin(makeRequest(`session=${token}`))).toBeNull();
  });
});

describe("isClubInScope", () => {
  const superAdmin = { memberId: "m1", isSuperAdmin: true, clubIds: [] };
  const clubScoped = { memberId: "m2", isSuperAdmin: false, clubIds: [1, 2] };

  it("lets a super admin touch any club, including a null (global) one", () => {
    expect(isClubInScope(superAdmin, 1)).toBe(true);
    expect(isClubInScope(superAdmin, 99)).toBe(true);
    expect(isClubInScope(superAdmin, null)).toBe(true);
  });

  it("lets a club-scoped admin touch only the clubs they administer", () => {
    expect(isClubInScope(clubScoped, 1)).toBe(true);
    expect(isClubInScope(clubScoped, 3)).toBe(false);
  });

  // Regression: a club-scoped admin must not be able to leave something
  // unscoped (null club_id) just by omitting a club - that's equivalent to
  // the "no specific chapter" option, which only a super admin may pick.
  it("never lets a club-scoped admin touch a null (global) club", () => {
    expect(isClubInScope(clubScoped, null)).toBe(false);
  });
});
