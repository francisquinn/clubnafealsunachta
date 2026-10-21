import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import EventLiveActions from "./EventLiveActions";
import EventLocation from "../EventLocation/EventLocation";
import { resetLiveEventCache } from "../../lib/useLiveEvent";
import type { LiveEvent } from "../../lib/liveEvent";

const mockGetEventLive = vi.fn();

vi.mock("astro:actions", async () =>
  (await import("../../test/astroActions")).mockActions(() => ({ getEventLive: mockGetEventLive })),
);

const NOW = new Date("2030-06-01T12:00:00Z");
const BUILD_URL = "https://meet.jit.si/old";

function live(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    name: "Talk",
    date: "2030-06-01T11:00:00.000Z",
    endDate: "2030-06-01T14:00:00.000Z",
    isOnline: true,
    meetingUrl: "https://meet.jit.si/new",
    meetPoint: null,
    description: null,
    summary: null,
    venue: null,
    ...overrides,
  };
}

function renderActions(props: Partial<React.ComponentProps<typeof EventLiveActions>> = {}) {
  return render(
    <EventLiveActions
      slug="talk"
      visibleAtBuild={true}
      endDate="2030-06-01T14:00:00.000Z"
      isOnline={true}
      meetingUrl={BUILD_URL}
      icsHref="/chapter/events/talk.ics"
      icsFilename="talk.ics"
      googleUrl="https://calendar.google.com/build"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockGetEventLive.mockReset();
  resetLiveEventCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EventLiveActions (#197)", () => {
  it("shows build-time values before the live call resolves", () => {
    mockGetEventLive.mockReturnValue(new Promise(() => {}));
    renderActions();
    expect(screen.getByRole("link", { name: /join online/i })).toHaveAttribute("href", BUILD_URL);
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute("href", "/chapter/events/talk.ics");
  });

  it("swaps in a changed meeting link and live calendar links", async () => {
    mockGetEventLive.mockResolvedValue({ data: live(), error: undefined });
    renderActions();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /join online/i })).toHaveAttribute("href", "https://meet.jit.si/new"),
    );
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute("href", "/api/event-ics/talk");
    expect(screen.getByRole("link", { name: /google calendar/i }).getAttribute("href")).toContain("20300601T110000Z");
  });

  it("hides the buttons when the live data says the event has ended", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ endDate: "2030-06-01T11:30:00.000Z" }), error: undefined });
    renderActions();
    await waitFor(() => expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument();
  });

  it("shows the buttons for an event extended past what the build thought was over", async () => {
    mockGetEventLive.mockResolvedValue({ data: live(), error: undefined });
    renderActions({ visibleAtBuild: false, endDate: "2030-06-01T11:00:00.000Z" });
    expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /join online/i })).toHaveAttribute("href", "https://meet.jit.si/new");
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("hides the Join button when the live event lost its meeting link", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ meetingUrl: null }), error: undefined });
    renderActions();
    await waitFor(() => expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("is still shown mid-event (start in the past, end in the future)", async () => {
    // NOW is 12:00: started an hour ago, ends in an hour.
    mockGetEventLive.mockResolvedValue({
      data: live({ date: "2030-06-01T11:00:00.000Z", endDate: "2030-06-01T13:00:00.000Z", meetingUrl: "https://meet.jit.si/live" }),
      error: undefined,
    });
    renderActions();
    // Wait for the live swap so we know the live end date was evaluated.
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /join online/i })).toHaveAttribute("href", "https://meet.jit.si/live"),
    );
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("hides once the live end is in the past, even though the build-time end is still in the future", async () => {
    mockGetEventLive.mockResolvedValue({
      data: live({ date: "2030-06-01T10:00:00.000Z", endDate: "2030-06-01T11:59:00.000Z" }),
      error: undefined,
    });
    renderActions({ endDate: "2030-06-01T14:00:00.000Z" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument());
  });

  it("shares one getEventLive call between the actions and location islands", async () => {
    mockGetEventLive.mockResolvedValue({ data: live(), error: undefined });
    render(
      <>
        <EventLocation slug="talk" isOnline={true} meetingUrl={BUILD_URL} venue={null} />
        <EventLiveActions
          slug="talk"
          visibleAtBuild={true}
          endDate="2030-06-01T14:00:00.000Z"
          isOnline={true}
          meetingUrl={BUILD_URL}
          icsHref="/chapter/events/talk.ics"
          icsFilename="talk.ics"
          googleUrl="https://calendar.google.com/build"
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /^(online|join online)$/i }).map((a) => a.getAttribute("href"))).toEqual([
        "https://meet.jit.si/new",
        "https://meet.jit.si/new",
      ]),
    );
    expect(mockGetEventLive).toHaveBeenCalledTimes(1);
  });

  it("hides everything when the event was deleted (NOT_FOUND)", async () => {
    mockGetEventLive.mockResolvedValue({ data: undefined, error: { code: "NOT_FOUND", message: "gone" } });
    renderActions();
    await waitFor(() => expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /join online/i })).not.toBeInTheDocument();
  });

  it("keeps build-time buttons on a transient error code", async () => {
    mockGetEventLive.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR", message: "x" } });
    renderActions();
    await waitFor(() => expect(mockGetEventLive).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /join online/i })).toBeInTheDocument();
  });

  it("falls back to build-time values when the action fails", async () => {
    mockGetEventLive.mockResolvedValue({ data: undefined, error: { message: "boom" } });
    renderActions();
    await waitFor(() => expect(mockGetEventLive).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /join online/i })).toHaveAttribute("href", BUILD_URL);
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute("href", "/chapter/events/talk.ics");
  });

  it("falls back and still hides once the clock is past the build-time end when the action rejects", async () => {
    mockGetEventLive.mockRejectedValue(new Error("offline"));
    renderActions({ endDate: "2030-06-01T11:00:00.000Z" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument());
  });
});

