interface SubscribeCalendarLinksProps {
  feedUrl: string;
  // Named in the line, since each chapter has its own feed.
  chapterName: string;
}

// #80: a quiet line under the events list for subscribing to a chapter's whole
// feed (Meetup puts theirs at the bottom of the calendar too). Both links
// hand the calendar app a URL to keep re-fetching, not a one-off file. No
// state, so it renders from Astro with no client directive.
export default function SubscribeCalendarLinks({ feedUrl, chapterName }: SubscribeCalendarLinksProps) {
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  return (
    <p className="cnf-events__subscribe">
      {/* Font Awesome "rss" (solid), matching the site's other FA icons;
          green like the links, via the icon's own CSS color. */}
      <svg className="cnf-events__subscribe-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M0 64C0 46.3 14.3 32 32 32c229.8 0 416 186.2 416 416c0 17.7-14.3 32-32 32s-32-14.3-32-32C384 253.6 226.4 96 32 96C14.3 96 0 81.7 0 64zM0 416a64 64 0 1 1 128 0A64 64 0 1 1 0 416zM32 160c159.1 0 288 128.9 288 288c0 17.7-14.3 32-32 32s-32-14.3-32-32c0-123.7-100.3-224-224-224c-17.7 0-32-14.3-32-32s14.3-32 32-32z"
        />
      </svg>
      Subscribe to the {chapterName} events calendar:
      <br />
      <a href={googleUrl} target="_blank" rel="noopener">Google Calendar</a>
      {" · "}
      <a href={webcalUrl}>Apple Calendar</a>
    </p>
  );
}
