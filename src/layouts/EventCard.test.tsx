import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EventCard from "./EventCard";
import type { Event } from "../types/types";

vi.mock("../styles/event.css", () => ({}));

function baseEvent(overrides: Partial<Event>): Event {
  return {
    name: "Test Event",
    date: new Date("2099-01-01"),
    location: { id: 1, name: "Trieste", slug: "trieste" },
    club: { id: 1, name: "Trieste", slug: "trieste" },
    isOnline: false,
    venue: { name: "Test Venue", url: "https://maps.google.com" },
    slug: "test-event",
    social: { instagram: "https://instagram.com/test" },
    meetingUrl: null,
    ...overrides,
  };
}

describe("EventCard", () => {
  describe("hosting club label (#52)", () => {
    it("shows the hosting club for an online event organized by a club", () => {
      render(<EventCard event={baseEvent({ isOnline: true, club: { id: 2, name: "Dublin", slug: "dublin" } })} />);
      expect(screen.getByText("Hosted by CNF Dublin")).toBeInTheDocument();
    });

    it("shows a generic label for an online global (club_id null) event", () => {
      render(<EventCard event={baseEvent({ isOnline: true, club: null })} />);
      expect(screen.getByText("Hosted by Club na Fealsúnachta")).toBeInTheDocument();
    });

    it("leaves in-person events to their venue line", () => {
      render(<EventCard event={baseEvent({ isOnline: false })} />);
      expect(screen.getByText("Test Venue")).toBeInTheDocument();
      expect(screen.queryByText(/hosted by/i)).not.toBeInTheDocument();
    });
  });
});