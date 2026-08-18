export const prerender = false;
import type { APIRoute } from "astro";
import { getSessionToken, verifySessionToken, loggedInHintCookie, clearedLoggedInHintCookie } from "../../lib/auth";

export const GET: APIRoute = ({ request }) => {
  const token = getSessionToken(request);
  const payload = token ? verifySessionToken(token) : null;

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  // Keeps the hint cookie in sync with the real session on every call, so a session
  // issued before this cookie existed (or one that outlived it) gets it backfilled
  // instead of flashing the wrong logged-in state on every future page load.
  headers.append("Set-Cookie", payload ? loggedInHintCookie() : clearedLoggedInHintCookie());

  // isAdmin here is straight from the token, not a live lookup — it only drives
  // showing/hiding the "Admin console" link, and middleware re-checks live before
  // actually granting access, so a stale claim here is at most a dead link, never
  // a privilege leak. See middleware.ts / createMember for the live-checked gates.
  return new Response(JSON.stringify({ loggedIn: !!payload, isAdmin: !!payload?.isAdmin }), { headers });
};
