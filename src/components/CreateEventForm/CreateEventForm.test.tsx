import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateEventForm from "./CreateEventForm";

const mockCreateEvent = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  },
}));

describe("CreateEventForm", () => {
  beforeEach(() => {
    mockCreateEvent.mockReset();
  });

  it("renders all required form fields", () => {
    render(<CreateEventForm />);
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create event/i })).toBeInTheDocument();
  });

  it("disables submit button and shows loading state while submitting", async () => {
    mockCreateEvent.mockReturnValue(new Promise(() => {}));
    render(<CreateEventForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
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
      expect(screen.getByRole("button", { name: /create another/i })).toBeInTheDocument();
    });
  });

  it("returns to form when Create another is clicked", async () => {
    mockCreateEvent.mockResolvedValue({ data: { success: true } });
    render(<CreateEventForm />);

    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => screen.getByText(/event created successfully/i));

    fireEvent.click(screen.getByRole("button", { name: /create another/i }));
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
  });
});
