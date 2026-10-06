// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionToken } from "../../lib/auth";
import { GET } from "./me";

// #128: /api/me runs on every page load. A failed members lookup must not
// read as "logged out" (which clears the hint cookies and the client's cached
// member), but a definitive "no such member" still must.
const state = vi.hoisted(() => ({
  member: null as Record<string, unknown> | null,
  errors: [] as ({ code: string } | null)[],
  calls: 0,
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => {
            state.calls++;
            const error = state.errors.shift() ?? null;
            return Promise.resolve(error ? { data: null, error } : { data: state.member, error: null });
          },
        }),
      }),
    }),
  },
}));

process.env.JWT_SECRET ??= "test-secret";

const MEMBER = {
  id: "m1",
  username: "alice",
  full_name: null,
  display_full_name: false,
  avatar_url: null,
  sessions_valid_after: null,
};

const setCookies = (res: Response): string[] => res.headers.getSetCookie();

function call(): Promise<Response> {
  const token = createSessionToken("m1", false, "alice");
  const request = { headers: { get: (n: string) => (n.toLowerCase() === "cookie" ? `session=${token}` : null) } } as unknown as Request;
  return GET({ request } as Parameters<typeof GET>[0]) as Promise<Response>;
}

beforeEach(() => {
  state.member = MEMBER;
  state.errors = [];
  state.calls = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/me", () => {
  it("returns the member and refreshes the hint cookies on success", async () => {
    const res = await call();
    const body = await res.json();

    expect(body).toMatchObject({ loggedIn: true, member: { id: "m1", username: "alice" } });
    expect(body.degraded).toBeUndefined();
    expect(setCookies(res).join("\n")).toContain("cnf_logged_in=1");
  });

  it("recovers from a single transient lookup error without degrading", async () => {
    state.errors = [{ code: "57014" }];

    const body = await (await call()).json();

    expect(state.calls).toBe(2);
    expect(body).toMatchObject({ loggedIn: true, member: { id: "m1" } });
    expect(body.degraded).toBeUndefined();
  });

  it("reports degraded and leaves the hint cookies alone when the lookup keeps failing", async () => {
    state.errors = [{ code: "57014" }, { code: "57014" }];

    const res = await call();
    const body = await res.json();

    expect(body).toMatchObject({ loggedIn: true, member: null, degraded: true });
    // No Set-Cookie at all: the cnf_logged_in and avatar hints must survive.
    // (The success test above proves setCookies() can see the header, so this
    // isn't passing just because the header is hidden from the test.)
    expect(setCookies(res)).toEqual([]);
  });

  it("still reads as logged out, clearing the hint cookies, for a definitive 'no such member'", async () => {
    state.errors = [{ code: "PGRST116" }];

    const res = await call();
    const body = await res.json();

    expect(state.calls).toBe(1);
    expect(body).toMatchObject({ loggedIn: false, member: null });
    expect(body.degraded).toBeUndefined();
    expect(setCookies(res).join("\n")).toContain("cnf_logged_in=;");
  });

  it("still reads as logged out for a revoked session", async () => {
    state.member = { ...MEMBER, sessions_valid_after: new Date(Date.now() + 60_000).toISOString() };

    const res = await call();

    expect((await res.json()).loggedIn).toBe(false);
    expect(setCookies(res).join("\n")).toContain("cnf_logged_in=;");
  });
});
