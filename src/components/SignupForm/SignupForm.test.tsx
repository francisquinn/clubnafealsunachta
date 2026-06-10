import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignupForm from "./SignupForm";

const mockCreateUser = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createUser: (...args: unknown[]) => mockCreateUser(...args),
  },
}));

describe("SignupForm", () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
  });

  it("renders all form fields and submit button", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admin/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("admin checkbox is unchecked by default", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/admin/i)).not.toBeChecked();
  });

  it("disables submit button while submitting", async () => {
    mockCreateUser.mockReturnValue(new Promise(() => {}));
    render(<SignupForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreateUser.mockResolvedValue({ error: { message: "An account with that email already exists" } });
    render(<SignupForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("An account with that email already exists")).toBeInTheDocument();
    });
  });

  it("replaces form with success message on success", async () => {
    mockCreateUser.mockResolvedValue({ data: { success: true } });
    render(<SignupForm />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
  });
});
