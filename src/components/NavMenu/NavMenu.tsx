import { useRef } from "react";
import Dropdown from "../Dropdown/Dropdown";
import { DEFAULT_CLUB_SLUG } from "../../lib/clubDefaults";

interface NavMenuProps {
  pathname: string;
}

// #39: matches /[clubSlug]/events or /[clubSlug]/events/... — the `(\/|$)`
// requires "events" to be a whole path segment, not just a prefix, so it
// doesn't false-positive on e.g. a user-generated /profile/eventsguy.
const CLUB_EVENTS_PATH = /^\/([^/]+)\/events(\/|$)/;

export default function NavMenu({ pathname }: NavMenuProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Only the events pages are club-prefixed (About/Blog stay global), so
  // "current club" only means anything while already on one; elsewhere
  // (home, blog, about, profile) there's no club in the URL to read, so the
  // Events link falls back to the one club that exists today.
  const currentClubSlug = pathname.match(CLUB_EVENTS_PATH)?.[1] ?? DEFAULT_CLUB_SLUG;

  return (
    <div className="cnf-nav__group">
      <button type="button" ref={toggleRef} className="cnf-nav__toggle">
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
      </button>
      <Dropdown label="Menu" triggerRef={toggleRef} collapsesOnDesktop>
        <a
          className={`cnf-nav__link ${pathname.startsWith("/about") ? "tab-active" : ""}`}
          href="/about/"
        >
          About
        </a>
        <a
          className={`cnf-nav__link ${CLUB_EVENTS_PATH.test(pathname) ? "tab-active" : ""}`}
          href={`/${currentClubSlug}/events/`}
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
          className={`cnf-nav__link ${pathname.startsWith("/reading") ? "tab-active" : ""}`}
          href="/reading/"
        >
          Reading
        </a>
      </Dropdown>
    </div>
  );
}
