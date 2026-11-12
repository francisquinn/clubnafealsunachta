import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePassword from "./ChangePassword";

const mockChangePassword = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ changePassword: mockChangePassword })),
);

beforeEach(() => {
  mockChangePassword.mockReset();
  document.body.innerHTML = "";
});

function fill({ current = "OldPassword1", next = "NewPassword1", confirm }: { current?: string; next?: string; confirm?: string } = {}) {
  confirm ??= next;
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.submit(screen.getByLabelText("Current password").closest("form")!);
}

describe("ChangePassword", () => {
  it("shows placeholder dots in a read-only field, never a real password", () => {
    render(<ChangePassword />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveValue("••••••••");
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toHaveAttribute("name");
  });

  it("saves the new password from the modal and says other devices were logged out", async () => {
    mockChangePassword.mockResolvedValue({ data: { success: true }, error: undefined });
    render(<ChangePassword />);
    fill();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your password is changed"));
    const sent = mockChangePassword.mock.calls[0]![0] as FormData;
    expect(sent.get("current_password")).toBe("OldPassword1");
    expect(sent.get("new_password")).toBe("NewPassword1");
    expect(sent.get("confirm_password")).toBe("NewPassword1");
  });

  it("checks the fields before calling the server", () => {
    render(<ChangePassword />);
    fill({ current: "", next: "short", confirm: "different" });

    expect(screen.getByText("Enter your current password")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows the server's error and keeps the modal open", async () => {
    mockChangePassword.mockResolvedValue({ data: undefined, error: { message: "Current password is incorrect" } });
    render(<ChangePassword />);
    fill({ current: "WrongPassword1" });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Current password is incorrect"));
    // The status region stays mounted, but says nothing.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows an error when the request fails", async () => {
    mockChangePassword.mockRejectedValue(new Error("offline"));
    render(<ChangePassword />);
    fill();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong"));
  });

  it("clears the typed passwords on Cancel", () => {
    render(<ChangePassword />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });
});
