import { describe, it, expect } from "vitest";
import { escapeLikePattern } from "./username";

describe("escapeLikePattern", () => {
  it("leaves plain alphanumeric usernames unchanged", () => {
    expect(escapeLikePattern("JohnDoe123")).toBe("JohnDoe123");
  });

  it("escapes underscores so they aren't treated as a single-character wildcard", () => {
    expect(escapeLikePattern("john_doe")).toBe("john\\_doe");
  });

  it("escapes percent signs so they aren't treated as a multi-character wildcard", () => {
    expect(escapeLikePattern("100%cool")).toBe("100\\%cool");
  });

  it("escapes a literal backslash before escaping the characters it introduces", () => {
    expect(escapeLikePattern("a\\_b")).toBe("a\\\\\\_b");
  });
});
