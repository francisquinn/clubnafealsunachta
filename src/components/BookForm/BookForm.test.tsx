import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BookForm from "./BookForm";

const mockCreateBook = vi.fn();
const mockUpdateBook = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createBook: (...args: unknown[]) => mockCreateBook(...args),
    updateBook: (...args: unknown[]) => mockUpdateBook(...args),
  },
}));

const sampleInitialData = {
  title: "Meditations",
  author: "Marcus Aurelius",
  slug: "meditations",
  blurb: "A starting point for Stoic philosophy.",
  coverImageUrl: "https://example.com/meditations.jpg",
};

describe("BookForm (create mode)", () => {
  beforeEach(() => {
    mockCreateBook.mockReset();
  });

  it("renders all required form fields", () => {
    render(<BookForm mode="create" />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/blurb/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cover image url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    mockCreateBook.mockReturnValue(new Promise(() => {}));
    render(<BookForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreateBook.mockResolvedValue({ error: { message: "A book with this slug already exists" } });
    render(<BookForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("A book with this slug already exists")).toBeInTheDocument();
    });
  });

  it("shows success message when book is created", async () => {
    mockCreateBook.mockResolvedValue({ data: { success: true } });
    render(<BookForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/book created successfully/i)).toBeInTheDocument();
    });
  });
});

describe("BookForm (edit mode)", () => {
  beforeEach(() => {
    mockUpdateBook.mockReset();
  });

  it("renders 'Save changes' button instead of 'Create'", () => {
    render(<BookForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^create$/i })).not.toBeInTheDocument();
  });

  it("pre-populates all fields from initialData", () => {
    render(<BookForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("Meditations");
    expect(screen.getByLabelText(/author/i)).toHaveValue("Marcus Aurelius");
    expect(screen.getByLabelText(/blurb/i)).toHaveValue("A starting point for Stoic philosophy.");
    expect(screen.getByLabelText(/cover image url/i)).toHaveValue("https://example.com/meditations.jpg");
  });

  it("displays slug as read-only", () => {
    render(<BookForm mode="edit" initialData={sampleInitialData} />);
    const slugInput = screen.getByRole("textbox", { name: /url slug/i });
    expect(slugInput).toHaveAttribute("readOnly");
    expect(slugInput).toHaveValue("meditations");
  });

  it("shows error message when updateBook returns an error", async () => {
    mockUpdateBook.mockResolvedValue({ error: { message: "Update failed" } });
    render(<BookForm mode="edit" initialData={sampleInitialData} />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("shows success message after update", async () => {
    mockUpdateBook.mockResolvedValue({ data: { success: true } });
    render(<BookForm mode="edit" initialData={sampleInitialData} />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/book updated successfully/i)).toBeInTheDocument();
    });
  });
});