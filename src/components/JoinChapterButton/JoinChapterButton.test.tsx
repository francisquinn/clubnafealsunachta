import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import JoinChapterButton from "./JoinChapterButton";

const mockGetChapterMembership = vi.fn();
const mockJoinChapter = vi.fn();
const mockLeaveChapter = vi.fn();
const mockFetchSessionInfo = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({
    getChapterMembership: mockGetChapterMembership,
    joinChapter: mockJoinChapter,
    leaveChapter: mockLeaveChapter,
  })),
);

vi.mock("../../utils/session", () => ({ fetchSessionInfo: () => mockFetchSessionInfo() }));

const loggedIn = { loggedIn: true, isAdmin: false, member: null };
const loggedOut = { loggedIn: false, isAdmin: false, member: null };

beforeEach(() => {
  mockGetChapterMembership.mockReset();
  mockJoinChapter.mockReset();
  mockLeaveChapter.mockReset();
  mockFetchSessionInfo.mockReset();
  document.body.innerHTML = "";
});

describe("JoinChapterButton", () => {
  it("holds the button's space, with no button, while the session is loading", () => {
    mockFetchSessionInfo.mockReturnValue(new Promise(() => {}));
    const { container } = render(<JoinChapterButton chapterId={1} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the header's login modal for a logged-out visitor", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedOut);
    const trigger = document.createElement("button");
    trigger.id = "cnf-login-trigger";
    const onClick = vi.fn();
    trigger.addEventListener("click", onClick);
    document.body.appendChild(trigger);

    render(<JoinChapterButton chapterId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(mockJoinChapter).not.toHaveBeenCalled();
    expect(mockGetChapterMembership).not.toHaveBeenCalled();
  });

  it("shows nothing for a degraded session lookup rather than a login prompt", async () => {
    mockFetchSessionInfo.mockResolvedValue({ ...loggedOut, degraded: true });
    const { container } = render(<JoinChapterButton chapterId={1} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("offers the join to a logged-in member who is not in the chapter, then confirms", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(await screen.findByText("Member")).toBeInTheDocument();
    expect(mockGetChapterMembership).toHaveBeenCalledWith({ chapterId: 7 });
    expect(mockJoinChapter).toHaveBeenCalledWith({ chapterId: 7 });
  });

  it("shows a Member button for someone already in the chapter", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={1} />);

    expect(await screen.findByRole("button", { name: "Member" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Join chapter" })).toBeNull();
  });

  it("leaves the chapter when the Member button is clicked, then offers the join again", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });
    mockLeaveChapter.mockResolvedValue({ data: { joined: false }, error: undefined });

    render(<JoinChapterButton chapterId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Member" }));

    expect(await screen.findByRole("button", { name: "Join chapter" })).toBeEnabled();
    expect(mockLeaveChapter).toHaveBeenCalledWith({ chapterId: 7 });
  });

  it("stays a member and shows an error when leaving fails", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });
    mockLeaveChapter.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

    render(<JoinChapterButton chapterId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Member" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Member" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Join chapter" })).toBeNull();
  });

  it("keeps the button and shows an error when joining fails", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

    render(<JoinChapterButton chapterId={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Join chapter" })).toBeEnabled());
  });
});
