import "../styles/event.css";
import EventCard from "../layouts/EventCard";
import type { Event } from "../types/types";

export default function UpcomingEvent(props: UpcomingEventProps) {
  const nextEvent = props.events
    ?.filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (!nextEvent) {
    return (
      <p className="cnf-event__empty">
        No upcoming events at the moment. Stay tuned for further updates!
      </p>
    );
  }

  return <EventCard event={nextEvent} responsive={props.responsive} />;
}

type UpcomingEventProps = {
  events?: Event[];
  responsive?: boolean;
};
