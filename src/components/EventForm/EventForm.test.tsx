import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventForm from "./EventForm";

const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockGetClubs = vi.fn();
const mockGetVenues = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
    getClubs: (...args: unknown[]) => mockGetClubs(...args),
    getVenues: (...args: unknown[]) => mockGetVenues(...args),
  },
}));

const sampleInitialData = {
  name: "Test Event",
  date: "2025-06-01T19:00",
  slug: "test-event",
};

async function waitForVenuesToLoad() {
  await waitFor(() => {
    expect(screen.queryByText("Loading venues…")).not.toBeInTheDocument();
  });
}

describe("EventForm (create mode)", () => {
  beforeEach(() => {
    mockCreateEvent.mockReset();
    mockGetClubs.mockResolvedValue({ data: [{ id: 1, name: "Trieste" }] });
    mockGetVenues.mockResolvedValue({ data: [] });
  });

  it("renders all required form fields", () => {
    render(<EventForm mode="create" isSuperAdmin />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("shows the venue field, not a meeting URL field, by default", () => {
    render(<EventForm mode="create" isSuperAdmin />);
    expect(screen.getByRole("checkbox", { name: /this event is online/i })).not.toBeChecked();
    expect(screen.getByLabelText(/^venue/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/meeting url/i)).not.toBeInTheDocument();
  });

  it("shows the meeting URL field, not the venue field, once online is checked", () => {
    render(<EventForm mode="create" isSuperAdmin />);
    fireEvent.click(screen.getByRole("checkbox", { name: /this event is online/i }));
    expect(screen.getByLabelText(/meeting url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^venue/i)).not.toBeInTheDocument();
  });

  it("offers 'No specific chapter' for a super admin's online event", () => {
    render(<EventForm mode="create" isSuperAdmin />);
    fireEvent.click(screen.getByRole("checkbox", { name: /this event is online/i }));
    expect(screen.getByLabelText(/hosting club/i)).not.toBeRequired();
    expect(screen.getByText("No specific chapter")).toBeInTheDocument();
  });

  it("hides 'No specific chapter' and requires a hosting club for a club-scoped admin", () => {
    render(<EventForm mode="create" isSuperAdmin={false} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /this event is online/i }));
    expect(screen.getByLabelText(/hosting club/i)).toBeRequired();
    expect(screen.queryByText("No specific chapter")).not.toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    mockCreateEvent.mockReturnValue(new Promise(() => {}));
    render(<EventForm mode="create" isSuperAdmin />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreateEvent.mockResolvedValue({ error: { message: "Slug already exists" } });
    render(<EventForm mode="create" isSuperAdmin />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Slug already exists")).toBeInTheDocument();
    });
  });

  it("shows success message when event is created", async () => {
    mockCreateEvent.mockResolvedValue({ data: { success: true } });
    render(<EventForm mode="create" isSuperAdmin />);

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
    mockGetClubs.mockResolvedValue({ data: [{ id: 1, name: "Trieste" }] });
    mockGetVenues.mockResolvedValue({ data: [] });
  });

  it("renders 'Save changes' button instead of 'Create'", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^create$/i })).not.toBeInTheDocument();
  });

  it("pre-populates name and date from initialData", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("Test Event");
    expect(screen.getByLabelText(/date & time/i)).toHaveValue("2025-06-01T19:00");
  });

  it("pre-checks the online checkbox from initialData.isOnline", () => {
    render(<EventForm mode="edit" initialData={{ ...sampleInitialData, isOnline: true }} isSuperAdmin />);
    expect(screen.getByRole("checkbox", { name: /this event is online/i })).toBeChecked();
    expect(screen.getByLabelText(/meeting url/i)).toBeInTheDocument();
  });

  it("displays slug as read-only", () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);
    const slugInput = screen.getByRole("textbox", { name: /url slug/i });
    expect(slugInput).toHaveAttribute("readOnly");
    expect(slugInput).toHaveValue("test-event");
  });

  it("disables submit button and shows loading placeholder while venues are loading", () => {
    mockGetVenues.mockReturnValue(new Promise(() => {}));
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);

    expect(screen.getByText("Loading venues…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("enables submit button after venues load", async () => {
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
  });

  it("shows error message when updateEvent returns an error", async () => {
    mockUpdateEvent.mockResolvedValue({ error: { message: "Update failed" } });
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("shows success message after update", async () => {
    mockUpdateEvent.mockResolvedValue({ data: { success: true } });
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);

    await waitForVenuesToLoad();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/event updated successfully/i)).toBeInTheDocument();
    });
  });

  it("pre-selects the venue matching initialData.venueId", async () => {
    const venues = [
      { id: 5, name: "The Philosophy Bar", url: null, club_id: 1 },
      { id: 6, name: "Another Venue", url: null, club_id: 1 },
    ];
    mockGetVenues.mockResolvedValue({ data: venues });
    render(<EventForm mode="edit" initialData={{ ...sampleInitialData, venueId: 5 }} isSuperAdmin />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("combobox", { name: /venue/i })).toHaveValue("5");
  });

  it("does not pre-select a venue when no venueId is provided", async () => {
    const venues = [{ id: 5, name: "The Philosophy Bar", url: null, club_id: 1 }];
    mockGetVenues.mockResolvedValue({ data: venues });
    render(<EventForm mode="edit" initialData={sampleInitialData} isSuperAdmin />);

    await waitForVenuesToLoad();

    expect(screen.getByRole("combobox", { name: /venue/i })).toHaveValue("");
  });
});
