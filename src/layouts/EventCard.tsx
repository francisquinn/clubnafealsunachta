import type { Event } from "../types/types";
import { formatEventDate } from "../utils/script";

export default function EventCard({
  event,
  dateFormatter = formatEventDate,
  responsive = false,
}: EventCardProps) {
  return (
    <div className={`cnf-event ${responsive && "cnf-event--responsive"}`}>
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
              <a href={event.map_url} target="_blank">
                {event.location}
              </a>
            </li>
          </ul>
        </div>
        <div className="cnf-event__social">
          <a href={event.links.instagram} target="_blank">
            <img className="cnf-event__social-svg" src="/instagram.svg" />
          </a>
          <a href={event.links.facebook} target="_blank">
            <img className="cnf-event__social-svg" src="/facebook.svg" />
          </a>
          {event.links.meetup && (
            <a href={event.links.meetup} target="_blank">
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
