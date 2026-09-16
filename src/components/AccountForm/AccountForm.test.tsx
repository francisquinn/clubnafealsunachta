import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountForm from "./AccountForm";
import { getCachedMember } from "../../utils/session";

const mockUpdateUsername = vi.fn();
const mockChangePassword = vi.fn();
const mockUpdateClubMemberships = vi.fn();
const mockUploadAvatar = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    updateUsername: (...args: unknown[]) => mockUpdateUsername(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    updateClubMemberships: (...args: unknown[]) => mockUpdateClubMemberships(...args),
    uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
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
      initialMemberId="member-1"
      initialUsername="oldname"
      initialFullName={null}
      initialDisplayFullName={false}
      initialAvatarUrl={null}
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
    mockUploadAvatar.mockReset();
    localStorage.clear();
  });

  it("renders the username, full name and password fields, and a single save button", () => {
    render(
      <AccountForm
        initialMemberId="member-1"
        initialUsername="oldname"
        initialFullName="Old Name"
        initialDisplayFullName={true}
        initialAvatarUrl={null}
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

  // #70 follow-up: without this, AccountMenu's header avatar would show the
  // just-replaced username/letter for one more page load, until its own
  // background /api/me fetch catches up — see session.ts's cache helpers.
  it("caches the new username/full name so the header avatar is right on the next page load", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newname" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Name" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(getCachedMember()).toEqual({
      id: "member-1",
      username: "newname",
      full_name: "New Name",
      display_full_name: false,
      avatar_url: null,
    });
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

  // The full choose-a-file-then-submit round trip (does handleSubmit's
  // FormData actually carry the File through to actions.uploadAvatar) isn't
  // testable here: happy-dom's FormData doesn't pick up a file input's
  // `.files` when it's set the low-level fireEvent way, only a real browser
  // does. Same gap as BookForm.tsx's cover-image upload, left untested there
  // for the same reason. What IS testable at this level — the immediate
  // client-side validation feedback on choosing a file, independent of any
  // submit — is covered below.

  // A request over Astro's action body-size cap fails before it reaches the
  // server, so every part of the shared submission gets the same raw
  // "Request body exceeds N bytes" — one plain message beats that repeated
  // per field. (The avatar-specific wording branch needs a real File to
  // reach handleSubmit's FormData, which happy-dom can't do — see the
  // comment above; this covers the non-photo wording and the collapsing
  // behavior itself.)
  it("shows one friendly message instead of the raw size-limit error repeated per field", async () => {
    const tooLarge = { code: "CONTENT_TOO_LARGE", message: "Request body exceeds 1048576 bytes" };
    mockUpdateUsername.mockResolvedValue({ error: tooLarge });
    mockUpdateClubMemberships.mockResolvedValue({ error: tooLarge });
    renderForm({ clubs: [TRESTE], initialClubIds: [] });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/too much to submit at once/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/request body exceeds/i)).not.toBeInTheDocument();
  });

  it("doesn't call uploadAvatar when no file was chosen", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm();

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it("shows an immediate field error when a non-image avatar file is chosen", () => {
    renderForm();

    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });

    expect(screen.getByText(/must be an image file/i)).toBeInTheDocument();
  });

  it("shows an immediate field error when an oversized avatar file is chosen", () => {
    renderForm();

    const file = new File(["fake-image-bytes"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });

    expect(screen.getByText(/must be 5mb or smaller/i)).toBeInTheDocument();
  });
});
