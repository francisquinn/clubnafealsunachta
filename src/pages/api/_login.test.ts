// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { hashPassword, verifySessionToken } from "../../lib/auth";
import { POST } from "./login";

// #162: login sets the session every gated route relies on. Bad password and
// unknown user must look the same, and a failed lookup must never log anyone in.
const state = vi.hoisted(() => ({
  byEmail: null as Record<string, unknown> | null,
  byUsername: null as Record<string, unknown> | null,
  error: null as { code: string; message: string } | null,
}));

vi.mock("../../lib/supabase", async () => {
  const { stubFrom, stubQuery } = await import("../../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            if (state.error) return { data: null, error: state.error };
            const ilike = calls.find((c) => c.method === "ilike");
            if (!ilike) {
              const email = calls.find((c) => c.method === "eq")?.args[1];
              return { data: email === state.byEmail?.email ? state.byEmail : null, error: null };
            }
            return { data: ilike.args[1] === state.byUsername?.username ? state.byUsername : null, error: null };
          }),
      }),
    },
  };
});

process.env.JWT_SECRET ??= "test-secret";

const PASSWORD = "Correct-horse1";
let member: Record<string, unknown>;

beforeAll(async () => {
  member = {
    id: "m1",
    email: "alice@example.com",
    password_hash: await hashPassword(PASSWORD),
    is_admin: false,
    email_verified_at: "2026-01-01",
    username: "alice",
    full_name: null,
    display_full_name: false,
    avatar_url: null,
  };
});

beforeEach(() => {
  state.byEmail = member;
  state.byUsername = null;
  state.error = null;
});

function login(identifier: string, password: string): Promise<Response> {
  const form = new FormData();
  form.set("identifier", identifier);
  form.set("password", password);
  const request = new Request("http://localhost/api/login", { method: "POST", body: form });
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

const cookieNames = (res: Response) => res.headers.getSetCookie().map((c) => c.split("=")[0]);

describe("POST /api/login", () => {
  it("sets the session and both hint cookies for good credentials", async () => {
    const res = await login("Alice@Example.com", PASSWORD);
    expect(res.status).toBe(200);
    expect(cookieNames(res)).toEqual(["session", "cnf_logged_in", "cnf_avatar_hint"]);

    const [session, loggedIn, avatarHint] = res.headers.getSetCookie() as [string, string, string];
    expect(loggedIn).toMatch(/^cnf_logged_in=1;/);
    expect(avatarHint).toMatch(/^cnf_avatar_hint=[^;]+;/);
    for (const cookie of [session, loggedIn, avatarHint]) {
      expect(cookie).toMatch(/Max-Age=[1-9]\d*/);
    }
    expect(session).toContain("HttpOnly");
    const token = session.slice("session=".length).split(";")[0]!;
    expect(verifySessionToken(token)).toMatchObject({ memberId: "m1", isAdmin: false, username: "alice" });
  });

  it("logs in by username when no email matches", async () => {
    state.byEmail = null;
    state.byUsername = member;
    const res = await login("alice", PASSWORD);
    expect(res.status).toBe(200);
  });

  it("gives the same error for a bad password and an unknown user", async () => {
    const badPassword = await login("alice@example.com", "Wrong-password1");
    state.byEmail = null;
    const unknownUser = await login("nobody@example.com", PASSWORD);

    expect(badPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(await badPassword.json()).toEqual(await unknownUser.json());
    expect(badPassword.headers.getSetCookie()).toEqual([]);
    expect(unknownUser.headers.getSetCookie()).toEqual([]);
  });

  // login.ts never reads the lookup error: a failed lookup reads as "no such
  // member", so this pins the fail-closed outcome rather than error handling.
  it("does not log anyone in when the lookup fails", async () => {
    state.error = { code: "08006", message: "connection failure" };
    const res = await login("alice@example.com", PASSWORD);
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("rejects a missing identifier or password", async () => {
    expect((await login("", PASSWORD)).status).toBe(401);
    expect((await login("alice@example.com", "")).status).toBe(401);
  });

  it("refuses an unverified email without setting a session", async () => {
    state.byEmail = { ...member, email_verified_at: null };
    const res = await login("alice@example.com", PASSWORD);
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
