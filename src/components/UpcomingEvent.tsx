import { useEffect, useState } from "react";
import { getCurrentEvent, isEventExpired } from "../utils/script";
import { type Event } from "../types/types";
import "../styles/event.css";
import EventCard from "../layouts/EventCard";

export default function UpcomingEvent(props: UpcomingEventProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const currentEvent = await getCurrentEvent();
        setEvent(currentEvent);
        setLoading(false);
      } catch (error) {
        console.error(
          "whoops, an error occured when fetching the event :(",
          error
        );
      }
    };
    fetchEvent();
  }, []);

  const isExpired = (): boolean => {
    return isEventExpired(event);
  };

  function renderLoading() {
    return loading && <p>Loading...</p>;
  }

  function renderExpiry() {
    return (
      !event ||
      (isExpired() && (
        <p
          style={{
            marginBottom: 0,
          }}
        >
          No upcoming events at the moment. Stay tuned for further updates!
        </p>
      ))
    );
  }

  function renderEvent() {
    return event && !isExpired() && <EventCard event={event} responsive={props.responsive} />;
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
  responsive?: boolean;
}
