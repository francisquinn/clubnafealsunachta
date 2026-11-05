import { useLiveEvent } from "../../lib/useLiveEvent";

type Venue = { name: string | null; url: string | null } | null;

// #197: the details row's location — "Online" or the venue — following live
// data once loaded (build-time props before that and on transient failure).
// Handles an event flipping online <-> in person, a cleared meeting link
// (plain text, never an <a> without an href) and a deleted event (renders
// nothing). The date/time text beside it stays build-time.
export default function EventLocation({
  slug,
  isOnline,
  meetingUrl,
  venue,
}: {
  slug: string;
  isOnline: boolean;
  meetingUrl: string | null;
  venue: Venue;
}) {
  const { live, gone } = useLiveEvent(slug);
  if (gone) return null;

  const online = live ? live.isOnline : isOnline;
  const url = live ? live.meetingUrl : meetingUrl;
  const place = live ? live.venue : venue;

  if (online) {
    return url ? (
      <a href={url} className="cnf-event-page__details-link" target="_blank">
        Online
      </a>
    ) : (
      <span className="cnf-event-page__details-info">Online</span>
    );
  }
  if (place?.url) {
    return (
      <a href={place.url} className="cnf-event-page__details-link" target="_blank">
        <img src="/map-pin.svg" alt="" />
        {place.name}
      </a>
    );
  }
  if (place?.name) return <span className="cnf-event-page__details-info">{place.name}</span>;
  return null;
}
