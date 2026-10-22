import { useCallback, useEffect, useRef, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";
import { DEFAULT_CHAPTER_SLUG } from "../../lib/chapterDefaults";

interface NavMenuProps {
  pathname: string;
  // For a page whose URL doesn't show its section, e.g. a chapter's own page
  // at /<chapter>/, which belongs under Chapters.
  activeNav?: "chapters";
}

// #39: matches /[chapterSlug]/events or /[chapterSlug]/events/... — the `(\/|$)`
// requires "events" to be a whole path segment, not just a prefix, so it
// doesn't false-positive on e.g. a user-generated /profile/eventsguy.
const CHAPTER_EVENTS_PATH = /^\/([^/]+)\/events(\/|$)/;

// Must match the max-width of the overlay's media query in nav.css.
const OVERLAY_QUERY = "(max-width: 575.98px)";

export default function NavMenu({ pathname, activeNav }: NavMenuProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Only the events pages are chapter-prefixed (About/Blog stay global), so
  // "current chapter" only means anything while already on one; elsewhere
  // (home, blog, about, profile) there's no chapter in the URL to read, so the
  // Events link falls back to the one chapter that exists today.
  const currentChapterSlug = pathname.match(CHAPTER_EVENTS_PATH)?.[1] ?? DEFAULT_CHAPTER_SLUG;
  const [isOpen, setIsOpen] = useState(false);
  const handleOpenChange = useCallback((open: boolean) => setIsOpen(open), []);

  // On mobile the open menu is a full-screen overlay covering the page, so
  // everything outside the header is made inert: Tab can't wander onto links
  // hidden underneath it. The header itself (logo, avatar, toggle, menu
  // links) stays reachable. Re-checked on resize, since the same open state
  // is just the inline row on desktop.
  useEffect(() => {
    const header = toggleRef.current?.closest("header");
    if (!isOpen || !header) return;

    const media = window.matchMedia(OVERLAY_QUERY);
    const others = [...document.body.children].filter((el): el is HTMLElement => el !== header && el instanceof HTMLElement);

    function apply() {
      others.forEach((el) => (el.inert = media.matches));
    }

    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      others.forEach((el) => (el.inert = false));
    };
  }, [isOpen]);

  return (
    <div className="cnf-nav__group">
      <button type="button" ref={toggleRef} className="cnf-nav__toggle">
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
      </button>
      <Dropdown label="Menu" triggerRef={toggleRef} collapsesOnDesktop onOpenChange={handleOpenChange}>
        <div className="cnf-nav__links">
          <a
            className={`cnf-nav__link ${pathname.startsWith("/about") ? "tab-active" : ""}`}
            href="/about/"
          >
            About
          </a>
          <a
            className={`cnf-nav__link ${pathname.startsWith("/values") ? "tab-active" : ""}`}
            href="/values/"
          >
            Values
          </a>
          <a
            className={`cnf-nav__link ${pathname.startsWith("/chapters") || activeNav === "chapters" ? "tab-active" : ""}`}
            href="/chapters/"
          >
            Chapters
          </a>
          <a
            className={`cnf-nav__link ${CHAPTER_EVENTS_PATH.test(pathname) ? "tab-active" : ""}`}
            href={`/${currentChapterSlug}/events/`}
          >
            Events
          </a>
          <a
            className={`cnf-nav__link ${pathname.startsWith("/blog") || pathname.startsWith("/post") ? "tab-active" : ""}`}
            href="/blog/"
          >
            Blog
          </a>
          <a
            className={`cnf-nav__link ${pathname.startsWith("/library") ? "tab-active" : ""}`}
            href="/library/"
          >
            Library
          </a>
        </div>
      </Dropdown>
    </div>
  );
}
