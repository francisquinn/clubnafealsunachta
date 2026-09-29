export const prerender = false;
import type { APIRoute } from "astro";
import {
  getSessionToken,
  verifySessionToken,
  isSessionRevoked,
  loggedInHintCookie,
  clearedLoggedInHintCookie,
  avatarHintCookie,
  clearedAvatarHintCookie,
  type AvatarHintMember,
} from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export const GET: APIRoute = async ({ request }) => {
  const token = getSessionToken(request);
  let payload = token ? verifySessionToken(token) : null;

  // `member` is a live lookup - display name and avatar aren't in the token at
  // all (and can change independently of the session), so AccountMenu (the
  // only consumer) needs a fresh read to render the signed-in member's real
  // avatar rather than a stale/generic one. The same row carries
  // sessions_valid_after, so a session revoked by a password reset reads as
  // logged out here (and the hint cookies below get cleared) instead of
  // showing a logged-in state that every gated page would then reject.
  let member: AvatarHintMember | null = null;
  if (payload && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("members")
      .select("id, username, full_name, display_full_name, avatar_url, sessions_valid_after")
      .eq("id", payload.memberId)
      .single();
    if (data && !isSessionRevoked(payload.iat, data.sessions_valid_after)) {
      const { sessions_valid_after: _validAfter, ...visible } = data;
      member = visible;
    } else {
      payload = null;
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  // Keeps the hint cookie in sync with the real session on every call, so a session
  // issued before this cookie existed (or one that outlived it) gets it backfilled
  // instead of flashing the wrong logged-in state on every future page load.
  headers.append("Set-Cookie", payload ? loggedInHintCookie() : clearedLoggedInHintCookie());
  // Same backfill/sync reasoning as the logged-in hint above, for
  // AvatarHintScript.astro's pre-hydration render.
  headers.append("Set-Cookie", member ? avatarHintCookie(member) : clearedAvatarHintCookie());

  // isAdmin here is straight from the token, not a live lookup — it only drives
  // showing/hiding the "Admin console" link, and middleware re-checks live before
  // actually granting access, so a stale claim here is at most a dead link, never
  // a privilege leak. See middleware.ts / createMember for the live-checked gates.
  return new Response(JSON.stringify({ loggedIn: !!payload, isAdmin: !!payload?.isAdmin, member }), { headers });
};
