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
    </div>
  );
}
