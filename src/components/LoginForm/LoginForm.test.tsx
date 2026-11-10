import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "./LoginForm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockResend = vi.fn();
vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ resendVerification: mockResend })),
);

describe("LoginForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockResend.mockReset();
  });

  async function failLoginWith(body: object) {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve(body) });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: "newbie" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password1" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(body.error as string)).toBeInTheDocument());
  }

  it("offers a new confirmation link when the account is unverified", async () => {
    mockResend.mockResolvedValue({ data: { success: true }, error: undefined });
    await failLoginWith({ error: "Please confirm your email", unverified: true });

    fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/new confirmation link is on its way/));
    expect((mockResend.mock.calls[0][0] as FormData).get("identifier")).toBe("newbie");
  });

  it("doesn't offer a new link for other login errors", async () => {
    await failLoginWith({ error: "Invalid username/email or password" });
    expect(screen.queryByRole("button", { name: "Send a new link" })).not.toBeInTheDocument();
  });

  it("renders all required form fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("prefills the identifier field from defaultIdentifier", () => {
    render(<LoginForm defaultIdentifier="user@example.com" />);
    expect(screen.getByLabelText(/email or username/i)).toHaveValue("user@example.com");
  });

  it("clears the identifier field when defaultIdentifier changes to empty, even without remounting", () => {
    const { rerender } = render(<LoginForm defaultIdentifier="user@example.com" />);
    expect(screen.getByLabelText(/email or username/i)).toHaveValue("user@example.com");

    rerender(<LoginForm defaultIdentifier="" />);
    expect(screen.getByLabelText(/email or username/i)).toHaveValue("");
  });

  it("still lets the user type over a prefilled value", () => {
    render(<LoginForm defaultIdentifier="user@example.com" />);
    const input = screen.getByLabelText(/email or username/i);
    fireEvent.change(input, { target: { value: "someoneelse" } });
    expect(input).toHaveValue("someoneelse");
  });

  it("shows the server error message on a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "Invalid username/email or password" }) });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid username/email or password")).toBeInTheDocument();
    });
  });

  it("calls onSuccess on a successful login", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password1" } });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
