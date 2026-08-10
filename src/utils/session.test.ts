import { describe, it, expect, vi, beforeEach } from "vitest";

async function importFresh() {
  vi.resetModules();
  return import("./session.ts");
}

describe("fetchSessionInfo / refreshSessionInfo", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ loggedIn: true, isAdmin: false }) }))
    );
  });

  it("coalesces concurrent calls into a single request", async () => {
    const { fetchSessionInfo } = await importFresh();

    const [a, b] = await Promise.all([fetchSessionInfo(), fetchSessionInfo()]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ loggedIn: true, isAdmin: false });
    expect(b).toEqual({ loggedIn: true, isAdmin: false });
  });

  it("reuses the cached result for later calls, even after the first resolves", async () => {
    const { fetchSessionInfo } = await importFresh();

    await fetchSessionInfo();
    await fetchSessionInfo();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshSessionInfo always issues a fresh request", async () => {
    const { fetchSessionInfo, refreshSessionInfo } = await importFresh();

    await fetchSessionInfo();
    await refreshSessionInfo();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fetchSessionInfo after a refresh reuses the refreshed value", async () => {
    const { fetchSessionInfo, refreshSessionInfo } = await importFresh();

    await refreshSessionInfo();
    await fetchSessionInfo();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
