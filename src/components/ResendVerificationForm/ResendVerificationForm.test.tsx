import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResendVerificationForm from "./ResendVerificationForm";

const mockResend = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ resendVerification: mockResend })),
);

beforeEach(() => {
  mockResend.mockReset();
});

describe("ResendVerificationForm", () => {
  it("prefills the email from the expired link", () => {
    render(<ResendVerificationForm defaultEmail="new@example.com" />);
    expect(screen.getByLabelText("Email")).toHaveValue("new@example.com");
  });

  it("sends the email and shows a neutral confirmation", async () => {
    mockResend.mockResolvedValue({ data: { success: true }, error: undefined });
    render(<ResendVerificationForm defaultEmail="new@example.com" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/If that email belongs/));
    expect((mockResend.mock.calls[0]![0] as FormData).get("identifier")).toBe("new@example.com");
  });

  it("rejects an invalid email without calling the server", () => {
    render(<ResendVerificationForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("shows an error when the request fails", async () => {
    mockResend.mockRejectedValue(new Error("offline"));
    render(<ResendVerificationForm defaultEmail="new@example.com" />);
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });
});
