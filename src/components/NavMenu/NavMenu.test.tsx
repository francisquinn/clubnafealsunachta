import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import NavMenu from "./NavMenu";
import { DEFAULT_CLUB_SLUG } from "../../lib/clubDefaults";

// Layout and animation (full-screen overlay on mobile, inline row on desktop,
// staggered fade, underline for the current page) live in global.css, which
// jsdom doesn't load — these tests cover the behaviour and the hooks the CSS
// relies on: aria-expanded on the toggle, the collapsible panel class, and
// tab-active on the current page's link.
describe("NavMenu", () => {
  let overlayMatches = true;
  const originalMatchMedia = window.matchMedia;

  // jsdom has no matchMedia; NavMenu uses it to tell the mobile overlay from
  // the desktop row.
  beforeEach(() => {
    overlayMatches = true;
    window.matchMedia = ((query: string) => ({
      matches: overlayMatches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function getToggle() {
    return screen.getByRole("button", { name: "Menu" });
  }

  it("renders the hamburger toggle with three bars", () => {
    render(<NavMenu pathname="/" />);

    const toggle = getToggle();
    expect(toggle).toHaveClass("cnf-nav__toggle");
    expect(toggle.querySelectorAll(".cnf-nav__toggle-bar")).toHaveLength(3);
  });

  it("wires the toggle to the collapsible panel it controls", () => {
    render(<NavMenu pathname="/" />);

    const panel = document.getElementById(getToggle().getAttribute("aria-controls")!);
    expect(panel).toHaveClass("cnf-dropdown__panel", "cnf-dropdown__panel--collapsible");
  });

  it("opens and closes when the toggle is clicked", () => {
    render(<NavMenu pathname="/" />);

    const toggle = getToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape", () => {
    render(<NavMenu pathname="/" />);

    fireEvent.click(getToggle());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(getToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when clicking outside, e.g. on the account avatar", () => {
    render(<NavMenu pathname="/" />);

    fireEvent.click(getToggle());
    fireEvent.click(document.body);

    expect(getToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open when clicking inside the panel, away from a link", () => {
    render(<NavMenu pathname="/" />);

    fireEvent.click(getToggle());
    fireEvent.click(document.getElementById(getToggle().getAttribute("aria-controls")!)!);

    expect(getToggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes when a link is chosen", () => {
    render(<NavMenu pathname="/" />);

    fireEvent.click(getToggle());
    fireEvent.click(screen.getByRole("link", { name: "Blog" }));

    expect(getToggle()).toHaveAttribute("aria-expanded", "false");
  });

  describe("page behind the mobile overlay", () => {
    function renderInPage() {
      const header = document.createElement("header");
      const main = document.createElement("main");
      document.body.append(header, main);
      render(<NavMenu pathname="/" />, { container: header });
      return { header, main };
    }

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("makes everything outside the header inert while open, so Tab can't reach hidden links", () => {
      const { header, main } = renderInPage();

      fireEvent.click(getToggle());

      expect(main.inert).toBe(true);
      expect(header.inert).toBe(false);
    });

    it("restores the page when the overlay closes", () => {
      const { main } = renderInPage();

      fireEvent.click(getToggle());
      fireEvent.keyDown(document, { key: "Escape" });

      expect(main.inert).toBe(false);
    });

    it("leaves the page alone on desktop, where the menu is an inline row", () => {
      overlayMatches = false;
      const { main } = renderInPage();

      fireEvent.click(getToggle());

      expect(main.inert).toBe(false);
    });
  });

  it("lists the five site sections", () => {
    render(<NavMenu pathname="/" />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "About",
      "Values",
      "Events",
      "Blog",
      "Library",
    ]);
  });

  it.each([
    ["/about/", "About"],
    ["/values/", "Values"],
    [`/${DEFAULT_CLUB_SLUG}/events/`, "Events"],
    ["/blog/", "Blog"],
    ["/posts/some-post", "Blog"],
    ["/library/", "Library"],
  ])("marks only the current page's link as active on %s", (pathname, activeLink) => {
    render(<NavMenu pathname={pathname} />);

    const active = screen.getAllByRole("link").filter((link) => link.classList.contains("tab-active"));
    expect(active.map((link) => link.textContent)).toEqual([activeLink]);
  });

  it("marks nothing as active on the home page", () => {
    render(<NavMenu pathname="/" />);

    expect(document.querySelector(".tab-active")).toBeNull();
  });

  it("points Events at the current club while on one of its events pages", () => {
    render(<NavMenu pathname="/some-club/events/123" />);

    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/some-club/events/");
  });

  it("falls back to the default club's events elsewhere", () => {
    render(<NavMenu pathname="/profile/eventsguy" />);

    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", `/${DEFAULT_CLUB_SLUG}/events/`);
  });
});
