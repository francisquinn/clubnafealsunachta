import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import JoinChapterButton from "./JoinChapterButton";

const mockGetChapterMembership = vi.fn();
const mockJoinChapter = vi.fn();
const mockFetchSessionInfo = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({
    getChapterMembership: mockGetChapterMembership,
    joinChapter: mockJoinChapter,
  })),
);

vi.mock("../../utils/session", () => ({ fetchSessionInfo: () => mockFetchSessionInfo() }));

const loggedIn = { loggedIn: true, isAdmin: false, member: null };
const loggedOut = { loggedIn: false, isAdmin: false, member: null };

beforeEach(() => {
  mockGetChapterMembership.mockReset();
  mockJoinChapter.mockReset();
  mockFetchSessionInfo.mockReset();
  document.body.innerHTML = "";
});

describe("JoinChapterButton", () => {
  it("renders nothing while the session is loading", () => {
    mockFetchSessionInfo.mockReturnValue(new Promise(() => {}));
    const { container } = render(<JoinChapterButton chapterId={1} chapterName="Trieste" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the header's login modal for a logged-out visitor", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedOut);
    const trigger = document.createElement("button");
    trigger.id = "cnf-login-trigger";
    const onClick = vi.fn();
    trigger.addEventListener("click", onClick);
    document.body.appendChild(trigger);

    render(<JoinChapterButton chapterId={1} chapterName="Trieste" />);
    fireEvent.click(await screen.findByRole("button", { name: "Join the Trieste chapter" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(mockJoinChapter).not.toHaveBeenCalled();
    expect(mockGetChapterMembership).not.toHaveBeenCalled();
  });

  it("shows nothing for a degraded session lookup rather than a login prompt", async () => {
    mockFetchSessionInfo.mockResolvedValue({ ...loggedOut, degraded: true });
    const { container } = render(<JoinChapterButton chapterId={1} chapterName="Trieste" />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the join to a logged-in member who is not in the chapter, then confirms", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={7} chapterName="Trieste" />);
    fireEvent.click(await screen.findByRole("button", { name: "Join the Trieste chapter" }));

    expect(await screen.findByText("You're part of the Trieste chapter.")).toBeInTheDocument();
    expect(mockGetChapterMembership).toHaveBeenCalledWith({ chapterId: 7 });
    expect(mockJoinChapter).toHaveBeenCalledWith({ chapterId: 7 });
  });

  it("shows that a member is already in the chapter, with no button", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={1} chapterName="Trieste" />);

    expect(await screen.findByText("You're part of the Trieste chapter.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the button and shows an error when joining fails", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

    render(<JoinChapterButton chapterId={1} chapterName="Trieste" />);
    fireEvent.click(await screen.findByRole("button", { name: "Join the Trieste chapter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Join the Trieste chapter" })).toBeEnabled());
  });
});
