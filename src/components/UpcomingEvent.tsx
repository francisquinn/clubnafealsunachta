import "../styles/event.css";
import EventCard from "../layouts/EventCard";
import type { Event } from "../types/types";
import { isEventExpired } from "../utils/script";

export default function UpcomingEvent(props: UpcomingEventProps) {
  // #97: "not yet ended" (isEventExpired is keyed off endDate), not "not yet
  // started" — a currently live event stays featured here, badge and all,
  // instead of dropping off the homepage the moment it begins.
  const nextEvent = props.events
    ?.filter((e) => !isEventExpired(e))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (!nextEvent) {
    return (
      <p className="cnf-event__empty">
        No upcoming events at the moment. Stay tuned for further updates!
      </p>
    );
  }

  return <EventCard event={nextEvent} responsive={props.responsive} clubSlug={props.clubSlug} />;
}

type UpcomingEventProps = {
  events?: Event[];
  responsive?: boolean;
  clubSlug?: string;
};
