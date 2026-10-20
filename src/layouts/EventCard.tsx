import type { Event } from "../types/types";
import { formatEventDate, getEventLiveState } from "../utils/script";
import LiveBadge from "../components/LiveBadge/LiveBadge";

export default function EventCard({
  event,
  dateFormatter = formatEventDate,
  responsive = false,
}: EventCardProps) {
  const href = `/${event.location.slug}/events/${event.slug}`;
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
            <li className="cnf-event__details">{event.location.name}</li>
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
};
