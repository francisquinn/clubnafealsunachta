export interface CachedMember {
  id: string;
  username: string;
  full_name: string | null;
  display_full_name: boolean;
  avatar_url: string | null;
}

export interface SessionInfo {
  loggedIn: boolean;
  isAdmin: boolean;
  member: CachedMember | null;
}

const MEMBER_CACHE_KEY = "cnf-cached-member";

// AccountMenu reads this synchronously on mount so it can paint the real
// avatar on the very first frame instead of a loading skeleton — every page
// load is a fresh JS context in this MPA, so without persisting across
// reloads somewhere, there'd be nothing to show until /api/me resolves.
// Wrapped in try/catch: localStorage can throw in some private-browsing
// modes, and a missing/corrupt entry should just read as "nothing cached"
// rather than crash the island.
export function getCachedMember(): CachedMember | null {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedMember) : null;
  } catch {
    return null;
  }
}

export function setCachedMember(member: CachedMember): void {
  try {
    localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(member));
  } catch {
    // Storage unavailable/full — fall back to the skeleton-on-load path.
  }
}

export function clearCachedMember(): void {
  try {
    localStorage.removeItem(MEMBER_CACHE_KEY);
  } catch {
    // Nothing to do — see getCachedMember.
  }
}

let current: Promise<SessionInfo> | null = null;

function request(): Promise<SessionInfo> {
  current = fetch("/api/me")
    .then((r) => r.json())
    .then((data: SessionInfo) => {
      // Keeps the cache honest against whatever /api/me actually says,
      // beyond just the explicit write/clear points in AccountForm and the
      // logout form — catches any other way the session or member data
      // could have drifted (expired session, changed elsewhere, etc).
      if (data.member) {
        setCachedMember(data.member);
      } else {
        clearCachedMember();
      }
      return data;
    });
  return current;
}

// Multiple islands (AccountMenu, LoginButton) each need session info on mount.
// This is a full MPA (no client-side routing), so the session can't change
// mid-page except via an explicit action (login reloads the page, logout is
// a form POST) - caching for the page's lifetime means whichever island
// mounts first fetches, and the rest reuse that same result instead of each
// issuing their own /api/me request.
export function fetchSessionInfo(): Promise<SessionInfo> {
  return current ?? request();
}

// Forces a fresh /api/me check, bypassing the cache. Used by LoginButton's
// pageshow handler to catch a session that was revoked while the page sat
// in the back/forward cache - a case fetchSessionInfo's page-lifetime cache
// would otherwise miss.
export function refreshSessionInfo(): Promise<SessionInfo> {
  return request();
}
