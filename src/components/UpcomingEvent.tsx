import "../styles/event.css";
import EventCard from "../layouts/EventCard";
import type { Event } from "../types/types";

export default function UpcomingEvent(props: UpcomingEventProps) {
  const currentEvent = props.events.find(
    (e) => new Date(e.date) > new Date()
  );

  if (!currentEvent) {
    return (
      <p style={{ margin: 0 }}>
        No upcoming events at the moment. Stay tuned for further updates!
      </p>
    );
  }

  return <EventCard event={currentEvent} responsive={props.responsive} />;
}

type UpcomingEventProps = {
  events: Event[];
  responsive?: boolean;
};
