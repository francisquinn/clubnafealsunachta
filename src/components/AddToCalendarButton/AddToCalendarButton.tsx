import { useEffect, useRef, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";
import { isSafariBrowser } from "../../lib/browser";

interface AddToCalendarButtonProps {
  icsHref: string;
  icsFilename: string;
  googleUrl: string;
}

// Both hrefs are computed build-time from the same event data the page
// already renders (see [eventSlug].astro) — this component only owns the
// open/close interaction, via the same Dropdown used by the nav/account
// menus, not the calendar logic itself.
export default function AddToCalendarButton({
  icsHref,
  icsFilename,
  googleUrl,
}: AddToCalendarButtonProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Server-rendered (and no-JS) markup keeps `download` — the safe default,
  // since that's what every non-Safari browser needs for a clean filename
  // (confirmed live 2026-09-04: without it, Chrome saves a generic
  // "download.ics"). Real Safari is detected after hydration and drops
  // `download` so its native text/calendar handoff can take over instead of
  // forcing a save — see isSafariBrowser for why Chrome/Firefox-on-iOS
  // (WebKit-based, but not Safari.app) are excluded from that.
  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(isSafariBrowser(navigator.userAgent));
  }, []);

  return (
    <div className="cnf-event-page__calendar-menu">
      <button
        type="button"
        ref={toggleRef}
        className="cnf-button cnf-button__secondary cnf-event-page__calendar-link"
      >
        <img src="/calendar.svg" alt="" />
        <span className="cnf-button__text">Add to calendar</span>
      </button>
      <Dropdown label="Add to calendar" triggerRef={toggleRef}>
        <a className="cnf-nav__link" href={googleUrl} target="_blank" rel="noopener">
          Google Calendar
        </a>
        <a
          className="cnf-nav__link"
          href={icsHref}
          {...(isSafari ? {} : { download: icsFilename })}
        >
          Apple Calendar
        </a>
      </Dropdown>
      {/* Both links above are real, server-rendered anchors, but Dropdown only
          ever shows its panel once `aria-expanded` flips inside a `useEffect`
          — with no JS that never happens, so the panel (and the links inside
          it) stays hidden forever (#73). `<noscript>` content is only parsed
          when scripting is unavailable, so this forces the panel permanently
          open in that case: the toggle interaction is lost, but the links
          become reachable again, matching pre-#66 zero-JS behavior. */}
      <noscript>
        <style>{`
          .cnf-event-page__calendar-menu .cnf-dropdown__panel {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: none;
          }
        `}</style>
      </noscript>
    </div>
  );
}
