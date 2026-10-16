import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SubscribeCalendarLinks from "./SubscribeCalendarLinks";

const FEED_URL = "https://clubnafealsunachta.com/trieste/events.ics";

describe("SubscribeCalendarLinks", () => {
  it("names the chapter whose feed it offers", () => {
    render(<SubscribeCalendarLinks feedUrl={FEED_URL} chapterName="Trieste" />);
    expect(screen.getByText(/subscribe to the Trieste events calendar/i)).toBeInTheDocument();
  });

  it("links Apple Calendar to the feed over webcal://", () => {
    render(<SubscribeCalendarLinks feedUrl={FEED_URL} chapterName="Trieste" />);
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute(
      "href",
      "webcal://clubnafealsunachta.com/trieste/events.ics"
    );
  });

  it("links Google Calendar to its add-by-URL screen with the webcal feed as cid", () => {
    render(<SubscribeCalendarLinks feedUrl={FEED_URL} chapterName="Trieste" />);
    const href = screen.getByRole("link", { name: /google calendar/i }).getAttribute("href")!;
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("cid")).toBe("webcal://clubnafealsunachta.com/trieste/events.ics");
    // The feed URL sits inside Google's URL, so it must be percent-encoded.
    expect(href).toBe(
      "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fclubnafealsunachta.com%2Ftrieste%2Fevents.ics"
    );
  });

  it("turns an http:// feed URL into webcal:// too", () => {
    render(<SubscribeCalendarLinks feedUrl="http://localhost:4321/trieste/events.ics" chapterName="Trieste" />);
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute(
      "href",
      "webcal://localhost:4321/trieste/events.ics"
    );
  });
});
