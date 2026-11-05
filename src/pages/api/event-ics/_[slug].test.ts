import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ result: null as unknown, error: null as Error | null }));

vi.mock("../../../lib/liveEvent", async () => ({
  ...(await vi.importActual<typeof import("../../../lib/liveEvent")>("../../../lib/liveEvent")),
  fetchLiveEvent: async () => {
    if (state.error) throw state.error;
    return state.result;
  },
}));

import { GET } from "./[slug]";

const call = (slug?: string) => GET({ params: { slug } } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  state.result = null;
  state.error = null;
});

describe("GET /api/event-ics/:slug", () => {
  it("serves live ICS content, uncached", async () => {
    state.result = {
      name: "Live Talk",
      date: "2030-06-01T11:00:00.000Z",
      endDate: "2030-06-01T12:00:00.000Z",
      isOnline: true,
      meetingUrl: "https://meet.jit.si/new",
      meetPoint: null,
      description: null,
      summary: null,
      venue: null,
    };
    const res = await call("live-talk");
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toContain("SUMMARY:Live Talk");
    expect(body).toContain("UID:event-live-talk@clubnafealsunachta.com");
    expect(body).toContain("https://meet.jit.si/new");
  });

  it("404s for an unknown event", async () => {
    expect((await call("gone")).status).toBe(404);
  });

  it("503s when the lookup fails", async () => {
    state.error = new Error("db down");
    expect((await call("talk")).status).toBe(503);
  });
});
