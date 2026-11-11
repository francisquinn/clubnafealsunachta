import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangeName from "./ChangeName";
import { getCachedMember } from "../../utils/session";

const mockUpdateUsername = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ updateUsername: mockUpdateUsername })),
);

beforeEach(() => {
  mockUpdateUsername.mockReset();
  localStorage.clear();
  document.body.innerHTML = "";
});

function renderSection(props: Partial<Parameters<typeof ChangeName>[0]> = {}) {
  render(<ChangeName memberId="member-1" username="oldname" fullName="Old Name" displayFullName={false} avatarUrl={null} {...props} />);
}

// The modal's editable fields, as opposed to the read-only copies on the page.
const modalField = (name: string) => document.querySelector<HTMLInputElement>(`dialog [name=${name}]`)!;

function submitModal() {
  fireEvent.submit(modalField("username").closest("form")!);
}

describe("ChangeName", () => {
  it("shows the username and full name read-only, and 'Not set' for a missing full name", () => {
    renderSection({ fullName: null });
    expect(document.getElementById("current-username")).toHaveValue("oldname");
    expect(document.getElementById("current-username")).toHaveAttribute("readonly");
    expect(document.getElementById("current-full-name")).toHaveValue("");
    expect(document.getElementById("current-full-name")).toHaveAttribute("placeholder", "Not set");
  });

  it("notes when the full name is shown instead of the username", () => {
    renderSection({ displayFullName: true });
    expect(screen.getByText("Shown instead of your username.")).toBeInTheDocument();
  });

  it("opens with the saved values", () => {
    renderSection({ displayFullName: true });
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    expect(modalField("username")).toHaveValue("oldname");
    expect(modalField("full_name")).toHaveValue("Old Name");
    expect(modalField("display_full_name")).toBeChecked();
  });

  it("saves, updates the read-only fields and caches the new name for the header", async () => {
    mockUpdateUsername.mockResolvedValue({ data: { success: true }, error: undefined });
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(modalField("username"), { target: { value: "newname" } });
    fireEvent.change(modalField("full_name"), { target: { value: "New Name" } });
    submitModal();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your name is updated."));
    expect(document.getElementById("current-username")).toHaveValue("newname");
    expect(document.getElementById("current-full-name")).toHaveValue("New Name");
    const sent = mockUpdateUsername.mock.calls[0]![0] as FormData;
    expect(sent.get("username")).toBe("newname");
    expect(sent.get("full_name")).toBe("New Name");
    expect(getCachedMember()).toEqual({
      id: "member-1",
      username: "newname",
      full_name: "New Name",
      display_full_name: false,
      avatar_url: null,
    });
  });

  it("blocks an invalid username before calling the server", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(modalField("username"), { target: { value: "a" } });
    submitModal();

    await waitFor(() => expect(screen.getByText(/please enter a valid username/i)).toBeInTheDocument());
    expect(mockUpdateUsername).not.toHaveBeenCalled();
  });

  it("shows the server's error, keeps the modal open and the old values", async () => {
    mockUpdateUsername.mockResolvedValue({ data: undefined, error: { message: "That username is already taken" } });
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(modalField("username"), { target: { value: "taken" } });
    submitModal();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That username is already taken"));
    expect(document.getElementById("current-username")).toHaveValue("oldname");
    expect(getCachedMember()).toBeNull();
  });

  it("opens the same modal from the full name's Edit button and returns focus to it", async () => {
    renderSection();
    const fullNameButton = screen.getByRole("button", { name: "Edit full name" });
    fireEvent.click(fullNameButton);
    expect(modalField("username").closest("dialog")).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // Focus returns once the close animation ends.
    await waitFor(() => expect(fullNameButton).toHaveFocus());
  });

  it("puts back the saved values on Cancel", () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(modalField("username"), { target: { value: "half-typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(modalField("username")).toHaveValue("oldname");
  });
});
