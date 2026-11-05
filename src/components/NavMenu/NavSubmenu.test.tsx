import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import NavSubmenu from "./NavSubmenu";

// Dropdown-on-desktop / accordion-on-mobile layout lives in nav.css, which
// jsdom doesn't load. These cover the behaviour and the hooks the CSS relies
// on: aria-expanded on the trigger and the panel it controls.
describe("NavSubmenu", () => {
  function renderSubmenu(active = false) {
    render(
      <NavSubmenu label="Our club" active={active}>
        <a href="/about/">About</a>
        <a href="/values/">Values</a>
      </NavSubmenu>
    );
    return screen.getByRole("button", { name: "Our club" });
  }

  it("starts collapsed, with its links in the panel the trigger controls", () => {
    const trigger = renderSubmenu();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    expect(panel).toHaveClass("cnf-dropdown__panel");
    expect(panel).toContainElement(screen.getByRole("link", { name: "About" }));
    expect(panel).toContainElement(screen.getByRole("link", { name: "Values" }));
  });

  it("opens and closes when the trigger is clicked", () => {
    const trigger = renderSubmenu();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and when a link is chosen", () => {
    const trigger = renderSubmenu();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("link", { name: "Values" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the trigger as current only when told a page inside is", () => {
    expect(renderSubmenu(false)).not.toHaveClass("tab-active");
  });

  it("marks the trigger as current when a page inside is", () => {
    expect(renderSubmenu(true)).toHaveClass("tab-active");
  });

  it("opens when expandWhen turns true, and leaves closing to the user", () => {
    const links = (
      <>
        <a href="/about/">About</a>
      </>
    );
    const { rerender } = render(<NavSubmenu label="Our club" expandWhen={false}>{links}</NavSubmenu>);
    const trigger = screen.getByRole("button", { name: "Our club" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    rerender(<NavSubmenu label="Our club" expandWhen={true}>{links}</NavSubmenu>);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
