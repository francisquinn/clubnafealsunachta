import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateEventForm from "./CreateEventForm";

const mockCreateEvent = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
    getVenues: () => Promise.resolve({ data: [] }),
  },
}));

describe("CreateEventForm", () => {
  beforeEach(() => {
    mockCreateEvent.mockReset();
  });

  it("renders all required form fields", () => {
    render(<CreateEventForm />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("disables submit button and shows loading state while submitting", async () => {
    mockCreateEvent.mockReturnValue(new Promise(() => {}));
    render(<CreateEventForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreateEvent.mockResolvedValue({ error: { message: "Slug already exists" } });
    render(<CreateEventForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Slug already exists")).toBeInTheDocument();
    });
  });

  it("shows success state when event is created", async () => {
    mockCreateEvent.mockResolvedValue({ data: { success: true } });
    render(<CreateEventForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/event created successfully/i)).toBeInTheDocument();
    });
  });
});
