import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountMenu from "./AccountMenu";
import { getCachedMember, setCachedMember } from "../../utils/session";

const mockFetchSessionInfo = vi.fn();

vi.mock("../../utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/session")>();
  return { ...actual, fetchSessionInfo: () => mockFetchSessionInfo() };
});

const MEMBER = {
  id: "member-1",
  username: "alice",
  full_name: null,
  display_full_name: false,
  avatar_url: null,
};

describe("AccountMenu", () => {
  beforeEach(() => {
    localStorage.clear();
    // Pending by default (never resolves during a test) so each test can
    // inspect the pre-fetch render without a background update landing
    // mid-assertion — session.ts's /api/me round trip is exercised by
    // session.test.ts, not here.
    mockFetchSessionInfo.mockReturnValue(new Promise(() => {}));
  });

  // #70 follow-up: this is the actual fix for "it just pops in/flashes on
  // every page" — a cached member should paint immediately, with no
  // skeleton, before the network fetch above ever resolves.
  it("paints the cached member's avatar immediately, with no skeleton", () => {
    setCachedMember(MEMBER);

    render(<AccountMenu pathname="/" />);

    expect(document.querySelector(".cnf-avatar--skeleton")).not.toBeInTheDocument();
    const avatar = document.querySelector(".cnf-avatar--fallback");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent("A"); // first letter of "alice"
  });

  it("shows a skeleton instead of a specific letter/color on a true first load (nothing cached yet)", () => {
    render(<AccountMenu pathname="/" />);

    expect(document.querySelector(".cnf-avatar--skeleton")).toBeInTheDocument();
    expect(document.querySelector(".cnf-avatar--fallback")).not.toBeInTheDocument();
  });

  // #128: a failed lookup on the server isn't "logged out" - keep showing the
  // cached member instead of falling back to the generic "Account" avatar.
  // "bob" (B) vs the generic fallback (A, from "Account") tells them apart.
  describe("when /api/me answers", () => {
    const BOB = { ...MEMBER, id: "member-2", username: "bob" };
    const avatar = () => document.querySelector(".cnf-avatar--fallback");

    it("keeps the cached member if the server could not verify the session (degraded)", async () => {
      setCachedMember(BOB);
      mockFetchSessionInfo.mockResolvedValue({ loggedIn: true, isAdmin: false, member: null, degraded: true });

      render(<AccountMenu pathname="/" />);

      await waitFor(() => expect(mockFetchSessionInfo).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(avatar()).toHaveTextContent("B");
    });

    it("drops the cached member if the server says there is no member (not degraded)", async () => {
      setCachedMember(BOB);
      mockFetchSessionInfo.mockResolvedValue({ loggedIn: false, isAdmin: false, member: null });

      render(<AccountMenu pathname="/" />);

      await waitFor(() => expect(avatar()).toHaveTextContent("A"));
    });
  });

  // Otherwise a different member logging in next on the same (shared/kiosk)
  // browser would briefly see the previous member's cached avatar.
  it("clears the cached member on logout", () => {
    setCachedMember(MEMBER);
    render(<AccountMenu pathname="/" />);

    fireEvent.submit(screen.getByRole("button", { name: /logout/i }).closest("form")!);

    expect(getCachedMember()).toBeNull();
  });
});
