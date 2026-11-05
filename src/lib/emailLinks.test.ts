// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./emailLinks";

const MEMBER = "6f1c2c1e-1b7a-4a0e-9a57-3d1f1f6b2a10";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("unsubscribe tokens", () => {
  it("round-trips the member and chapter", () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken(MEMBER, 3))).toEqual({ memberId: MEMBER, chapterId: 3 });
  });

  it("rejects a token pointed at another chapter or member", () => {
    const [, , signature] = createUnsubscribeToken(MEMBER, 3).split(".");
    expect(verifyUnsubscribeToken(`${MEMBER}.4.${signature}`)).toBeNull();
    expect(verifyUnsubscribeToken(`00000000-0000-0000-0000-000000000000.3.${signature}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "abc", `${MEMBER}.3`, `${MEMBER}.0.sig`, `${MEMBER}.x.sig`, `${createUnsubscribeToken(MEMBER, 3)}.extra`]) {
      expect(verifyUnsubscribeToken(token)).toBeNull();
    }
  });

  it("stops verifying when the secret changes", () => {
    const token = createUnsubscribeToken(MEMBER, 3);
    process.env.JWT_SECRET = "rotated";
    expect(verifyUnsubscribeToken(token)).toBeNull();
    process.env.JWT_SECRET = "test-secret";
  });
});
