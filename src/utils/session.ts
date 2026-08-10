export interface SessionInfo {
  loggedIn: boolean;
  isAdmin: boolean;
}

let current: Promise<SessionInfo> | null = null;

function request(): Promise<SessionInfo> {
  current = fetch("/api/me").then((r) => r.json());
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
