import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountForm from "./AccountForm";

const mockUpdateUsername = vi.fn();
const mockChangePassword = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    updateUsername: (...args: unknown[]) => mockUpdateUsername(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
  },
}));

function renderForm() {
  render(<AccountForm initialUsername="oldname" initialFullName={null} initialDisplayFullName={false} />);
}

describe("AccountForm", () => {
  beforeEach(() => {
    mockUpdateUsername.mockReset();
    mockChangePassword.mockReset();
  });

  it("renders the username, full name and password fields, and a single save button", () => {
    render(<AccountForm initialUsername="oldname" initialFullName="Old Name" initialDisplayFullName={true} />);
    expect(screen.getByLabelText("Username")).toHaveValue("oldname");
    expect(screen.getByLabelText("Full name")).toHaveValue("Old Name");
    expect(screen.getByLabelText(/show my full name instead of my username/i)).toBeChecked();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /save/i })).toHaveLength(1);
  });

  it("blocks submission and shows a field error when the username is invalid", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "a" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid username/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).not.toHaveBeenCalled();
  });

  it("saves the username without touching the password when the password fields are left blank", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm();

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("does not treat an autofilled current-password field alone as a password-change request", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm();

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("requires the current password and a matching confirmation once a new password is entered", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "Different1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/enter your current password/i)).toBeInTheDocument();
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).not.toHaveBeenCalled();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("saves both username and password in one submit when password fields are filled in", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ data: { success: true } });
    renderForm();

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info and password have been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
  });

  it("reports the username as saved and explains the password failure when only the password action errors", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ error: { message: "Current password is incorrect" } });
    renderForm();

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "WrongPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated\. password unchanged: current password is incorrect/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("form")).toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    mockUpdateUsername.mockReturnValue(new Promise(() => {}));
    renderForm();

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });
});
