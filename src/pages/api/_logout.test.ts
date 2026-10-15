// @vitest-environment node
import { describe, it, expect } from "vitest";
import { POST } from "./logout";

describe("POST /api/logout", () => {
  it("clears the session and both hint cookies and redirects home", async () => {
    const res = (await POST({} as Parameters<typeof POST>[0])) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");

    const cookies = res.headers.getSetCookie();
    expect(cookies.map((c) => c.split("=")[0])).toEqual(["session", "cnf_logged_in", "cnf_avatar_hint"]);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/^[a-z_]+=;/);
      expect(cookie).toContain("Max-Age=0");
    }
  });
});
