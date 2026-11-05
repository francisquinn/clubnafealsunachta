// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// #205: the deploy-succeeded function only announces from production
// deploys, and only events saved before the deploy started.
const announce = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/eventAnnouncements", () => ({ announcePendingEvents: announce }));

import deploySucceeded from "./deploy-succeeded";

const call = (payload: Record<string, unknown>) =>
  deploySucceeded(
    new Request("https://club.example/.netlify/functions/deploy-succeeded", {
      method: "POST",
      body: JSON.stringify({ payload: { id: "d1", context: "production", created_at: "2099-01-01T11:55:00Z", ...payload } }),
    }),
  );

beforeEach(() => {
  announce.mockReset().mockResolvedValue({ events: 0, sent: 0, failed: 0, skipped: 0 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deploy-succeeded", () => {
  it("announces events saved before a production deploy started", async () => {
    await call({});
    expect(announce).toHaveBeenCalledWith(expect.any(String), new Date("2099-01-01T11:55:00Z"));
  });

  it("does nothing for deploy previews and branch deploys, which share the database", async () => {
    for (const context of ["deploy-preview", "branch-deploy"]) {
      await call({ context });
    }
    expect(announce).not.toHaveBeenCalled();
  });

  it("does nothing without a usable deploy start time, and says so", async () => {
    await call({ created_at: undefined });
    expect(announce).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("does nothing with an unreadable body", async () => {
    await deploySucceeded(new Request("https://club.example/", { method: "POST", body: "not json" }));
    expect(announce).not.toHaveBeenCalled();
  });
});
