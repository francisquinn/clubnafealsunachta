import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountForm from "./AccountForm";
import { getCachedMember } from "../../utils/session";

const mockUpdateUsername = vi.fn();
const mockChangePassword = vi.fn();
const mockUpdateChapterMemberships = vi.fn();
const mockUploadAvatar = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({
    updateUsername: mockUpdateUsername,
    changePassword: mockChangePassword,
    updateChapterMemberships: mockUpdateChapterMemberships,
    uploadAvatar: mockUploadAvatar,
  })),
);

const TRESTE = { id: 1, name: "Trieste", emailsEnabled: true };
const DUBLIN = { id: 2, name: "Dublin", emailsEnabled: false };

function submittedFormData() {
  return mockUpdateChapterMemberships.mock.calls[0]?.[0] as FormData;
}

function renderForm(overrides: Partial<Parameters<typeof AccountForm>[0]> = {}) {
  render(
    <AccountForm
      initialMemberId="member-1"
      initialUsername="oldname"
      initialFullName={null}
      initialDisplayFullName={false}
      initialAvatarUrl={null}
      showChapters
      chapters={[]}
      {...overrides}
    />
  );
}

describe("AccountForm", () => {
  beforeEach(() => {
    mockUpdateUsername.mockReset();
    mockChangePassword.mockReset();
    mockUpdateChapterMemberships.mockReset();
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
        showChapters
        chapters={[]}
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

  it("doesn't render a chapter section when the memberships couldn't be loaded", () => {
    renderForm({ showChapters: false, chapters: [] });
    expect(screen.queryByText(/chapter memberships/i)).not.toBeInTheDocument();
  });

  it("points a member with no chapters to the chapters page instead of offering to join here", () => {
    renderForm({ chapters: [] });
    expect(screen.getByText(/you haven't joined a chapter yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chapters page/i })).toHaveAttribute("href", "/chapters");
    expect(screen.queryByRole("checkbox", { name: /email me/i })).not.toBeInTheDocument();
  });

  it("lists only the member's chapters, ticked, with their email settings in a separate section", () => {
    renderForm({ chapters: [TRESTE, DUBLIN] });

    expect(screen.getByRole("checkbox", { name: "Trieste" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dublin" })).toBeChecked();
    expect(document.getElementById("chapter-1-emails")).toBeChecked();
    expect(document.getElementById("chapter-2-emails")).not.toBeChecked();
    expect(screen.getByRole("group", { name: "Email notifications" })).toHaveAttribute("id", "email-notifications");
    expect(screen.getByRole("checkbox", { name: "Upcoming events in Trieste" })).toBeChecked();
    // still exactly one save button for the whole form
    expect(screen.getAllByRole("button", { name: /save/i })).toHaveLength(1);
  });

  it("disables a chapter's email setting with a note while it's unticked to leave", () => {
    renderForm({ chapters: [TRESTE, DUBLIN] });
    const emails = screen.getByRole("checkbox", { name: "Upcoming events in Trieste" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    expect(emails).toBeDisabled();
    expect(screen.getByText("You'll leave Trieste when you save.")).toHaveAttribute("aria-live", "polite");
    expect(emails).toHaveAccessibleDescription("You'll leave Trieste when you save.");
    expect(screen.getByRole("checkbox", { name: "Upcoming events in Dublin" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    expect(emails).toBeEnabled();
    expect(screen.queryByText("You'll leave Trieste when you save.")).toBeNull();
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

  it("saves the username without touching the password when the password fields are left blank, and skips chapter settings when there are no chapters", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    renderForm({ chapters: [] });

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockUpdateChapterMemberships).not.toHaveBeenCalled();
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
    renderForm({ chapters: [] });

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
    expect(mockUpdateChapterMemberships).not.toHaveBeenCalled();
  });

  it("saves username, password, and chapter settings in one submit", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ data: { success: true } });
    mockUpdateChapterMemberships.mockResolvedValue({ data: { success: true, chapter_ids: [1, 2] } });
    renderForm({ chapters: [TRESTE, DUBLIN] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    fireEvent.click(document.getElementById("chapter-2-emails")!);
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info, password, and chapter settings have been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
    expect(mockUpdateChapterMemberships).toHaveBeenCalledTimes(1);
    // all three save together off one shared FormData
    // Trieste unticked (left, so its disabled email box isn't sent), Dublin
    // kept with its emails switched on.
    expect(submittedFormData().getAll("chapter_shown")).toEqual(["1", "2"]);
    expect(submittedFormData().getAll("chapter_id")).toEqual(["2"]);
    expect(submittedFormData().getAll("chapter_emails")).toEqual(["2"]);
    expect(submittedFormData().getAll("chapter_emails_was")).toEqual(["1"]);
  });

  // changePassword revokes the old session and re-issues it, so the other
  // actions must only start once it has finished (see AccountForm).
  it("finishes the password change before saving the username and chapter settings", async () => {
    let finishPassword!: (value: unknown) => void;
    mockChangePassword.mockReturnValue(new Promise((resolve) => (finishPassword = resolve)));
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockUpdateChapterMemberships.mockResolvedValue({ data: { success: true, chapter_ids: [1] } });
    renderForm({ chapters: [TRESTE] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledTimes(1));
    expect(mockUpdateUsername).not.toHaveBeenCalled();
    expect(mockUpdateChapterMemberships).not.toHaveBeenCalled();

    finishPassword({ data: { success: true } });
    await waitFor(() => {
      expect(screen.getByText(/your info, password, and chapter settings have been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateUsername).toHaveBeenCalledTimes(1);
    expect(mockUpdateChapterMemberships).toHaveBeenCalledTimes(1);
  });

  it("reports the username as saved and explains the password failure when only the password action errors", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ error: { message: "Current password is incorrect" } });
    renderForm({ chapters: [] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "WrongPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/your info has been updated\. password unchanged: current password is incorrect/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("form")).toBeInTheDocument();
  });

  it("reports info and password as saved and explains the chapter-settings failure when only that action errors", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true } });
    mockChangePassword.mockResolvedValue({ data: { success: true } });
    mockUpdateChapterMemberships.mockResolvedValue({ error: { message: "One or more selected chapters do not exist" } });
    renderForm({ chapters: [TRESTE] });

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewPassword1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/your info and password have been updated\. chapter settings unchanged: one or more selected chapters do not exist/i)
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
    mockUpdateChapterMemberships.mockResolvedValue({ error: tooLarge });
    renderForm({ chapters: [TRESTE] });

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
