import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import JoinEventButton from "./JoinEventButton";
import type { Event } from "../../types/types";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    name: "Test Event",
    date: new Date("2099-01-01"),
    location: null,
    isOnline: true,
    venue: null,
    slug: "test-event",
    social: {},
    meetingUrl: "https://meet.jit.si/test",
    rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    ...overrides,
  };
}

describe("JoinEventButton", () => {
  it("renders a Join online button linking to the meeting url for an upcoming online event", () => {
    render(<JoinEventButton event={makeEvent()} />);
    const link = screen.getByRole("link", { name: /join online/i });
    expect(link).toHaveAttribute("href", "https://meet.jit.si/test");
  });

  it("does not render for in-person events", () => {
    render(<JoinEventButton event={makeEvent({ isOnline: false })} />);
    expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument();
  });

  it("does not render for online events without a meeting url", () => {
    render(<JoinEventButton event={makeEvent({ meetingUrl: null })} />);
    expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument();
  });

  it("does not render once the event date has passed", () => {
    render(<JoinEventButton event={makeEvent({ date: new Date("2020-01-01") })} />);
    expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument();
  });
});