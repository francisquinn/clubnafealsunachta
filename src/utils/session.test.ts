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

const MEMBER = {
  id: "member-1",
  username: "alice",
  full_name: "Alice Smith",
  display_full_name: false,
  avatar_url: null,
};

describe("cached member (AccountMenu's flash-avoidance)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips through set/get/clear", async () => {
    const { getCachedMember, setCachedMember, clearCachedMember } = await importFresh();

    expect(getCachedMember()).toBeNull();

    setCachedMember(MEMBER);
    expect(getCachedMember()).toEqual(MEMBER);

    clearCachedMember();
    expect(getCachedMember()).toBeNull();
  });

  it("reads as null instead of throwing when the stored value is corrupt", async () => {
    localStorage.setItem("cnf-cached-member", "{not json");
    const { getCachedMember } = await importFresh();

    expect(getCachedMember()).toBeNull();
  });

  it("fetchSessionInfo caches a member the response includes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ loggedIn: true, isAdmin: false, member: MEMBER }) }))
    );
    const { fetchSessionInfo, getCachedMember } = await importFresh();

    await fetchSessionInfo();

    expect(getCachedMember()).toEqual(MEMBER);
  });

  it("fetchSessionInfo clears a stale cached member when the response has none", async () => {
    localStorage.setItem("cnf-cached-member", JSON.stringify(MEMBER));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ loggedIn: false, isAdmin: false, member: null }) }))
    );
    const { fetchSessionInfo, getCachedMember } = await importFresh();

    await fetchSessionInfo();

    expect(getCachedMember()).toBeNull();
  });
});
