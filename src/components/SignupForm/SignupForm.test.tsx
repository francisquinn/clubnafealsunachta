import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignupForm from "./SignupForm";

const mockSignup = vi.fn();
const mockCreateMember = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    signup: (...args: unknown[]) => mockSignup(...args),
    createMember: (...args: unknown[]) => mockCreateMember(...args),
  },
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "validuser" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Password1" } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Password1" } });
}

describe("SignupForm", () => {
  beforeEach(() => {
    mockSignup.mockReset();
    mockCreateMember.mockReset();
  });

  it("renders all form fields and submit button", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^join$/i })).toBeInTheDocument();
  });

  it("blocks submission and shows a field error when passwords don't match", async () => {
    render(<SignupForm />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Different1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("disables submit button while submitting", async () => {
    mockSignup.mockReturnValue(new Promise(() => {}));
    render(<SignupForm />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^join$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockSignup.mockResolvedValue({ error: { message: "An account with that email already exists" } });
    render(<SignupForm />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("An account with that email already exists")).toBeInTheDocument();
    });
  });

  it("shows error message when username is taken", async () => {
    mockSignup.mockResolvedValue({ error: { message: "That username is already taken" } });
    render(<SignupForm />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("That username is already taken")).toBeInTheDocument();
    });
  });

  it("replaces form with success message on success", async () => {
    mockSignup.mockResolvedValue({ data: { success: true } });
    render(<SignupForm />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
  });

  it("blocks submission and shows field errors when username is invalid", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Password1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Password1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid username")).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("blocks submission and shows field errors when email is invalid", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "validuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Password1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Password1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("blocks submission and shows field errors when password is weak", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "validuser" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "weak1234" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "weak1234" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });
});

describe("SignupForm (isAdmin)", () => {
  beforeEach(() => {
    mockSignup.mockReset();
    mockCreateMember.mockReset();
  });

  it("renders the confirm password and admin fields, unchecked by default", () => {
    render(<SignupForm isAdmin />);
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^admin$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^admin$/i)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /add member/i })).toBeInTheDocument();
  });

  it("blocks submission and shows a field error when passwords don't match", async () => {
    render(<SignupForm isAdmin />);

    fillValidForm();
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Different1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockCreateMember).not.toHaveBeenCalled();
  });

  it("calls createMember (not signup) on submit", async () => {
    mockCreateMember.mockResolvedValue({ data: { success: true } });
    render(<SignupForm isAdmin />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockCreateMember).toHaveBeenCalled();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("shows a plain success message with no login link on success", async () => {
    mockCreateMember.mockResolvedValue({ data: { success: true } });
    render(<SignupForm isAdmin />);

    fillValidForm();
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/member added successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /go to login/i })).not.toBeInTheDocument();
    });
  });
});