const VENUE = { name: "Caffe Tommaseo", url: "https://maps.example/tommaseo" };

function renderLocation(props: Partial<React.ComponentProps<typeof EventLocation>> = {}) {
  return render(<EventLocation slug="talk" isOnline={true} meetingUrl={BUILD_URL} venue={null} {...props} />);
}

describe("EventLocation (#197)", () => {
  it("follows the live meeting url, build-time before it loads", async () => {
    mockGetEventLive.mockResolvedValue({ data: live(), error: undefined });
    renderLocation();
    expect(screen.getByRole("link", { name: "Online" })).toHaveAttribute("href", BUILD_URL);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Online" })).toHaveAttribute("href", "https://meet.jit.si/new"),
    );
  });

  it("keeps build-time values when the action fails", async () => {
    mockGetEventLive.mockResolvedValue({ data: undefined, error: { code: "INTERNAL_SERVER_ERROR", message: "x" } });
    renderLocation();
    await waitFor(() => expect(mockGetEventLive).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Online" })).toHaveAttribute("href", BUILD_URL);
  });

  it("switches online -> in person to the venue link", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ isOnline: false, venue: VENUE }), error: undefined });
    renderLocation();
    const link = await screen.findByRole("link", { name: /caffe tommaseo/i });
    expect(link).toHaveAttribute("href", VENUE.url);
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it("switches in person -> online to the Online link", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ isOnline: true, venue: null }), error: undefined });
    renderLocation({ isOnline: false, meetingUrl: null, venue: VENUE });
    expect(screen.getByRole("link", { name: /caffe tommaseo/i })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Online" })).toHaveAttribute("href", "https://meet.jit.si/new");
    expect(screen.queryByText(/caffe tommaseo/i)).not.toBeInTheDocument();
  });

  it("renders plain text, not an href-less link, when the meeting url is cleared", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ meetingUrl: null }), error: undefined });
    const { container } = renderLocation();
    await waitFor(() => expect(screen.queryByRole("link", { name: "Online" })).not.toBeInTheDocument());
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(container.querySelector("a:not([href])")).toBeNull();
  });

  it("renders a venue without a url as plain text", async () => {
    mockGetEventLive.mockResolvedValue({ data: live({ isOnline: false, venue: { name: "Piazza", url: null } }), error: undefined });
    const { container } = renderLocation();
    expect(await screen.findByText("Piazza")).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders nothing when the event was deleted", async () => {
    mockGetEventLive.mockResolvedValue({ data: undefined, error: { code: "NOT_FOUND", message: "gone" } });
    const { container } = renderLocation();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
