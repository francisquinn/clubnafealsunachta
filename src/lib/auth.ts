import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "./supabase";

const scryptAsync = promisify(scrypt);

export const SESSION_DURATION_MS = 2_592_000_000;
export const SESSION_DURATION_STR = "30d";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const colonIdx = stored.indexOf(":");
  if (colonIdx === -1) return false;
  const salt = stored.slice(0, colonIdx);
  const storedHash = stored.slice(colonIdx + 1);
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(storedHash, "hex");
  return hash.length === storedBuffer.length && timingSafeEqual(hash, storedBuffer);
}

export function createSessionToken(memberId: string, isAdmin: boolean): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ memberId, isAdmin }, secret, { expiresIn: SESSION_DURATION_STR });
}

const VERIFICATION_TOKEN_DURATION = "3d";

export function createVerificationToken(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ email, purpose: "verify-email" }, secret, { expiresIn: VERIFICATION_TOKEN_DURATION });
}

// The `purpose` claim keeps a session token from being replayed against the verify endpoint.
export function verifyVerificationToken(token: string): { email: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as { email: string; purpose?: string };
    if (payload.purpose !== "verify-email") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function getSessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
}

export function verifySessionToken(token: string): { memberId: string; isAdmin: boolean } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as { memberId?: string; isAdmin: boolean };
    // Pre-rollout session tokens carried `email` instead of `memberId`. JWT_SECRET
    // doesn't rotate on deploy, so a cookie issued before this shipped still
    // verifies but decodes with no memberId - treat that as invalid so the user
    // gets a clean re-login instead of scattered "not authenticated" failures.
    if (!payload.memberId) return null;
    return payload as { memberId: string; isAdmin: boolean };
  } catch {
    return null;
  }
}

// The token's own isAdmin claim is fine for cosmetic reads (e.g. showing/hiding
// a nav link) but anything that actually GATES access should call this instead:
// it checks the members table live, so revoking admin rights takes effect on
// the very next request instead of waiting out the token's 30-day expiry.
// Fails closed - a missing Supabase client, a query error, or no matching row
// (payload.memberId always comes from a verified token, but data can still be
// deleted or misconfigured) all resolve to "not admin".
export async function isMemberAdmin(memberId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("members").select("is_admin").eq("id", memberId).single();
  return !!data?.is_admin;
}

// Single admin-gate check shared by middleware and every admin-only action.
// Extracts and verifies the session cookie, then confirms admin status live
// via isMemberAdmin. Returns the payload when authorized, null otherwise -
// callers decide how to respond (redirect vs. throw ActionError).
export async function requireAdmin(request: Request): Promise<{ memberId: string; isAdmin: boolean } | null> {
  const token = getSessionToken(request);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload || !(await isMemberAdmin(payload.memberId))) return null;
  return payload;
}

// Safari (unlike Chrome) refuses to store cookies marked Secure over plain HTTP,
// even for localhost, so drop the flag outside of production.
export const SECURE_COOKIE = import.meta.env.PROD ? "Secure; " : "";

// Non-HttpOnly hint cookie so the client can render the logged-in state on first paint
// instead of flashing "Login" while /api/me confirms the real (HttpOnly) session cookie.
export function loggedInHintCookie(): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  return `cnf_logged_in=1; ${SECURE_COOKIE}SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearedLoggedInHintCookie(): string {
  return `cnf_logged_in=; ${SECURE_COOKIE}SameSite=Strict; Path=/; Max-Age=0`;
}
