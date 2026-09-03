import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import EventRsvp from "./EventRsvp";
import type { RsvpCounts, RsvpLists, RsvpState } from "../../lib/rsvpTypes";

const mockGetEventRsvps = vi.fn();
const mockSetEventRsvp = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    getEventRsvps: (input: unknown) => mockGetEventRsvps(input),
    setEventRsvp: (input: unknown) => mockSetEventRsvp(input),
  },
}));

const baseCounts: RsvpCounts = { going: 2, maybe: 1, not_going: 0 };

const memberLists: RsvpLists = {
  going: [
    { username: "alice", full_name: null, display_full_name: false },
    { username: "bob", full_name: "Bob Smith", display_full_name: true },
  ],
  maybe: [{ username: "carol", full_name: null, display_full_name: false }],
  not_going: [],
};

const memberState: RsvpState = {
  counts: baseCounts,
  myStatus: "going",
  lists: memberLists,
};

beforeEach(() => {
  mockGetEventRsvps.mockReset();
  mockSetEventRsvp.mockReset();
});

describe("EventRsvp", () => {
  it("shows a loading message before the action resolves, with the controls present but disabled", () => {
    mockGetEventRsvps.mockReturnValue(new Promise(() => {}));
    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    // Deliberate tradeoff: shows "Loading…" on every load until the fetch
    // resolves — a no-JS visitor, a slow/failed fetch, or a crawler that
    // doesn't wait on hydration all see this placeholder rather than a
    // real count.
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("2 going · 1 maybe")).not.toBeInTheDocument();
    // The RSVP buttons render immediately (no pop-in once isMember
    // resolves) but stay disabled until then. "See all" is treated as
    // unknown/empty until isMember resolves, so it's absent, not disabled.
    expect(screen.getByRole("button", { name: "Going" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "See all" })).not.toBeInTheDocument();
  });

  it("shows counts and the real RSVP buttons for an anonymous visitor, with no names", async () => {
    mockGetEventRsvps.mockResolvedValue({
      data: { counts: baseCounts, myStatus: null, lists: null },
    });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByText("2 going · 1 maybe")).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Going" })).not.toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Going", level: 3 })).not.toBeInTheDocument();
  });

  it("hides the 'See all' link when no one has RSVPed yet", async () => {
    const zeroCounts: RsvpCounts = { going: 0, maybe: 0, not_going: 0 };
    mockGetEventRsvps.mockResolvedValue({
      data: { counts: zeroCounts, myStatus: null, lists: null },
    });

    render(<EventRsvp slug="philosophy-101" initialCounts={zeroCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByText("No responses yet.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "See all" })).not.toBeInTheDocument();
  });

  it("opens the header's login modal instead of setting a status, when an anonymous visitor clicks an RSVP button", async () => {
    mockGetEventRsvps.mockResolvedValue({
      data: { counts: baseCounts, myStatus: null, lists: null },
    });

    // Mirrors the static trigger button LoginButton.tsx listens on
    // (Header.astro) — an anonymous click on a real RSVP button reuses it
    // rather than calling setEventRsvp or navigating to a login page.
    const headerTrigger = document.createElement("button");
    headerTrigger.id = "cnf-login-trigger";
    const onHeaderTriggerClick = vi.fn();
    headerTrigger.addEventListener("click", onHeaderTriggerClick);
    document.body.appendChild(headerTrigger);

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    // The button is present from the first render but starts disabled until
    // isMember resolves — wait for that before clicking it.
    const goingButton = screen.getByRole("button", { name: "Going" });
    await waitFor(() => expect(goingButton).not.toBeDisabled());
    fireEvent.click(goingButton);

    expect(onHeaderTriggerClick).toHaveBeenCalledOnce();
    expect(mockSetEventRsvp).not.toHaveBeenCalled();

    document.body.removeChild(headerTrigger);
  });

  it("shows the RSVP controls and highlights the member's own status", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: true })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("opens the attendee list modal, with named breakdowns, when a member clicks 'See all'", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "See all" }));

    const goingHeading = screen.getByRole("heading", { name: "Going", level: 3 });
    expect(goingHeading).toBeVisible();
    expect(within(goingHeading.parentElement!).getByText("2")).toBeVisible();

    const maybeHeading = screen.getByRole("heading", { name: "Maybe", level: 3 });
    expect(maybeHeading).toBeVisible();
    expect(within(maybeHeading.parentElement!).getByText("1")).toBeVisible();

    expect(screen.getByText("alice")).toBeVisible();
    expect(screen.getByText("Bob Smith")).toBeVisible();
  });

  it("opens the login modal instead of the attendee list, when an anonymous visitor clicks 'See all'", async () => {
    mockGetEventRsvps.mockResolvedValue({
      data: { counts: baseCounts, myStatus: null, lists: null },
    });

    const headerTrigger = document.createElement("button");
    headerTrigger.id = "cnf-login-trigger";
    const onHeaderTriggerClick = vi.fn();
    headerTrigger.addEventListener("click", onHeaderTriggerClick);
    document.body.appendChild(headerTrigger);

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    const seeAllButton = await screen.findByRole("button", { name: "See all" });
    fireEvent.click(seeAllButton);

    expect(onHeaderTriggerClick).toHaveBeenCalledOnce();

    document.body.removeChild(headerTrigger);
  });

  it("sends a new status when a member changes their RSVP and refreshes from the response", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });
    mockSetEventRsvp.mockResolvedValue({
      data: {
        counts: { going: 1, maybe: 2, not_going: 0 },
        myStatus: "maybe",
        lists: {
          going: [memberLists.going[1]],
          maybe: [memberLists.going[0], memberLists.maybe[0]],
          not_going: [],
        },
      },
    });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: true })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Maybe" }));

    expect(mockSetEventRsvp).toHaveBeenCalledWith({ slug: "philosophy-101", status: "maybe" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Maybe", pressed: true })).toBeInTheDocument();
    });
    expect(screen.getByText("1 going · 2 maybe")).toBeInTheDocument();
  });

  it("clears the member's RSVP when they click their own active status again", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });
    mockSetEventRsvp.mockResolvedValue({
      data: {
        counts: { going: 1, maybe: 1, not_going: 0 },
        myStatus: null,
        lists: {
          going: [memberLists.going[1]],
          maybe: memberLists.maybe,
          not_going: [],
        },
      },
    });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: true })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Going" }));

    expect(mockSetEventRsvp).toHaveBeenCalledWith({ slug: "philosophy-101", status: null });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: false })).toBeInTheDocument();
    });
    expect(screen.getByText("1 going · 1 maybe")).toBeInTheDocument();
  });

  it("shows the action error when setting an RSVP fails", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });
    mockSetEventRsvp.mockResolvedValue({ error: { message: "Not authenticated" } });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Going", pressed: true })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Not going" }));

    await waitFor(() => {
      expect(screen.getByText("Not authenticated")).toBeInTheDocument();
    });
  });

  it("keeps the RSVP controls off and switches to past-tense wording once the event has passed", async () => {
    mockGetEventRsvps.mockResolvedValue({ data: memberState });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2000-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByText("2 went · 1 maybe")).toBeInTheDocument();
    });
    expect(screen.getByText("Went")).toBeInTheDocument();
    expect(screen.queryByText("Going")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Going" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("falls back to the static counts if the action errors", async () => {
    mockGetEventRsvps.mockResolvedValue({ error: { message: "Event not found" } });

    render(<EventRsvp slug="philosophy-101" initialCounts={baseCounts} date="2099-01-01T18:00:00.000Z" />);

    await waitFor(() => {
      expect(screen.getByText("2 going · 1 maybe")).toBeInTheDocument();
    });
  });
});