import type { Event } from "../types/types";
import { formatEventDate } from "../utils/script";

export default function EventCard({
  event,
  dateFormatter = formatEventDate,
  responsive = false,
}: EventCardProps) {
  return (
    <div className={`cnf-event ${responsive ? 'cnf-event--responsive' : ''}`}>
      <div className="cnf-event__poster">
        <a className="cnf-event__link" href={`/events/${event.slug}`}>
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
              {event.meetingUrl
                ? <a href={event.meetingUrl} target="_blank">Online</a>
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
};
