import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EventCard from "./EventCard";
import type { Event } from "../types/types";

const baseEvent: Event = {
  name: "Workshop Event",
  date: new Date("2099-06-01T19:00:00Z"),
  endDate: new Date("2099-06-01T20:30:00Z"),
  location: null,
  isOnline: false,
  venue: { name: "Test Venue", url: null },
  slug: "workshop-event",
  social: {},
  meetingUrl: null,
  meetPoint: null,
  tags: ["workshop", "philosophy"],
  rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
};

describe("EventCard", () => {
  it("renders tag pills when the event has tags", () => {
    render(<EventCard event={baseEvent} />);
    const tags = screen.getAllByText(/workshop|philosophy/);
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toHaveClass("cnf-event__tag");
    }
  });

  it("renders no tag container when the event has no tags", () => {
    render(<EventCard event={{ ...baseEvent, tags: [] }} />);
    expect(document.querySelector(".cnf-event__tags")).toBeNull();
  });
});
