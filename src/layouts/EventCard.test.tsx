import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EventCard from "./EventCard";
import type { Event } from "../types/types";

vi.mock("../components/LiveBadge/LiveBadge", () => ({ default: () => <span>Live</span> }));

function makeEvent(overrides: Partial<Event> = {}): Event {
  const date = new Date("2099-01-01T18:00:00Z");
  return {
    name: "Free will",
    date,
    endDate: new Date(date.getTime() + 90 * 60 * 1000),
    location: { id: 1, name: "Trieste", slug: "trieste" },
    isOnline: false,
    venue: { name: "Caffè San Marco", url: "https://maps.google.com" },
    slug: "free-will",
    social: { instagram: "https://instagram.com/test" },
    meetingUrl: null,
    meetPoint: null,
    rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    tags: [],
    ...overrides,
  };
}

describe("EventCard", () => {
  it("shows the chapter and the going count", () => {
    render(<EventCard event={makeEvent({ rsvpCounts: { going: 12, maybe: 3, not_going: 1 } })} />);
    expect(screen.getByText("Trieste · 12 going")).toBeInTheDocument();
  });

  it("shows the count even when nobody is going yet", () => {
    render(<EventCard event={makeEvent()} />);
    expect(screen.getByText("Trieste · 0 going")).toBeInTheDocument();
  });

  it("prefers the live count over the built-in one", () => {
    render(<EventCard event={makeEvent({ rsvpCounts: { going: 2, maybe: 0, not_going: 0 } })} goingCount={9} />);
    expect(screen.getByText("Trieste · 9 going")).toBeInTheDocument();
  });

  it("says went for a past event", () => {
    const date = new Date("2020-01-01T18:00:00Z");
    render(<EventCard event={makeEvent({ date, endDate: new Date(date.getTime() + 90 * 60 * 1000), rsvpCounts: { going: 8, maybe: 0, not_going: 0 } })} />);
    expect(screen.getByText("Trieste · 8 went")).toBeInTheDocument();
  });

  it("links only the title, with no venue, meeting or social links", () => {
    render(<EventCard event={makeEvent({ isOnline: true, meetingUrl: "https://meet.jit.si/test" })} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/trieste/events/free-will");
  });
});
