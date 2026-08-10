import { describe, it, expect } from "vitest";
import { getDisplayName } from "./memberDisplay";

describe("getDisplayName", () => {
  it("returns the username when display_full_name is false", () => {
    expect(getDisplayName({ username: "johndoe", full_name: "John Doe", display_full_name: false })).toBe("johndoe");
  });

  it("returns the full name when display_full_name is true and a full name is set", () => {
    expect(getDisplayName({ username: "johndoe", full_name: "John Doe", display_full_name: true })).toBe("John Doe");
  });

  it("falls back to the username when display_full_name is true but full_name is null", () => {
    expect(getDisplayName({ username: "johndoe", full_name: null, display_full_name: true })).toBe("johndoe");
  });

  it("falls back to the username when display_full_name is true but full_name is empty", () => {
    expect(getDisplayName({ username: "johndoe", full_name: "", display_full_name: true })).toBe("johndoe");
  });
});
