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
