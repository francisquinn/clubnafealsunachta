// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// #205: the List-Unsubscribe one-click endpoint. Only a valid signed token
// turns emails off; anything else is a 400 and touches nothing.
const state = vi.hoisted(() => ({ calls: [] as [string, number][], ok: true }));

vi.mock("../../lib/eventAnnouncements", () => ({
  unsubscribeFromChapter: async (memberId: string, chapterId: number) => {
    state.calls.push([memberId, chapterId]);
    return state.ok;
  },
}));

import { POST } from "./unsubscribe";
import { createUnsubscribeToken } from "../../lib/emailLinks";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

beforeEach(() => {
  state.calls = [];
  state.ok = true;
});

function post(token: string) {
  const url = new URL(`https://club.example/api/unsubscribe?t=${encodeURIComponent(token)}`);
  return POST({ url, request: new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }) } as never);
}

describe("POST /api/unsubscribe", () => {
  it("unsubscribes the member from the token's chapter", async () => {
    const response = await post(createUnsubscribeToken("member-1", 3));
    expect(response.status).toBe(204);
    expect(state.calls).toEqual([["member-1", 3]]);
  });

  it("rejects a bad token without touching anything", async () => {
    const response = await post("member-1.3.forged");
    expect(response.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("answers 500 when the update fails", async () => {
    state.ok = false;
    const response = await post(createUnsubscribeToken("member-1", 3));
    expect(response.status).toBe(500);
  });
});
