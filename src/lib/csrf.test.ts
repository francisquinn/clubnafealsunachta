import { describe, it, expect } from "vitest";
import { isTrustedOrigin } from "./csrf";

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    url,
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as Request;
}

describe("isTrustedOrigin", () => {
  it("returns true when the Origin header matches the request origin", () => {
    const request = makeRequest("https://clubnafealsunachta.com/api/login", {
      origin: "https://clubnafealsunachta.com",
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it("returns false when the Origin header is a different origin", () => {
    const request = makeRequest("https://clubnafealsunachta.com/api/login", {
      origin: "https://evil.example.com",
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it("falls back to the Referer header when Origin is missing", () => {
    const request = makeRequest("https://clubnafealsunachta.com/api/login", {
      referer: "https://clubnafealsunachta.com/login",
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it("returns false when neither Origin nor Referer is present", () => {
    const request = makeRequest("https://clubnafealsunachta.com/api/login");
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it("returns false when the Origin header is malformed", () => {
    const request = makeRequest("https://clubnafealsunachta.com/api/login", {
      origin: "not-a-url",
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });
});
