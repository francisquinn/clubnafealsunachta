import { useEffect, useState } from "react";
import { isEventExpired } from "../utils/script";
import { type Event } from "../types/types";
import "../styles/event.css";
import EventCard from "../layouts/EventCard";

export default function UpcomingEvent(props: UpcomingEventProps) {
  const [event, setEvent] = useState<Event | null | undefined>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEvent(props.event);
    setLoading(false);
  }, [])

  const isExpired = (): boolean => {
    return isEventExpired(event ?? null);
  };

  function renderLoading() {
    return loading && <p>Loading...</p>;
  }

  function renderExpiry() {
    return (
      (!event || isExpired()) && (
        <p
          style={{
            margin: 0
          }}
        >
          No upcoming events at the moment. Stay tuned for further updates!
        </p>
      )
    );
  }

  function renderEvent() {
    return (
      event &&
      !isExpired() && <EventCard event={event} responsive={props.responsive} />
    );
  }

  return (
    <>
      {renderLoading()}
      {renderExpiry()}
      {renderEvent()}
    </>
  );
}

type UpcomingEventProps = {
  event?: Event;
  responsive?: boolean;
};
