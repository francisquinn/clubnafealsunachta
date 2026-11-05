import type { APIRoute } from "astro";
import { verifyUnsubscribeToken } from "../../lib/emailLinks";
import { unsubscribeFromChapter } from "../../lib/eventAnnouncements";

export const prerender = false;

// #205: one-click unsubscribe (RFC 8058) for the List-Unsubscribe header on
// chapter event emails. Gmail and Apple Mail POST here from their own
// "Unsubscribe" button, so there's no Origin to check: the signed token is
// the authorisation (middleware exempts this path from the CSRF check). Only
// POST, so a link scanner's GET can't unsubscribe anyone.
export const POST: APIRoute = async ({ url }) => {
  const payload = verifyUnsubscribeToken(url.searchParams.get("t") ?? "");
  if (!payload) return new Response("Invalid unsubscribe link", { status: 400 });

  const ok = await unsubscribeFromChapter(payload.memberId, payload.chapterId);
  return ok ? new Response(null, { status: 204 }) : new Response("Unsubscribe failed", { status: 500 });
};
