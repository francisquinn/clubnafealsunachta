import { describe, it, expect } from "vitest";
import { isValidEmail, isEventExpired, formatBlogDate, formatEventDate } from "./script.ts";
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
      location: { id: 1, name: "Trieste", slug: "trieste" },
      isOnline: false,
      venue: { name: "Test Venue", url: "https://test.com" },
      social: { instagram: "https://instagram.com" },
      meetingUrl: null,
      rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    };
    expect(isEventExpired(pastEvent)).toBe(true);
  });

  it("returns false for future events", () => {
    const futureEvent: Event = {
      slug: "test",
      name: "Test",
      date: new Date("2099-12-31"),
      location: { id: 1, name: "Trieste", slug: "trieste" },
      isOnline: false,
      venue: { name: "Test Venue", url: "https://test.com" },
      social: { instagram: "https://instagram.com" },
      meetingUrl: null,
      rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
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

describe("formatEventDate", () => {
  it("renders a UTC instant as Rome's CEST (summer) local time, not raw UTC digits", () => {
    // 16:30 UTC on Sep 4 2026 is 18:30 in Rome (CEST, UTC+2) — this is the
    // exact bug case: raw UTC digits would wrongly show "16:30".
    const result = formatEventDate(new Date("2026-09-04T16:30:00.000Z"));
    expect(result).toBe("Fri Sep 4 @ 18:30");
  });

  it("renders a UTC instant as Rome's CET (winter) local time", () => {
    // 17:00 UTC on Feb 5 2026 is 18:00 in Rome (CET, UTC+1).
    const result = formatEventDate(new Date("2026-02-05T17:00:00.000Z"));
    expect(result).toBe("Thu Feb 5 @ 18:00");
  });
});
