import { isEventExpired } from "../utils/script";
import { type Event } from "../types/types";
import "../styles/event.css";
import EventCard from "../layouts/EventCard";

export default function UpcomingEvent(props: UpcomingEventProps) {
  const isExpired = isEventExpired(props.event ?? null);

  if (!props.event || isExpired) {
    return (
      <p style={{ margin: 0 }}>
        No upcoming events at the moment. Stay tuned for further updates!
      </p>
    );
  }

  return <EventCard event={props.event} responsive={props.responsive} />;
}

type UpcomingEventProps = {
  event?: Event;
  responsive?: boolean;
};
