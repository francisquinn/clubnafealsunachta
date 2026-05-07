import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContactForm from "./ContactForm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function fillForm({ name = "Test User", email = "test@example.com", message = "Hello" } = {}) {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: message } });
}

describe("ContactForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders all required form fields", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("shows an error and does not submit for an invalid email", () => {
    render(<ContactForm />);
    fillForm({ email: "notanemail" });
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("disables the submit button while submitting", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ContactForm />);
    fillForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });
  });

  it("shows the success message and hides the form on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Thanks for getting in touch! We'll get back to you soon." }),
    });
    render(<ContactForm />);
    fillForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/thanks for getting in touch/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows the server error message on a non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Please fill in all required fields." }),
    });
    render(<ContactForm />);
    fillForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Please fill in all required fields.")).toBeInTheDocument();
    });
  });

  it("shows a generic error message on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to fetch"));
    render(<ContactForm />);
    fillForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });
});
