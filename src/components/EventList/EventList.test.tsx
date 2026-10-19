import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import EventList from "./EventList";
import type { EventCollection, Event } from "../../types/types";

vi.mock("../Selector/Selector", () => ({
  default: ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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

// `data` is typed as the real `Event` shape (not the loosely-cast wrapper
// below) so a future field added there — like the #39 `location.slug` — is
// enforced here too, instead of being silently absent from these fixtures.
// Every fixture's endDate trails its date by 1.5h (the club's usual event
// length, #100) — irrelevant to what these tests check, just keeps
// isEventExpired's past/future outcome matching the intended date.
function endDateFor(date: Date): Date {
  return new Date(date.getTime() + 90 * 60 * 1000);
}

function makeEvent(name: string, date: Date, locationName = "Trieste"): EventCollection {
  const data: Event = {
    name,
    date,
    endDate: endDateFor(date),
    location: { id: 1, name: locationName, slug: locationName.toLowerCase() },
    isOnline: false,
    venue: { name: "Test Venue", url: "https://maps.google.com" },
    slug: name.toLowerCase().replace(/ /g, "-"),
    social: { instagram: "https://instagram.com/test" },
    meetingUrl: null,
    meetPoint: null,
    rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    tags: [],
  };
  return { id: name, data } as unknown as EventCollection;
}

function makeOnlineEvent(name: string, date: Date): EventCollection {
  const data: Event = {
    name,
    date,
    endDate: endDateFor(date),
    location: null,
    isOnline: true,
    venue: null,
    slug: name.toLowerCase().replace(/ /g, "-"),
    social: { instagram: "https://instagram.com/test" },
    meetingUrl: "https://meet.jit.si/test",
    meetPoint: null,
    rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    tags: [],
  };
  return { id: name, data } as unknown as EventCollection;
}

const futureDate1 = new Date("2099-01-01");
const futureDate2 = new Date("2099-06-01");
const pastDate1 = new Date("2020-01-01");
const pastDate2 = new Date("2021-06-01");
const pastDate3 = new Date("2019-03-01");

const CLUBS = [
  { name: "Trieste", slug: "trieste" },
  { name: "Online", slug: "online" },
];

function renderList(events: EventCollection[], clubSlug = "trieste") {
  return render(<EventList events={events} clubSlug={clubSlug} clubs={CLUBS} />);
}

describe("EventList", () => {
  describe("upcoming events", () => {
    it("renders all upcoming events", () => {
      const events = [
        makeEvent("Event A", futureDate1),
        makeEvent("Event B", futureDate2),
      ];
      renderList(events);
      expect(screen.getAllByTestId("upcoming-event")).toHaveLength(2);
      expect(screen.getByText("Event A")).toBeInTheDocument();
      expect(screen.getByText("Event B")).toBeInTheDocument();
    });

    it("shows empty state when no upcoming events", () => {
      renderList([makeEvent("Old Event", pastDate1)]);
      expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument();
    });
  });

  describe("past events", () => {
    it("renders past events when Past tab is clicked", () => {
      const events = [makeEvent("Past Event", pastDate1)];
      renderList(events);
      fireEvent.click(screen.getByText("Past"));
      expect(screen.getByTestId("past-event")).toBeInTheDocument();
    });

    it("sorts past events newest first", () => {
      const events = [
        makeEvent("Oldest", pastDate3),
        makeEvent("Middle", pastDate1),
        makeEvent("Newest", pastDate2),
      ];
      renderList(events);
      fireEvent.click(screen.getByText("Past"));
      const cards = screen.getAllByTestId("past-event");
      expect(cards[0]).toHaveTextContent("Newest");
      expect(cards[1]).toHaveTextContent("Middle");
      expect(cards[2]).toHaveTextContent("Oldest");
    });

    it("shows empty state when no past events in selected location", () => {
      const events = [makeEvent("Future Event", futureDate1, "Trieste")];
      renderList(events);
      fireEvent.click(screen.getByText("Past"));
      expect(screen.getByText(/no past events in Trieste/i)).toBeInTheDocument();
    });
  });

  describe("chapter picker (#177)", () => {
    it("lists every chapter and selects the current one", () => {
      renderList([makeEvent("Trieste Event", futureDate1)]);
      const picker = screen.getByRole("combobox") as HTMLSelectElement;
      expect([...picker.options].map((o) => [o.value, o.text])).toEqual([["trieste", "Trieste"], ["online", "Online"]]);
      expect(picker.value).toBe("trieste");
    });

    it("shows every event the page was given, online ones included", () => {
      renderList([makeOnlineEvent("Online One", futureDate1), makeOnlineEvent("Online Two", futureDate2)], "online");
      expect(screen.getAllByTestId("upcoming-event")).toHaveLength(2);
      expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("online");
    });

    it("goes to the chosen chapter's events page", () => {
      const assign = vi.fn();
      vi.stubGlobal("location", { ...window.location, assign });
      renderList([makeEvent("Trieste Event", futureDate1)]);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "online" } });
      expect(assign).toHaveBeenCalledWith("/online/events/");
      vi.unstubAllGlobals();
    });

    // Chapter names aren't unique in the DB, so the picker goes by slug.
    it("tells apart two chapters with the same name", () => {
      const assign = vi.fn();
      vi.stubGlobal("location", { ...window.location, assign });
      render(
        <EventList
          events={[]}
          clubSlug="trieste"
          clubs={[{ name: "Trieste", slug: "trieste" }, { name: "Trieste", slug: "trieste-2" }]}
        />
      );
      const picker = screen.getByRole("combobox") as HTMLSelectElement;
      expect(picker.value).toBe("trieste");
      fireEvent.change(picker, { target: { value: "trieste-2" } });
      expect(assign).toHaveBeenCalledWith("/trieste-2/events/");
      vi.unstubAllGlobals();
    });
  });
});
