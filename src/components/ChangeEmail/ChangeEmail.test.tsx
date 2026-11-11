import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangeEmail from "./ChangeEmail";

const mockRequest = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ requestEmailChange: mockRequest })),
);

beforeEach(() => {
  mockRequest.mockReset();
  document.body.innerHTML = "";
});

function submit(newEmail: string, password = "My-password1") {
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  fireEvent.change(screen.getByLabelText("New email"), { target: { value: newEmail } });
  fireEvent.change(screen.getByLabelText("Your password"), { target: { value: password } });
  fireEvent.submit(screen.getByLabelText("New email").closest("form")!);
}

describe("ChangeEmail", () => {
  it("shows the current email", () => {
    render(<ChangeEmail email="old@example.com" />);
    expect(screen.getByLabelText("Email")).toHaveValue("old@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  });

  it("sends the request and says where the link went", async () => {
    mockRequest.mockResolvedValue({ data: { success: true }, error: undefined });
    render(<ChangeEmail email="old@example.com" />);
    submit("New@Example.com");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("We've sent a link to new@example.com"));
    const sent = mockRequest.mock.calls[0]![0] as FormData;
    expect(sent.get("new_email")).toBe("New@Example.com");
    expect(sent.get("password")).toBe("My-password1");
  });

  it("shows the server's error and keeps the modal open", async () => {
    mockRequest.mockResolvedValue({ data: undefined, error: { message: "That password is incorrect" } });
    render(<ChangeEmail email="old@example.com" />);
    submit("new@example.com", "wrong");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That password is incorrect"));
    expect(screen.getByLabelText("New email")).toBeInTheDocument();
  });

  it("rejects an invalid email without calling the server", () => {
    render(<ChangeEmail email="old@example.com" />);
    submit("nope");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("shows an error when the request fails", async () => {
    mockRequest.mockRejectedValue(new Error("offline"));
    render(<ChangeEmail email="old@example.com" />);
    submit("new@example.com");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong"));
  });
});
