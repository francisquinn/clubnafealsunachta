import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import JoinChapterButton from "./JoinChapterButton";

const mockGetChapterMembership = vi.fn();
const mockJoinChapter = vi.fn();
const mockLeaveChapter = vi.fn();
const mockSetChapterEmails = vi.fn();
const mockFetchSessionInfo = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({
    getChapterMembership: mockGetChapterMembership,
    joinChapter: mockJoinChapter,
    leaveChapter: mockLeaveChapter,
    setChapterEmails: mockSetChapterEmails,
  })),
);

vi.mock("../../utils/session", () => ({ fetchSessionInfo: () => mockFetchSessionInfo() }));

const loggedIn = { loggedIn: true, isAdmin: false, member: null };
const loggedOut = { loggedIn: false, isAdmin: false, member: null };

const chapter = {
  chapterName: "Trieste",
  meetingWhen: "Thursdays @ 18:30",
  chatUrl: "https://chat.whatsapp.com/example",
};

beforeEach(() => {
  mockGetChapterMembership.mockReset();
  mockJoinChapter.mockReset();
  mockLeaveChapter.mockReset();
  mockSetChapterEmails.mockReset();
  mockFetchSessionInfo.mockReset();
  document.body.innerHTML = "";
});

describe("JoinChapterButton", () => {
  it("holds the button's space, with no button, while the session is loading", () => {
    mockFetchSessionInfo.mockReturnValue(new Promise(() => {}));
    const { container } = render(<JoinChapterButton chapterId={1} {...chapter} />);
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

    render(<JoinChapterButton chapterId={1} {...chapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(mockJoinChapter).not.toHaveBeenCalled();
    expect(mockGetChapterMembership).not.toHaveBeenCalled();
  });

  it("shows nothing for a degraded session lookup rather than a login prompt", async () => {
    mockFetchSessionInfo.mockResolvedValue({ ...loggedOut, degraded: true });
    const { container } = render(<JoinChapterButton chapterId={1} {...chapter} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("offers the join to a logged-in member who is not in the chapter, then confirms", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={7} {...chapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(await screen.findByText("Member")).toBeInTheDocument();
    expect(mockGetChapterMembership).toHaveBeenCalledWith({ chapterId: 7 });
    expect(mockJoinChapter).toHaveBeenCalledWith({ chapterId: 7 });
  });

  it("shows a Member button for someone already in the chapter", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });

    render(<JoinChapterButton chapterId={1} {...chapter} />);

    expect(await screen.findByRole("button", { name: "Member" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Join chapter" })).toBeNull();
  });

  it("leaves the chapter when the Member button is clicked, then offers the join again", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });
    mockLeaveChapter.mockResolvedValue({ data: { joined: false }, error: undefined });

    render(<JoinChapterButton chapterId={7} {...chapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Member" }));

    expect(await screen.findByRole("button", { name: "Join chapter" })).toBeEnabled();
    expect(mockLeaveChapter).toHaveBeenCalledWith({ chapterId: 7 });
  });

  it("stays a member and shows an error when leaving fails", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: true }, error: undefined });
    mockLeaveChapter.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

    render(<JoinChapterButton chapterId={1} {...chapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Member" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Member" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Join chapter" })).toBeNull();
  });

  it("keeps the button and shows an error when joining fails", async () => {
    mockFetchSessionInfo.mockResolvedValue(loggedIn);
    mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
    mockJoinChapter.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

    render(<JoinChapterButton chapterId={1} {...chapter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await waitFor(() => expect(screen.getByRole("button", { name: "Join chapter" })).toBeEnabled());
  });

  describe("welcome modal (#211)", () => {
    async function joinChapter() {
      mockFetchSessionInfo.mockResolvedValue(loggedIn);
      mockGetChapterMembership.mockResolvedValue({ data: { joined: false }, error: undefined });
      mockJoinChapter.mockResolvedValue({ data: { joined: true }, error: undefined });
      render(<JoinChapterButton chapterId={7} {...chapter} />);
      fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));
      await screen.findByRole("heading", { name: "Welcome to Trieste!" });
    }

    it("welcomes the member with the meeting time, chat link and an unticked email checkbox", async () => {
      await joinChapter();

      expect(screen.getByText("We meet Thursdays @ 18:30.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Join the WhatsApp group" })).toHaveAttribute("href", chapter.chatUrl);
      expect(screen.getByRole("checkbox", { name: "Email me about upcoming events" })).not.toBeChecked();
    });

    it("doesn't open when a logged-out visitor clicks join", async () => {
      mockFetchSessionInfo.mockResolvedValue(loggedOut);
      render(<JoinChapterButton chapterId={1} {...chapter} />);
      fireEvent.click(await screen.findByRole("button", { name: "Join chapter" }));

      expect(screen.queryByRole("heading", { name: "Welcome to Trieste!" })).toBeNull();
    });

    it("turns the chapter's emails on when the box is ticked and saved", async () => {
      mockSetChapterEmails.mockResolvedValue({ data: { emailsEnabled: true }, error: undefined });
      await joinChapter();

      fireEvent.click(screen.getByRole("checkbox", { name: "Email me about upcoming events" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(mockSetChapterEmails).toHaveBeenCalledWith({ chapterId: 7, enabled: true }));
    });

    it("names the dialog by its heading", async () => {
      await joinChapter();
      expect(screen.getByRole("dialog", { name: "Welcome to Trieste!" })).toBeInTheDocument();
    });

    it("discards a ticked box when the modal is closed instead of saved", async () => {
      await joinChapter();

      fireEvent.click(screen.getByRole("checkbox", { name: "Email me about upcoming events" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(mockSetChapterEmails).not.toHaveBeenCalled();
    });

    it("returns focus to the Member button once the modal has closed", async () => {
      await joinChapter();

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "Member" })).toHaveFocus());
    });

    it("saves nothing when the box is left unticked, so emails stay off", async () => {
      await joinChapter();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockSetChapterEmails).not.toHaveBeenCalled();
    });

    it("can't be closed while the preference is saving, so a failure is still shown", async () => {
      let finishSave!: (value: unknown) => void;
      mockSetChapterEmails.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
      await joinChapter();

      fireEvent.click(screen.getByRole("checkbox", { name: "Email me about upcoming events" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      finishSave({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.getByRole("heading", { name: "Welcome to Trieste!" })).toBeInTheDocument();
    });

    it("shows an error and stays open when saving the preference fails", async () => {
      mockSetChapterEmails.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR" } });
      await joinChapter();

      fireEvent.click(screen.getByRole("checkbox", { name: "Email me about upcoming events" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.getByRole("heading", { name: "Welcome to Trieste!" })).toBeInTheDocument();
    });
  });
});
