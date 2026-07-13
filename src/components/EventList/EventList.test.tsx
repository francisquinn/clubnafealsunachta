import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import EventList from "./EventList";
import type { EventCollection } from "../../types/types";

vi.mock("../Selector/Selector", () => ({
  default: ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  ),
}));

vi.mock("../UpcomingEvent", () => ({
  default: ({ events }: { events: { name: string }[] }) => (
    <div data-testid="upcoming-event">{events?.[0]?.name}</div>
  ),
}));

vi.mock("../../layouts/EventCard", () => ({
  default: ({ event }: { event: { name: string } }) => <div data-testid="past-event">{event.name}</div>,
}));

vi.mock("../../styles/event.css", () => ({}));

function makeEvent(name: string, date: Date, locationName = "Trieste"): EventCollection {
  return {
    id: name,
    data: {
      name,
      date,
      location: { id: 1, name: locationName },
      venue: { name: "Test Venue", url: "https://maps.google.com" },
      slug: name.toLowerCase().replace(/ /g, "-"),
      social: { instagram: "https://instagram.com/test" },
      meetingUrl: null,
    },
  } as unknown as EventCollection;
}

const futureDate1 = new Date("2099-01-01");
const futureDate2 = new Date("2099-06-01");
const pastDate1 = new Date("2020-01-01");
const pastDate2 = new Date("2021-06-01");
const pastDate3 = new Date("2019-03-01");

describe("EventList", () => {
  describe("upcoming events", () => {
    it("renders all upcoming events", () => {
      const events = [
        makeEvent("Event A", futureDate1),
        makeEvent("Event B", futureDate2),
      ];
      render(<EventList events={events} />);
      expect(screen.getAllByTestId("upcoming-event")).toHaveLength(2);
      expect(screen.getByText("Event A")).toBeInTheDocument();
      expect(screen.getByText("Event B")).toBeInTheDocument();
    });

    it("shows empty state when no upcoming events", () => {
      render(<EventList events={[makeEvent("Old Event", pastDate1)]} />);
      expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument();
    });
  });

  describe("past events", () => {
    it("renders past events when Past tab is clicked", () => {
      const events = [makeEvent("Past Event", pastDate1)];
      render(<EventList events={events} />);
      fireEvent.click(screen.getByText("Past"));
      expect(screen.getByTestId("past-event")).toBeInTheDocument();
    });

    it("sorts past events newest first", () => {
      const events = [
        makeEvent("Oldest", pastDate3),
        makeEvent("Middle", pastDate1),
        makeEvent("Newest", pastDate2),
      ];
      render(<EventList events={events} />);
      fireEvent.click(screen.getByText("Past"));
      const cards = screen.getAllByTestId("past-event");
      expect(cards[0]).toHaveTextContent("Newest");
      expect(cards[1]).toHaveTextContent("Middle");
      expect(cards[2]).toHaveTextContent("Oldest");
    });

    it("shows empty state when no past events in selected location", () => {
      const events = [makeEvent("Future Event", futureDate1, "Trieste")];
      render(<EventList events={events} />);
      fireEvent.click(screen.getByText("Past"));
      expect(screen.getByText(/no past events in Trieste/i)).toBeInTheDocument();
    });
  });

  describe("location filtering", () => {
    it("filters events by selected location", () => {
      const events = [
        makeEvent("Trieste Event", futureDate1, "Trieste"),
        makeEvent("Dublin Event", futureDate2, "Dublin"),
      ];
      render(<EventList events={events} />);
      expect(screen.getAllByTestId("upcoming-event")).toHaveLength(1);
      expect(screen.getByText("Trieste Event")).toBeInTheDocument();
    });
  });
});
