import { describe, it, expect, vi } from "vitest";
const mockMoved = vi.hoisted(() => vi.fn());
vi.mock("./lib/movedEventRedirect", () => ({ findMovedEventPath: mockMoved }));

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

describe("middleware admin gate", () => {
  it("sends a logged-out visitor to the homepage with the login modal flag", async () => {
    const next = vi.fn();
    const redirect = vi.fn().mockReturnValue("redirect-response");
    const context = { ...makeContext("https://clubnafealsunachta.com/admin/events"), redirect };

    const result = await onRequest(context as Parameters<typeof onRequest>[0], next);

    expect(redirect).toHaveBeenCalledWith("/?login=1");
    expect(next).not.toHaveBeenCalled();
    expect(result).toBe("redirect-response");
  });
});

describe("middleware moved-event redirect (#195)", () => {
  it("redirects a 404 on a stale event URL to the event's current chapter", async () => {
    const next = vi.fn().mockResolvedValue({ status: 404 });
    const redirect = vi.fn().mockReturnValue("redirect-response");
    const context = { ...makeContext("https://clubnafealsunachta.com/trieste/events/talk-one"), redirect };
    mockMoved.mockResolvedValue("/gorizia/events/talk-one");

    const result = await onRequest(context as Parameters<typeof onRequest>[0], next);

    expect(redirect).toHaveBeenCalledWith("/gorizia/events/talk-one", 302);
    expect(result).toBe("redirect-response");
  });

  it("leaves a 404 alone when no event moved", async () => {
    const response = { status: 404 };
    const next = vi.fn().mockResolvedValue(response);
    mockMoved.mockResolvedValue(null);

    const result = await onRequest(makeContext("https://clubnafealsunachta.com/trieste/events/nope"), next);

    expect(result).toBe(response);
  });

  it("does not look anything up for a successful response", async () => {
    mockMoved.mockClear();
    const response = { status: 200 };
    const next = vi.fn().mockResolvedValue(response);

    await onRequest(makeContext("https://clubnafealsunachta.com/trieste/events/talk-two"), next);

    expect(mockMoved).not.toHaveBeenCalled();
  });

  it("redirects a HEAD request too", async () => {
    const next = vi.fn().mockResolvedValue({ status: 404 });
    const redirect = vi.fn().mockReturnValue("redirect-response");
    const context = {
      ...makeContext("https://clubnafealsunachta.com/trieste/events/talk-one", { method: "HEAD" }),
      redirect,
    };
    mockMoved.mockResolvedValue("/gorizia/events/talk-one");

    expect(await onRequest(context as Parameters<typeof onRequest>[0], next)).toBe("redirect-response");
  });

  it("does not redirect a POST that 404s", async () => {
    mockMoved.mockClear();
    const response = { status: 404 };
    const next = vi.fn().mockResolvedValue(response);
    const context = makeContext("https://clubnafealsunachta.com/trieste/events/talk-one", {
      method: "POST",
      headers: { origin: "https://clubnafealsunachta.com" },
    });

    expect(await onRequest(context, next)).toBe(response);
    expect(mockMoved).not.toHaveBeenCalled();
  });

  it("never runs the lookup for /admin paths", async () => {
    mockMoved.mockClear();
    const next = vi.fn().mockResolvedValue({ status: 404 });
    const context = { ...makeContext("https://clubnafealsunachta.com/admin/events/x"), redirect: vi.fn() };

    await onRequest(context as Parameters<typeof onRequest>[0], next);

    expect(mockMoved).not.toHaveBeenCalled();
  });

  it("keeps the query string on the redirect", async () => {
    const next = vi.fn().mockResolvedValue({ status: 404 });
    const redirect = vi.fn().mockReturnValue("redirect-response");
    const context = {
      ...makeContext("https://clubnafealsunachta.com/trieste/events/talk-one?ref=x"),
      redirect,
    };
    mockMoved.mockResolvedValue("/gorizia/events/talk-one");

    await onRequest(context as Parameters<typeof onRequest>[0], next);

    expect(redirect).toHaveBeenCalledWith("/gorizia/events/talk-one?ref=x", 302);
  });

  it("returns the original 404 when the lookup throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = { status: 404 };
    const next = vi.fn().mockResolvedValue(response);
    mockMoved.mockRejectedValue(new Error("boom"));

    const result = await onRequest(makeContext("https://clubnafealsunachta.com/trieste/events/talk-one"), next);

    expect(result).toBe(response);
  });
});
