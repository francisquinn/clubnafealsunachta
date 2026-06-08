import "../styles/event.css";
import EventCard from "../layouts/EventCard";
import type { Event } from "../types/types";

export default function UpcomingEvent(props: UpcomingEventProps) {
  if (!props.event) {
    return (
      <p className="cnf-event__empty">
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
