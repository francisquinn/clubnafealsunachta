import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import UpcomingEvent from "./UpcomingEvent";
import type { Event } from "../types/types";

const mockGetGoingCounts = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../test/astroActions")).mockActions(() => ({ getGoingCounts: mockGetGoingCounts })),
);

vi.mock("../layouts/EventCard", () => ({
  default: ({ event, goingCount }: { event: { name: string }; goingCount?: number }) => (
    <div data-testid="card" data-going={String(goingCount ?? "none")}>{event.name}</div>
  ),
}));

vi.mock("../styles/event.css", () => ({}));

function makeEvent(name: string, date: Date): Event {
  return {
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
}

beforeEach(() => {
  mockGetGoingCounts.mockReset();
});

describe("UpcomingEvent going count (#180)", () => {
  it("fetches the live count for the next event on its own (home page)", async () => {
    mockGetGoingCounts.mockResolvedValue({ data: { "next-one": 5 }, error: undefined });
    render(<UpcomingEvent events={[makeEvent("Later one", new Date("2099-06-01")), makeEvent("Next one", new Date("2099-01-01"))]} />);

    expect(mockGetGoingCounts).toHaveBeenCalledWith({ slugs: ["next-one"] });
    await waitFor(() => expect(screen.getByTestId("card")).toHaveAttribute("data-going", "5"));
  });

  it("doesn't fetch when the parent list passes its counts, even before they arrive", () => {
    render(<UpcomingEvent events={[makeEvent("Next one", new Date("2099-01-01"))]} goingCounts={null} />);
    expect(mockGetGoingCounts).not.toHaveBeenCalled();
    expect(screen.getByTestId("card")).toHaveAttribute("data-going", "none");
  });

  it("doesn't fetch when there's no upcoming event", () => {
    render(<UpcomingEvent events={[makeEvent("Old one", new Date("2020-01-01"))]} />);
    expect(mockGetGoingCounts).not.toHaveBeenCalled();
  });
});
