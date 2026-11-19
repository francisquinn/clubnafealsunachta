import { describe, it, expect } from "vitest";
import { chapterTimezone, DEFAULT_CHAPTER_TIMEZONE } from "./chapterDefaults";

describe("chapterTimezone", () => {
  it("returns the chapter's own timezone", () => {
    expect(chapterTimezone("America/New_York")).toBe("America/New_York");
  });

  it("falls back to the default when the chapter has none", () => {
    expect(chapterTimezone(undefined)).toBe(DEFAULT_CHAPTER_TIMEZONE);
    expect(chapterTimezone(null)).toBe(DEFAULT_CHAPTER_TIMEZONE);
    expect(chapterTimezone("")).toBe(DEFAULT_CHAPTER_TIMEZONE);
  });

  it("falls back to the default for a zone Intl doesn't know, instead of throwing", () => {
    expect(chapterTimezone("Europe/Rom")).toBe(DEFAULT_CHAPTER_TIMEZONE);
    expect(chapterTimezone("not a zone")).toBe(DEFAULT_CHAPTER_TIMEZONE);
  });
});
