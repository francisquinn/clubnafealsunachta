import type { Event } from "../types/types";
import { formatEventDate, getEventLiveState } from "../utils/script";
import { DEFAULT_CLUB_SLUG } from "../lib/clubDefaults";
import LiveBadge from "../components/LiveBadge/LiveBadge";

export default function EventCard({
  event,
  dateFormatter = formatEventDate,
  responsive = false,
  clubSlug,
}: EventCardProps) {
  // #39: events are routed under /[clubSlug]/events/[eventSlug]. A caller
  // rendering within a club-scoped page (e.g. /trieste/events) passes its
  // own clubSlug so a cross-chapter event (event.location === null) still
  // links correctly; outside that context it falls back to the event's own
  // club, defaulting to the one club that exists today.
  const href = `/${clubSlug ?? event.location?.slug ?? DEFAULT_CLUB_SLUG}/events/${event.slug}`;
  const isLive = getEventLiveState(event) === "live";

  return (
    <div className={`cnf-event ${responsive ? 'cnf-event--responsive' : ''}`}>
      <div className="cnf-event__poster">
        <a className="cnf-event__link" href={href}>
          <h3>{event.name}</h3>
        </a>
      </div>
      <div className="cnf-event__info">
        <div>
          {isLive && (
            <div className="cnf-event__live">
              <LiveBadge />
            </div>
          )}
          <ul>
            <li className="cnf-event__date">
              {dateFormatter(new Date(event.date))}
            </li>
            {event.location && <li className="cnf-event__details">{event.location.name}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

type EventCardProps = {
  event: Event;
  dateFormatter?: (date: Date) => string;
  responsive?: boolean;
  clubSlug?: string;
};
