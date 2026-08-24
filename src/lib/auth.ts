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

// A member's admin scope: a super admin (members.is_admin) manages every
// club, so clubIds is meaningless for them and left empty - callers must
// check isSuperAdmin first. A non-super admin's scope is exactly the clubs
// in club_admins; empty means they hold no admin rights over any club (e.g.
// admin status was fully revoked, or - shouldn't happen once #37 ships with
// no self-serve grant path - a member row with no super-admin flag and no
// club_admins rows at all).
export type AdminScope = { memberId: string; isSuperAdmin: boolean; clubIds: number[] };

// Resolves a member's full admin scope: super-admin status plus, if not a
// super admin, the specific clubs they administer via club_admins. The
// token's own isAdmin claim is fine for cosmetic reads (e.g. showing/hiding
// a nav link) but anything that actually GATES access should call this
// instead: it checks live, so revoking rights takes effect on the very next
// request instead of waiting out the token's 30-day expiry. Fails closed - a
// missing Supabase client, a query error, or no matching row (memberId
// always comes from a verified token, but data can still be deleted or
// misconfigured) all resolve to no rights at all.
export async function getAdminScope(memberId: string): Promise<AdminScope> {
  const none = { memberId, isSuperAdmin: false, clubIds: [] };
  if (!supabaseAdmin) return none;

  const { data: member } = await supabaseAdmin.from("members").select("is_admin").eq("id", memberId).single();
  if (!member) return none;
  if (member.is_admin) return { memberId, isSuperAdmin: true, clubIds: [] };

  const { data: clubAdmins } = await supabaseAdmin.from("club_admins").select("club_id").eq("member_id", memberId);
  return { memberId, isSuperAdmin: false, clubIds: (clubAdmins ?? []).map((row) => row.club_id) };
}

// Single admin-gate check shared by middleware and every admin-only action.
// Extracts and verifies the session cookie, then resolves the caller's full
// admin scope (super admin, or the specific clubs they administer) live via
// getAdminScope. Returns the scope when authorized (super admin, or admin of
// at least one club), null otherwise - callers decide how to respond
// (redirect vs. throw ActionError). Actions that need to enforce per-club
// scoping (not just "is this member an admin at all") should read
// isSuperAdmin/clubIds off the returned scope directly.
export async function requireAdmin(request: Request): Promise<AdminScope | null> {
  const token = getSessionToken(request);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) return null;

  const scope = await getAdminScope(payload.memberId);
  if (!scope.isSuperAdmin && scope.clubIds.length === 0) return null;
  return scope;
}

// A non-super admin may only touch clubs they administer - a null club_id
// (genuinely cross-chapter/global, see #36) is out of scope for them too,
// since it isn't any specific club they administer. Shared by every place
// that gates access to one specific club (an existing venue/event's club, a
// submitted event_club_id/new-venue club_id, an event about to be viewed or
// edited) so the rule can't drift between call sites. A plain predicate
// rather than a throw - callers fail however fits their context (an
// ActionError in a server action, a redirect on an Astro page).
export function isClubInScope(admin: AdminScope, club_id: number | null): boolean {
  return admin.isSuperAdmin || (club_id !== null && admin.clubIds.includes(club_id));
}

// Narrows any Supabase query builder to a super admin's full access, or a
// club-scoped admin's own clubs via the given column - the one "scope this
// list to the caller's clubs" shape shared by getClubs/getVenues/the admin
// events list, instead of each repeating the isSuperAdmin branch itself.
// Q is left unconstrained (not `Q extends {in(...): Q}`) and the `.in` call
// is asserted locally instead - constraining Q directly against Supabase's
// real builder type sends TS's inference into an infinite loop (ts(2589)).
export function scopeToAdminClubs<Q>(query: Q, admin: AdminScope, column: string): Q {
  if (admin.isSuperAdmin) return query;
  return (query as unknown as { in(column: string, values: number[]): Q }).in(column, admin.clubIds);
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
