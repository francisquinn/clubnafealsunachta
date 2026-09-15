export const prerender = false;
import type { APIRoute } from "astro";
import {
  getSessionToken,
  verifySessionToken,
  loggedInHintCookie,
  clearedLoggedInHintCookie,
  avatarHintCookie,
  clearedAvatarHintCookie,
  type AvatarHintMember,
} from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";

export const GET: APIRoute = async ({ request }) => {
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
  //
  // `member` below IS a live lookup, unlike isAdmin — display name and avatar
  // aren't in the token at all (and can change independently of the session),
  // so AccountMenu (the only consumer) needs a fresh read to render the
  // signed-in member's real avatar rather than a stale/generic one.
  let member: AvatarHintMember | null = null;
  if (payload && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("members")
      .select("id, username, full_name, display_full_name, avatar_url")
      .eq("id", payload.memberId)
      .single();
    member = data ?? null;
  }
  // Same backfill/sync reasoning as the logged-in hint above, for
  // AvatarHintScript.astro's pre-hydration render.
  headers.append("Set-Cookie", member ? avatarHintCookie(member) : clearedAvatarHintCookie());

  return new Response(JSON.stringify({ loggedIn: !!payload, isAdmin: !!payload?.isAdmin, member }), { headers });
};
