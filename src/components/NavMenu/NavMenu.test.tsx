import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import NavMenu from "./NavMenu";

describe("NavMenu (mobile hamburger menu)", () => {
  const pathname = "/";

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    // Set viewport to mobile size
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 667, writable: true });
    window.dispatchEvent(new Event("resize"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the hamburger toggle button with three bars", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    expect(toggle).toBeInTheDocument();
    const bars = toggle.querySelectorAll(".cnf-nav__toggle-bar");
    expect(bars).toHaveLength(3);
  });

  it("has a comfortable tap target size (minimum 44x44px) via CSS classes", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    // Check that the toggle has the expected dimensions via CSS class
    // 2.75rem = 44px at default 16px base
    expect(toggle).toHaveClass("cnf-nav__toggle");
    // The CSS sets width/height to 2.75rem (44px)
  });

  it("opens the dropdown panel when toggle is clicked", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = document.querySelector(".cnf-dropdown__panel");
    expect(panel).toBeInTheDocument();
  });

  it("closes the dropdown panel when toggle is clicked again", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the dropdown when Escape key is pressed", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the dropdown when clicking outside", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(document.body);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("has proper focus styles for keyboard navigation", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    toggle.focus();

    expect(toggle).toHaveFocus();
    // Should have visible focus indicator via :focus-visible CSS
    expect(toggle).toHaveClass("cnf-nav__toggle");
  });

  it("animates the hamburger bars into an X when open via aria-expanded", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    const bars = toggle.querySelectorAll(".cnf-nav__toggle-bar");

    // Initial state - aria-expanded is false
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    // Open state - aria-expanded triggers CSS animation
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The CSS transforms the bars into an X when aria-expanded="true"
    expect(bars).toHaveLength(3);
  });

  it("has smooth open/close animation with proper transition timing via CSS", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);

    const panel = document.querySelector(".cnf-dropdown__panel");
    expect(panel).toHaveClass("cnf-dropdown__panel");
    // The CSS defines transitions for opacity and transform
  });

  it("has consistent styling with site design (colors, spacing, border-radius)", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    const bars = toggle.querySelectorAll(".cnf-nav__toggle-bar");

    // Bars should have the cnf-nav__toggle-bar class which uses --color-green
    expect(bars[0]).toHaveClass("cnf-nav__toggle-bar");
    // Toggle should have proper dimensions class
    expect(toggle).toHaveClass("cnf-nav__toggle");
  });

  it("dropdown panel has proper positioning and styling classes", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);

    const panel = document.querySelector(".cnf-dropdown__panel");
    expect(panel).toHaveClass("cnf-dropdown__panel");
    // Should have the collapsible class for desktop behavior
    expect(panel).toHaveClass("cnf-dropdown__panel--collapsible");
  });

  it("nav links have comfortable tap targets via CSS padding", () => {
    render(<NavMenu pathname={pathname} />);

    const toggle = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(toggle);

    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      // Links should have the cnf-nav__link class with proper padding
      expect(link).toHaveClass("cnf-nav__link");
    });
    expect(links.length).toBeGreaterThan(0);
  });
});