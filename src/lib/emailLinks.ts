import { createHmac, timingSafeEqual } from "crypto";

// #205: signed links in emails the site sends, so a member can act on one
// without logging in. Signed with a key derived from JWT_SECRET rather than
// JWT_SECRET itself, so these tokens and session JWTs never share a key,
// without a second secret to configure. No Astro imports: the
// deploy-succeeded Netlify function imports this too, outside Astro's build.
function linkKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return createHmac("sha256", secret).update("email-links").digest();
}

function sign(message: string): string {
  return createHmac("sha256", linkKey()).update(message).digest("base64url");
}

// Unsubscribe from one chapter's event emails. Never expires: an old email's
// link should still let someone opt out. The member id is a uuid and the
// chapter id an integer, so "." can't appear in either.
export function createUnsubscribeToken(memberId: string, chapterId: number): string {
  return `${memberId}.${chapterId}.${sign(`unsubscribe:${memberId}:${chapterId}`)}`;
}

export function verifyUnsubscribeToken(token: string): { memberId: string; chapterId: number } | null {
  const [memberId, chapterIdText, signature, ...rest] = token.split(".");
  if (!memberId || !chapterIdText || !signature || rest.length > 0) return null;

  const chapterId = Number(chapterIdText);
  if (!Number.isInteger(chapterId) || chapterId <= 0) return null;

  const expected = Buffer.from(sign(`unsubscribe:${memberId}:${chapterId}`));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  return { memberId, chapterId };
}
