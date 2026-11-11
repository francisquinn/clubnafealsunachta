import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountForm from "./AccountForm";
import { getCachedMember } from "../../utils/session";

const mockUpdateUsername = vi.fn();
const mockChangePassword = vi.fn();
const mockUploadAvatar = vi.fn();
const mockJoinChapter = vi.fn();
const mockLeaveChapter = vi.fn();
const mockSetChapterEmails = vi.fn();
const mockRequestEmailChange = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({
    updateUsername: mockUpdateUsername,
    changePassword: mockChangePassword,
    uploadAvatar: mockUploadAvatar,
    joinChapter: mockJoinChapter,
    leaveChapter: mockLeaveChapter,
    setChapterEmails: mockSetChapterEmails,
    requestEmailChange: mockRequestEmailChange,
  })),
);

const TRESTE = { id: 1, name: "Trieste", emailsEnabled: true };
const DUBLIN = { id: 2, name: "Dublin", emailsEnabled: false };

function renderForm(overrides: Partial<Parameters<typeof AccountForm>[0]> = {}) {
  render(
    <AccountForm
      initialMemberId="member-1"
      initialEmail="alice@example.com"
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
    mockUploadAvatar.mockReset();
    mockJoinChapter.mockReset();
    mockLeaveChapter.mockReset();
    mockSetChapterEmails.mockReset();
    mockRequestEmailChange.mockReset();
    localStorage.clear();
  });

  it("groups photo, username, full name, email and password under Account details, in that order", () => {
    renderForm();
    const details = screen.getByRole("group", { name: "Account details" });
    const labels = [...details.querySelectorAll("label")].filter((label) => !label.closest("dialog")).map((label) => label.textContent);
    expect(labels).toEqual(["Photo", "Username", "Full name", "Email", "Password"]);
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
  });

  it("shows the name read-only with Edit buttons, and no Save button", () => {
    render(
      <AccountForm
        initialMemberId="member-1"
        initialEmail="alice@example.com"
        initialUsername="oldname"
        initialFullName="Old Name"
        initialDisplayFullName={true}
        initialAvatarUrl={null}
        showChapters
        chapters={[]}
      />
    );
    // The read-only copies sit on the page; the editable fields live in the
    // sections' modals.
    const inModal = (el: HTMLElement) => el.closest("dialog") !== null;
    const username = screen.getAllByLabelText("Username").find((el) => !inModal(el));
    expect(username).toHaveValue("oldname");
    expect(username).toHaveAttribute("readonly");
    expect(username).not.toHaveAttribute("name");
    expect(screen.getAllByLabelText("Full name").find((el) => !inModal(el))).toHaveValue("Old Name");
    expect(inModal(screen.getByLabelText(/show my full name instead of my username/i))).toBe(true);
    expect(inModal(screen.getByLabelText(/current password/i))).toBe(true);
    expect(screen.getByRole("button", { name: "Edit username" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
    // Only the modals' own Save buttons.
    expect(screen.getAllByRole("button", { name: /^save$/i, hidden: true }).every(inModal)).toBe(true);
  });

  it("updates the avatar's letter as soon as the name is saved", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true }, error: undefined });
    renderForm();
    const letter = () => document.querySelector(".cnf-form__avatar-row .cnf-avatar")!.textContent;
    expect(letter()).toBe("O");

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    const usernameField = document.querySelector<HTMLInputElement>("dialog [name=username]")!;
    fireEvent.change(usernameField, { target: { value: "newname" } });
    fireEvent.submit(usernameField.closest("form")!);

    await waitFor(() => expect(letter()).toBe("N"));
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
  });

  // #219: no Save button; each box saves as it changes.
  it("saves an email setting as soon as it's ticked", async () => {
    mockSetChapterEmails.mockResolvedValue({ data: { emailsEnabled: true }, error: undefined });
    renderForm({ chapters: [DUBLIN] });
    const emails = screen.getByRole("checkbox", { name: "Upcoming events in Dublin" });

    fireEvent.click(emails);

    await waitFor(() => expect(emails).toBeChecked());
    expect(mockSetChapterEmails).toHaveBeenCalledWith({ chapterId: 2, enabled: true });
    expect(emails).toHaveAccessibleDescription("Saved: you'll get emails about Dublin's events.");
  });

  // Disabling it would drop keyboard focus, so it's marked busy instead.
  it("keeps an email setting focusable while it saves, and ignores clicks until it's done", async () => {
    let finish!: (value: unknown) => void;
    mockSetChapterEmails.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm({ chapters: [DUBLIN] });
    const emails = screen.getByRole("checkbox", { name: "Upcoming events in Dublin" });

    fireEvent.click(emails);
    expect(emails).toBeEnabled();
    expect(emails).toHaveAttribute("aria-busy", "true");
    fireEvent.click(emails);
    expect(mockSetChapterEmails).toHaveBeenCalledTimes(1);

    finish({ data: { emailsEnabled: true }, error: undefined });
    await waitFor(() => expect(emails).toBeChecked());
    expect(emails).not.toHaveAttribute("aria-busy");
  });

  it("takes a chapter left elsewhere off the page when saving its email setting finds it gone", async () => {
    mockSetChapterEmails.mockResolvedValue({ data: undefined, error: { code: "NOT_FOUND", message: "Not a member of this chapter" } });
    renderForm({ chapters: [TRESTE, DUBLIN] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Upcoming events in Trieste" }));

    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Trieste" })).not.toBeInTheDocument());
    expect(screen.queryByRole("checkbox", { name: "Upcoming events in Trieste" })).not.toBeInTheDocument();
    expect(screen.getByText(/^You're no longer in Trieste\./)).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Dublin" })).toBeInTheDocument();
  });

  it("puts an email setting back and says so when saving it fails", async () => {
    mockSetChapterEmails.mockResolvedValue({ data: undefined, error: { message: "boom" } });
    renderForm({ chapters: [TRESTE] });
    const emails = screen.getByRole("checkbox", { name: "Upcoming events in Trieste" });

    fireEvent.click(emails);

    await waitFor(() => expect(screen.getByText("Couldn't save that. Please try again.")).toBeInTheDocument());
    expect(emails).toBeChecked();
  });

  it("asks before leaving a chapter, and keeps it if the member cancels", async () => {
    renderForm({ chapters: [TRESTE] });
    const membership = screen.getByRole("checkbox", { name: "Trieste" });

    fireEvent.click(membership);

    expect(screen.getByRole("heading", { name: "Leave Trieste?" })).toBeInTheDocument();
    expect(membership).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockLeaveChapter).not.toHaveBeenCalled();
    expect(membership).toBeChecked();
  });

  it("leaves the chapter once confirmed, taking it out of both lists", async () => {
    mockLeaveChapter.mockResolvedValue({ data: { joined: false }, error: undefined });
    renderForm({ chapters: [TRESTE, DUBLIN] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Trieste" })).not.toBeInTheDocument());
    expect(mockLeaveChapter).toHaveBeenCalledWith({ chapterId: 1 });
    expect(screen.queryByRole("checkbox", { name: "Upcoming events in Trieste" })).not.toBeInTheDocument();
    const note = screen.getByText(/^You've left Trieste\./);
    expect(screen.getByRole("checkbox", { name: "Dublin" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Upcoming events in Dublin" })).toBeInTheDocument();
    // Its box is gone, so focus goes to the note.
    await waitFor(() => expect(note).toHaveFocus());
  });

  it("shows the empty states once the last chapter is left", async () => {
    mockLeaveChapter.mockResolvedValue({ data: { joined: false }, error: undefined });
    renderForm({ chapters: [TRESTE] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => expect(screen.getByText(/you haven't joined a chapter yet/i)).toBeInTheDocument());
    expect(screen.getByText("Join a chapter to get emails about its events.")).toBeInTheDocument();
  });

  it("keeps the confirmation open with an error when leaving fails", async () => {
    mockLeaveChapter.mockResolvedValue({ data: undefined, error: { message: "boom" } });
    renderForm({ chapters: [TRESTE] });

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong"));
    expect(screen.getByRole("checkbox", { name: "Trieste" })).toBeChecked();
  });

  it("shows Update once a photo is chosen, uploads it on click and caches it for the header", async () => {
    mockUploadAvatar.mockResolvedValue({ data: { avatar_url: "https://x/avatars/member-1" }, error: undefined });
    renderForm();
    expect(screen.queryByRole("button", { name: "Update photo" })).not.toBeInTheDocument();

    const file = new File(["fake-image-bytes"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    expect(mockUploadAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Update photo" }));

    // The Update button goes away, so focus moves to the message.
    await waitFor(() => expect(screen.getByText("Your photo is updated.")).toHaveFocus());
    expect((mockUploadAvatar.mock.calls[0]![0] as FormData).get("avatar")).toBe(file);
    expect(getCachedMember()?.avatar_url).toBe("https://x/avatars/member-1");
    expect(screen.queryByRole("button", { name: "Update photo" })).not.toBeInTheDocument();
  });

  it("explains a failed upload, with a friendly message for one that's too large", async () => {
    mockUploadAvatar.mockResolvedValue({ data: undefined, error: { code: "CONTENT_TOO_LARGE", message: "Request body exceeds 1048576 bytes" } });
    renderForm();

    const file = new File(["fake-image-bytes"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Update photo" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your photo is too large to upload. Try a smaller file."));
    // Still there to try again.
    expect(screen.getByRole("button", { name: "Update photo" })).toBeEnabled();
    expect(screen.queryByText(/request body exceeds/i)).not.toBeInTheDocument();
    expect(getCachedMember()).toBeNull();
  });

  it("shows an immediate field error, and no Update button, when a non-image avatar file is chosen", () => {
    renderForm();

    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });

    expect(screen.getByText(/must be an image file/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update photo" })).not.toBeInTheDocument();
  });

  it("shows an immediate field error when an oversized avatar file is chosen", () => {
    renderForm();

    const file = new File(["fake-image-bytes"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [file] } });

    expect(screen.getByText(/must be 5mb or smaller/i)).toBeInTheDocument();
  });
});
