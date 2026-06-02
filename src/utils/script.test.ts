import { describe, it, expect } from "vitest";
import { isValidEmail, isEventExpired, formatBlogDate } from "./script.ts";
import type { Event } from "../types/types.ts";

describe("isValidEmail", () => {
  it("returns true for valid emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.org")).toBe(true);
    expect(isValidEmail("user+tag@example.co.uk")).toBe(true);
  });

  it("returns false for invalid emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
    expect(isValidEmail("no@domain")).toBe(false);
    expect(isValidEmail("no @domain.com")).toBe(false);
  });
});

describe("isEventExpired", () => {
  it("returns true for null events", () => {
    expect(isEventExpired(null)).toBe(true);
  });

  it("returns true for past events", () => {
    const pastEvent: Event = {
      slug: "test",
      name: "Test",
      date: new Date("2020-01-01"),
      location: { id: 1, name: "Trieste" },
      venue: { name: "Test Venue", url: "https://test.com" },
      social: { instagram: "https://instagram.com" },
      meetingUrl: null,
    };
    expect(isEventExpired(pastEvent)).toBe(true);
  });

  it("returns false for future events", () => {
    const futureEvent: Event = {
      slug: "test",
      name: "Test",
      date: new Date("2099-12-31"),
      location: { id: 1, name: "Trieste" },
      venue: { name: "Test Venue", url: "https://test.com" },
      social: { instagram: "https://instagram.com" },
      meetingUrl: null,
    };
    expect(isEventExpired(futureEvent)).toBe(false);
  });
});

describe("formatBlogDate", () => {
  it("formats date correctly", () => {
    const result = formatBlogDate(new Date("2025-09-04"));
    expect(result).toBe("Sep 4, 2025");
  });
});
