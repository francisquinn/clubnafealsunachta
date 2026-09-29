import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  isPasswordResetTokenCurrent,
  createSessionToken,
  createVerificationToken,
} from "./auth";

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("password reset token", () => {
  it("round-trips the member id and is current for the hash it was issued against", () => {
    const token = createPasswordResetToken("member-1", "salt:hash-a");
    const payload = verifyPasswordResetToken(token);
    expect(payload?.memberId).toBe("member-1");
    expect(isPasswordResetTokenCurrent(payload!.fp, "salt:hash-a")).toBe(true);
  });

  it("stops being current once the password hash changes", () => {
    const payload = verifyPasswordResetToken(createPasswordResetToken("member-1", "salt:hash-a"))!;
    expect(isPasswordResetTokenCurrent(payload.fp, "salt:hash-b")).toBe(false);
  });

  it("does not embed the password hash itself", () => {
    const token = createPasswordResetToken("member-1", "salt:hash-a");
    expect(JSON.stringify(jwt.decode(token))).not.toContain("hash-a");
  });

  it("rejects session and verification tokens", () => {
    expect(verifyPasswordResetToken(createSessionToken("member-1", false, "user"))).toBeNull();
    expect(verifyPasswordResetToken(createVerificationToken("a@b.com"))).toBeNull();
  });

  it("rejects an expired or tampered token", () => {
    const expired = jwt.sign({ memberId: "m", fp: "x", purpose: "reset-password" }, "test-secret", { expiresIn: -10 });
    expect(verifyPasswordResetToken(expired)).toBeNull();
    expect(verifyPasswordResetToken(createPasswordResetToken("m", "h") + "x")).toBeNull();
  });
});
