import type { Event } from "../types/types";
import { formatEventDate } from "../utils/script";
import { DEFAULT_CLUB_SLUG } from "../lib/clubDefaults";

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

  return (
    <div className={`cnf-event ${responsive ? 'cnf-event--responsive' : ''}`}>
      <div className="cnf-event__poster">
        <a className="cnf-event__link" href={href}>
          <h3>{event.name}</h3>
        </a>
      </div>
      <div className="cnf-event__info">
        <div>
          <ul>
            <li className="cnf-event__date">
              {dateFormatter(new Date(event.date))}
            </li>
            <li className="cnf-event__location">
              {event.isOnline
                ? <a href={event.meetingUrl ?? undefined} target="_blank">Online</a>
                : event.venue?.url
                  ? <a href={event.venue.url} target="_blank">{event.venue.name}</a>
                  : event.venue?.name
                    ? <span>{event.venue.name}</span>
                    : null
              }
            </li>
          </ul>
        </div>
        <div className="cnf-event__social">
          {event.social.instagram && (
            <a href={event.social.instagram} target="_blank">
              <img className="cnf-event__social-svg" src="/instagram.svg" />
            </a>
          )}
          {event.social.facebook && (
            <a href={event.social.facebook} target="_blank">
              <img className="cnf-event__social-svg" src="/facebook.svg" />
            </a>
          )}
          {event.social.meetup && (
            <a href={event.social.meetup} target="_blank">
              <img className="cnf-event__social-svg" src="/meetup.svg" />
            </a>
          )}
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
