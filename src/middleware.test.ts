import { describe, it, expect, vi } from "vitest";
import { onRequest } from "./middleware";

function makeContext(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {},
) {
  const lower = new Map(Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const request = {
    url,
    method: options.method ?? "GET",
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as Request;
  return { request, url: new URL(url) } as Parameters<typeof onRequest>[0];
}

describe("middleware CSRF check", () => {
  it("allows GET requests without an Origin header", async () => {
    const next = vi.fn().mockResolvedValue("next-response");
    const context = makeContext("https://clubnafealsunachta.com/");

    const result = await onRequest(context, next);

    expect(next).toHaveBeenCalled();
    expect(result).toBe("next-response");
  });

  it("blocks POST requests with a mismatched Origin header", async () => {
    const next = vi.fn();
    const context = makeContext("https://clubnafealsunachta.com/api/login", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });

    const result = await onRequest(context, next);

    expect(next).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("blocks POST requests with no Origin or Referer header", async () => {
    const next = vi.fn();
    const context = makeContext("https://clubnafealsunachta.com/api/login", {
      method: "POST",
    });

    const result = await onRequest(context, next);

    expect(next).not.toHaveBeenCalled();
    expect((result as Response).status).toBe(403);
  });

  it("allows POST requests with a matching Origin header", async () => {
    const next = vi.fn().mockResolvedValue("next-response");
    const context = makeContext("https://clubnafealsunachta.com/api/login", {
      method: "POST",
      headers: { origin: "https://clubnafealsunachta.com" },
    });

    const result = await onRequest(context, next);

    expect(next).toHaveBeenCalled();
    expect(result).toBe("next-response");
  });
});
