import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeleteAccount from "./DeleteAccount";

const mockDeleteAccount = vi.fn();
const mockClearCachedMember = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ deleteAccount: mockDeleteAccount })),
);

vi.mock("../../utils/session", () => ({ clearCachedMember: () => mockClearCachedMember() }));

const assign = vi.fn();

beforeEach(() => {
  mockDeleteAccount.mockReset();
  mockClearCachedMember.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function confirmWith(password: string) {
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  fireEvent.change(screen.getByLabelText("Your password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
}

describe("DeleteAccount", () => {
  it("sends the password and goes home once the account is deleted", async () => {
    mockDeleteAccount.mockResolvedValue({ data: { success: true }, error: undefined });
    render(<DeleteAccount />);

    confirmWith("My-password1");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    const formData = mockDeleteAccount.mock.calls[0]?.[0] as FormData;
    expect(formData.get("password")).toBe("My-password1");
    expect(mockClearCachedMember).toHaveBeenCalled();
  });

  it("shows the server's error and stays put", async () => {
    mockDeleteAccount.mockResolvedValue({ data: undefined, error: { message: "Password is incorrect" } });
    render(<DeleteAccount />);

    confirmWith("Wrong-password1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Password is incorrect");
    expect(screen.getByLabelText("Your password")).toHaveFocus();
    expect(assign).not.toHaveBeenCalled();
    expect(mockClearCachedMember).not.toHaveBeenCalled();
  });

  it("closes on Cancel without deleting", async () => {
    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(document.querySelector("dialog")).not.toHaveAttribute("open"));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("clears the typed password when closed", () => {
    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "My-password1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Your password")).toHaveValue("");
  });

  it("recovers from a network failure: shows an error, re-enables the button and can close", async () => {
    mockDeleteAccount.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DeleteAccount />);

    confirmWith("My-password1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Reload the page and try again.");
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
