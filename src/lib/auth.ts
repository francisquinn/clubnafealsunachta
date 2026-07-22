import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";

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

export function createSessionToken(email: string, isAdmin: boolean): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ email, isAdmin }, secret, { expiresIn: SESSION_DURATION_STR });
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

export function verifySessionToken(token: string): { email: string; isAdmin: boolean } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as { email: string; isAdmin: boolean };
    return payload;
  } catch {
    return null;
  }
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
