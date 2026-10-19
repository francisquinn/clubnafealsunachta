import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EventCard from "./EventCard";
import type { Event } from "../types/types";
import { formatEventDate } from "../utils/script";

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
  it("shows the start time only, with no end time", () => {
    const event = makeEvent();
    const { container } = render(<EventCard event={event} />);
    expect(container.querySelector(".cnf-event__date")).toHaveTextContent(new RegExp(`^${formatEventDate(event.date)}$`));
  });

  it("shows the chapter under the date, with no RSVP count", () => {
    render(<EventCard event={makeEvent({ rsvpCounts: { going: 12, maybe: 3, not_going: 1 } })} />);
    expect(screen.getByText("Trieste")).toBeInTheDocument();
    expect(screen.queryByText(/going|went/)).not.toBeInTheDocument();
  });

  it("links only the title, with no venue, meeting or social links", () => {
    render(<EventCard event={makeEvent({ isOnline: true, meetingUrl: "https://meet.jit.si/test" })} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/trieste/events/free-will");
  });
});
