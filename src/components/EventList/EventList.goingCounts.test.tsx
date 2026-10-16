import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import EventList from "./EventList";
import type { Event, EventCollection } from "../../types/types";

// #180: kept apart from EventList.test.tsx, which mocks UpcomingEvent. Here
// the real UpcomingEvent renders inside the list, so this catches any card
// starting its own getGoingCounts call instead of using the list's one.
const mockGetGoingCounts = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ getGoingCounts: mockGetGoingCounts })),
);

vi.mock("../Selector/Selector", () => ({ default: () => null }));

vi.mock("../../layouts/EventCard", () => ({
  default: ({ event, goingCount }: { event: { name: string }; goingCount?: number }) => (
    <div data-testid="card" data-going={String(goingCount ?? "none")}>{event.name}</div>
  ),
}));

vi.mock("../../styles/event.css", () => ({}));

function makeEvent(name: string, date: Date): EventCollection {
  const data: Event = {
    name,
    date,
    endDate: new Date(date.getTime() + 90 * 60 * 1000),
    location: { id: 1, name: "Trieste", slug: "trieste" },
    isOnline: false,
    venue: null,
    slug: name.toLowerCase().replace(/ /g, "-"),
    social: {},
    meetingUrl: null,
    meetPoint: null,
    rsvpCounts: { going: 0, maybe: 0, not_going: 0 },
    tags: [],
  };
  return { id: name, data } as unknown as EventCollection;
}

describe("EventList going counts with the real UpcomingEvent", () => {
  it("makes one call for the whole page and gives each upcoming card its count", async () => {
    mockGetGoingCounts.mockResolvedValue({ data: { "event-a": 4, "event-b": 7 }, error: undefined });
    render(
      <EventList
        events={[makeEvent("Event A", new Date("2099-01-01")), makeEvent("Event B", new Date("2099-06-01"))]}
        clubSlug="trieste"
        clubs={[{ name: "Trieste", slug: "trieste" }]}
      />
    );

    await waitFor(() => expect(screen.getByText("Event B")).toHaveAttribute("data-going", "7"));
    expect(screen.getByText("Event A")).toHaveAttribute("data-going", "4");
    expect(mockGetGoingCounts).toHaveBeenCalledTimes(1);
  });
});
