import { useEffect, useState } from "react";
import { formatEventDate, getCurrentEvent } from "../utils/script";
import { type EventData } from "../types/types";
import '../styles/event.css';

export default function Event() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setEvent(await getCurrentEvent());
        setLoading(false);
      } catch (error) {
        console.error('whoops, an error occured when fetching the event :(', error)
      }
    };
    fetchEvent();
  }, []);

  const isExpired = () => {
    return event ? new Date(event.date) < new Date() : true
  };

  function renderLoading() {
    return loading && <p>Loading...</p>;
  }

  function renderExpiry() {
    return !event || isExpired() && (
      <p>No upcoming events at the moment. Stay tuned for further updates!</p>
    )
  }

  function renderEvent() {
    return event && !isExpired() && (
      <div className="cnf-event">
        <div className="cnf-event__poster">
          <h3>{event.name}</h3>
        </div >
        <div className="cnf-event__info">
          <div>
            <ul>
              <li className="cnf-event__date">
                {formatEventDate(new Date(event.date))}
              </li>
              <li className="cnf-event__location">
                <a href={event.map_url} target="_blank">
                  {event.location}
                </a>
              </li>
            </ul>
          </div>
          <div className="cnf-event__social">
            <a
              href={event.links.instagram}
              className="cnf-event__social--link"
              target="_blank"
            >
              <img className="cnf-event__social--svg" src="/instagram.svg" />
            </a>
            <a
              href={event.links.facebook}
              className="cnf-event__social--link"
              target="_blank"
            >
              <img className="cnf-event__social--svg" src="/facebook.svg" />
            </a>
            {event.links.meetup && (
              <a
                href={event.links.meetup}
                className="cnf-event__social--link"
                target="_blank"
              >
                <img className="cnf-event__social--svg" src="/meetup.svg" />
              </a>
            )}
          </div>
        </div>
      </div >
    );
  }

  return (
    <section id="events">
      <h2>Upcoming event</h2>
      {renderLoading()}
      {renderExpiry()}
      {renderEvent()}
    </section>
  );
}