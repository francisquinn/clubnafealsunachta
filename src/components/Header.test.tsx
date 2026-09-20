import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";

describe("Header scroll behavior", () => {
  let header: HTMLElement;
  let hero: HTMLElement;
  let initHeaderScroll: () => () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <header class="cnf-header">
        <nav class="cnf-nav">
          <div class="cnf-nav__brand">
            <a class="cnf-nav__link" href="/">
              <img class="cnf-nav__link--svg" src="/cnf-logo.svg" />
            </a>
          </div>
        </nav>
      </header>
      <main class="content">
        <section id="hero" style="height: 800px;">Hero content</section>
        <section style="height: 2000px;">Page content</section>
      </main>
    `;

    header = document.querySelector(".cnf-header") as HTMLElement;
    hero = document.getElementById("hero") as HTMLElement;

    // Import the header scroll script
    const mod = await import("./HeaderScroll.js");
    initHeaderScroll = mod.initHeaderScroll as () => () => void;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("header has fixed positioning class", () => {
    expect(header.classList.contains("cnf-header")).toBe(true);
  });

  it("header is transparent initially when at top of page", () => {
    initHeaderScroll();
    expect(header).not.toHaveClass("cnf-header--scrolled");
  });

  it("header gets scrolled class when scrolled past hero", () => {
    initHeaderScroll();

    // Simulate scrolling past hero by directly setting scrollY and calling update
    Object.defineProperty(window, "scrollY", { value: hero.offsetHeight + 10, writable: true });

    // Fire scroll event
    window.dispatchEvent(new Event("scroll"));

    // Run timers to process requestAnimationFrame
    vi.runAllTimers();

    expect(header).toHaveClass("cnf-header--scrolled");
  });

  it("header loses scrolled class when scrolled back to top", () => {
    initHeaderScroll();

    // Scroll past hero
    Object.defineProperty(window, "scrollY", { value: hero.offsetHeight + 10, writable: true });
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();
    expect(header).toHaveClass("cnf-header--scrolled");

    // Scroll back to top
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();

    expect(header).not.toHaveClass("cnf-header--scrolled");
  });

  it("header gets scrolled class when scrolled past a threshold if no hero", () => {
    // Remove hero
    hero.remove();

    initHeaderScroll();

    // Scroll past threshold (100px)
    Object.defineProperty(window, "scrollY", { value: 150, writable: true });
    window.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();

    expect(header).toHaveClass("cnf-header--scrolled");
  });
});