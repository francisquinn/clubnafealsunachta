import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountForm from "./AccountForm";

const mockUpdateUsername = vi.fn();
const mockChangePassword = vi.fn();
const mockUpdateClubMemberships = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    updateUsername: (...args: unknown[]) => mockUpdateUsername(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    updateClubMemberships: (...args: unknown[]) => mockUpdateClubMemberships(...args),
  },
}));

const TRESTE = { id: 1, name: "Trieste" };
const DUBLIN = { id: 2, name: "Dublin" };

function submittedFormData() {
  return mockUpdateClubMemberships.mock.calls[0]?.[0] as FormData;
}

function renderForm(overrides: Partial<Parameters<typeof AccountForm>[0]> = {}) {
  render(
    <AccountForm
      initialUsername="oldname"
      initialFullName={null}
      initialDisplayFullName={false}
      clubs={[]}
      initialClubIds={[]}
      {...overrides}
    />
  );
}

describe("AccountForm", () => {
  beforeEach(() => {
    mockUpdateUsername.mockReset();
    mockChangePassword.mockReset();
    mockUpdateClubMemberships.mockReset();
  });

  it("renders the username, full name and password fields, and a single save button", () => {
    render(
      <AccountForm
        initialUsername="oldname"
        initialFullName="Old Name"
        initialDisplayFullName={true}
        clubs={[]}
        initialClubIds={[]}
      />
    );
    expect(screen.getByLabelText("Username")).toHaveValue("oldname");
    expect(screen.getByLabelText("Full name")).toHaveValue("Old Name");
    expect(screen.getByLabelText(/show my full name instead of my username/i)).toBeChecked();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /save/i })).toHaveLength(1);
  });

  it("doesn't render a club section when there are no clubs", () => {
    renderForm({ clubs: [] });
    expect(screen.queryByText(/club memberships/i)).not.toBeInTheDocument();
  });

  it("renders a checkbox per club, reflecting current associations on load", () => {
    renderForm({ clubs: [TRESTE, DUBLIN], initialClubIds: [1] });

    expect(screen.getByRole("checkbox", { name: "Trieste" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dublin" })).not.toBeChecked();
    // still exactly one save button for the whole form
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

  it("saves the username without touching the password when the password fields are left blank, and skips club settings when there are no clubs", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm({ clubs: [] });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockUpdateClubMemberships).not.toHaveBeenCalled();
  });

  it("does not treat an autofilled current-password field alone as a password-change request", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm({ clubs: [] });

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
    expect(mockUpdateClubMemberships).not.toHaveBeenCalled();
  });

  it("saves username, password, and club settings in one submit", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ data: { success: true } });
    mockUpdateClubMemberships.mockResolvedValue({ data: { success: true, club_ids: [1, 2] } });
    renderForm({ clubs: [TRESTE, DUBLIN], initialClubIds: [1] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Dublin" }));
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info, password, and club settings have been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
    expect(mockUpdateClubMemberships).toHaveBeenCalledTimes(1);
    // all three save together off one shared FormData
    expect(submittedFormData().getAll("club_id")).toEqual(["1", "2"]);
  });

  it("reports the username as saved and explains the password failure when only the password action errors", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ error: { message: "Current password is incorrect" } });
    renderForm({ clubs: [] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "WrongPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated\. password unchanged: current password is incorrect/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("form")).toBeInTheDocument();
  });

  it("reports info and password as saved and explains the club-settings failure when only that action errors", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ data: { success: true } });
    mockUpdateClubMemberships.mockResolvedValue({ error: { message: "One or more selected clubs do not exist" } });
    renderForm({ clubs: [TRESTE], initialClubIds: [] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/your info and password have been updated\. club settings unchanged: one or more selected clubs do not exist/i)
      ).toBeInTheDocument();
    });
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
