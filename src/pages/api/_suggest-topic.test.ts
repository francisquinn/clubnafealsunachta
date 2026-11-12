// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { createSessionToken } from "../../lib/auth";
import { POST } from "./suggest-topic";

// #140: suggestions are members only, for a chapter the member is in, and
// carry their name only when they tick the box.
const state = vi.hoisted(() => ({
  member: null as Record<string, unknown> | null,
  membership: null as Record<string, unknown> | null,
  membershipFilters: [] as unknown[][],
  sendMail: vi.fn() as Mock,
}));

vi.mock("../../lib/supabase", async () => {
  const { stubFrom, stubQuery } = await import("../../test/supabaseStub");
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () => stubQuery(() => ({ data: state.member, error: null })),
        chapter_members: () =>
          stubQuery((calls) => {
            state.membershipFilters = calls.filter((call) => call.method === "eq").map((call) => call.args);
            return { data: state.membership ? [state.membership] : [], error: null };
          }),
      }),
    },
  };
});

vi.mock("../../lib/email", () => ({
  CLUB_FROM: "club@example.com",
  isEmailConfigured: () => true,
  createTransport: () => ({ sendMail: state.sendMail }),
}));

process.env.JWT_SECRET ??= "test-secret";
vi.stubEnv("EMAIL_INFO", "info@example.com");

const MEMBER = {
  username: "alice",
  full_name: "Alice Byrne",
  display_full_name: false,
  sessions_valid_after: null,
};

function call(body: unknown, { loggedIn = true } = {}): Promise<Response> {
  const token = createSessionToken("m1", false, "alice");
  const request = {
    headers: { get: (n: string) => (n.toLowerCase() === "cookie" && loggedIn ? `session=${token}` : null) },
    json: async () => body,
  } as unknown as Request;
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

function sentMail(): { subject: string; text: string; html: string } {
  return state.sendMail.mock.calls[0]![0];
}

beforeEach(() => {
  state.member = { ...MEMBER };
  state.membership = { chapters: { name: "Dublin" } };
  state.membershipFilters = [];
  state.sendMail = vi.fn().mockResolvedValue({});
});

describe("POST /api/suggest-topic", () => {
  it("turns away a signed-out visitor without sending anything", async () => {
    const res = await call({ topics: ["Stoicism"], chapterId: 1 }, { loggedIn: false });
    expect(res.status).toBe(401);
    expect(state.sendMail).not.toHaveBeenCalled();
  });

  it("turns away a session the member has since revoked", async () => {
    state.member = { ...MEMBER, sessions_valid_after: new Date(Date.now() + 60_000).toISOString() };
    const res = await call({ topics: ["Stoicism"], chapterId: 1 });
    expect(res.status).toBe(401);
    expect(state.sendMail).not.toHaveBeenCalled();
  });

  it("checks membership of the chosen chapter for this member", async () => {
    await call({ topics: ["Stoicism"], chapterId: 7 });
    expect(state.membershipFilters).toEqual([
      ["member_id", "m1"],
      ["chapter_id", 7],
    ]);
  });

  it("stays anonymous unless includeName is exactly true", async () => {
    await call({ topics: ["Stoicism"], chapterId: 1, includeName: "yes" });
    expect(sentMail().text).toContain("From a member of Dublin");
    expect(sentMail().text).not.toContain("alice");
  });

  it("turns away a chapter the member isn't in", async () => {
    state.membership = null;
    const res = await call({ topics: ["Stoicism"], chapterId: 2 });
    expect(res.status).toBe(403);
    expect(state.sendMail).not.toHaveBeenCalled();
  });

  it("asks for a chapter when none is given", async () => {
    const res = await call({ topics: ["Stoicism"] });
    expect(res.status).toBe(400);
  });

  it("sends an anonymous suggestion by default, naming only the chapter", async () => {
    const res = await call({ topics: ["Stoicism"], chapterId: 1 });
    expect(res.status).toBe(200);
    const mail = sentMail();
    expect(mail.subject).toBe("New topic suggestion(s) for Dublin");
    expect(mail.text).toContain("From a member of Dublin");
    expect(mail.text + mail.html).not.toContain("alice");
    expect(mail.text + mail.html).not.toContain("Alice Byrne");
  });

  it("uses the username when the member includes a name but hides their full name", async () => {
    await call({ topics: ["Stoicism"], chapterId: 1, includeName: true });
    expect(sentMail().text).toContain("From alice, Dublin");
    expect(sentMail().html).not.toContain("Alice Byrne");
  });

  it("uses the full name when the member includes a name and shows it", async () => {
    state.member = { ...MEMBER, display_full_name: true };
    await call({ topics: ["Stoicism"], chapterId: 1, includeName: true });
    expect(sentMail().text).toContain("From Alice Byrne, Dublin");
  });
});
