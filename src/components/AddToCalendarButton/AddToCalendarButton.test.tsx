import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import AddToCalendarButton from "./AddToCalendarButton";

const ICS_HREF = "data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR";
const GOOGLE_URL = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Talk";
const MACOS_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddToCalendarButton", () => {
  it("renders a closed trigger with both calendar options in the DOM", () => {
    render(
      <AddToCalendarButton icsHref={ICS_HREF} icsFilename="test-event.ics" googleUrl={GOOGLE_URL} />
    );

    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
    // Dropdown keeps its panel in the DOM and hides it visually (opacity/
    // visibility), rather than unmounting — same pattern as the nav/account
    // menus — so the links are queryable before the first click.
    expect(screen.getByRole("link", { name: /google calendar/i })).toHaveAttribute(
      "href",
      GOOGLE_URL
    );
    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute(
      "href",
      ICS_HREF
    );
  });

  it("opens the dropdown on click, exposing aria-expanded for the trigger", () => {
    render(
      <AddToCalendarButton icsHref={ICS_HREF} icsFilename="test-event.ics" googleUrl={GOOGLE_URL} />
    );
    const trigger = screen.getByRole("button", { name: /add to calendar/i });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the Google Calendar link in a new tab, unlike the Apple/.ics one", () => {
    render(
      <AddToCalendarButton icsHref={ICS_HREF} icsFilename="test-event.ics" googleUrl={GOOGLE_URL} />
    );

    expect(screen.getByRole("link", { name: /google calendar/i })).toHaveAttribute(
      "target",
      "_blank"
    );
    expect(screen.getByRole("link", { name: /apple calendar/i })).not.toHaveAttribute("target");
  });

  it("gives the Apple/.ics link a real filename via download, so it isn't saved as a generic name", () => {
    render(
      <AddToCalendarButton icsHref={ICS_HREF} icsFilename="test-event.ics" googleUrl={GOOGLE_URL} />
    );

    expect(screen.getByRole("link", { name: /apple calendar/i })).toHaveAttribute(
      "download",
      "test-event.ics"
    );
  });

  it("drops download on real Safari, letting its native calendar handoff take over", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: MACOS_SAFARI_UA });

    render(
      <AddToCalendarButton icsHref={ICS_HREF} icsFilename="test-event.ics" googleUrl={GOOGLE_URL} />
    );

    expect(screen.getByRole("link", { name: /apple calendar/i })).not.toHaveAttribute("download");
  });
});
