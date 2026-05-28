import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventForm from "./EventForm";

const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockGetVenues = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
    getVenues: (...args: unknown[]) => mockGetVenues(...args),
  },
}));

const sampleInitialData = {
  name: "Test Event",
  date: "2025-06-01T19:00",
  city: "Trieste",
  slug: "test-event",
};

/** Waits for the async venue fetch to complete so the real select is rendered. */
async function waitForVenuesToLoad() {
  await waitFor(() => {
    expect(screen.queryByText("Loading venues…")).not.toBeInTheDocument();
  });
}

describe("EventForm (create mode)", () => {
  beforeEach(() => {
    mockCreateEvent.mockReset();
    mockGetVenues.mockResolvedValue({ data: [] });
  });

  it("renders all required form fields", () => {
    render(<EventForm mode="create" />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    mockCreateEvent.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EventForm mode="create" />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreateEvent.mockResolvedValue({ error: { message: "Slug already exists" } });
    render(<EventForm mode="create" />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Slug already exists")).toBeInTheDocument();
    });
  });

  it("shows success state when event is created", async () => {
    mockCreateEvent.mockResolvedValue({ data: { success: true } });
    render(<EventForm mode="create" />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/event created successfully/i)).toBeInTheDocument();
    });
  });
});

describe("EventForm (edit mode)", () => {
  beforeEach(() => {
    mockUpdateEvent.mockReset();
    mockGetVenues.mockResolvedValue({ data: [] });
  });

  it("renders 'Save changes' button instead of 'Create'", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^create$/i })).not.toBeInTheDocument();
  });

  it("pre-populates name and date from initialData", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("Test Event");
    expect(screen.getByLabelText(/date & time/i)).toHaveValue("2025-06-01T19:00");
  });

  it("displays slug as read-only", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} />);
    const slugInput = screen.getByRole("textbox", { name: /url slug/i });
    expect(slugInput).toHaveAttribute("readOnly");
    expect(slugInput).toHaveValue("test-event");
  });

  it("disables submit button and shows loading placeholder while venues are loading", () => {
    mockGetVenues.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EventForm mode="edit" initialData={sampleInitialData} />);

    expect(screen.getByText("Loading venues…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("enables submit button after venues load", async () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
  });

  it("shows error message when updateEvent returns an error", async () => {
    mockUpdateEvent.mockResolvedValue({ error: { message: "Update failed" } });
    render(<EventForm mode="edit" initialData={sampleInitialData} />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("shows success state with back link after update", async () => {
    mockUpdateEvent.mockResolvedValue({ data: { success: true } });
    render(<EventForm mode="edit" initialData={sampleInitialData} />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/event updated successfully/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /back to events/i })).toHaveAttribute(
        "href",
        "/admin/events"
      );
    });
  });

  it("pre-selects the venue matching initialData.venueId", async () => {
    const venues = [
      { id: 5, name: "The Philosophy Bar", url: null, city: "Trieste" },
      { id: 6, name: "Another Venue", url: null, city: "Trieste" },
    ];
    mockGetVenues.mockResolvedValue({ data: venues });
    render(<EventForm mode="edit" initialData={{ ...sampleInitialData, venueId: 5 }} />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("combobox", { name: /venue/i })).toHaveValue("5");
  });

  it("does not pre-select a venue when no venueId is provided", async () => {
    const venues = [{ id: 5, name: "The Philosophy Bar", url: null, city: "Trieste" }];
    mockGetVenues.mockResolvedValue({ data: venues });
    render(<EventForm mode="edit" initialData={sampleInitialData} />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("combobox", { name: /venue/i })).toHaveValue("");
  });
});
