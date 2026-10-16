import "../styles/event.css";
import EventCard from "../layouts/EventCard";
import type { Event } from "../types/types";
import { isEventExpired } from "../utils/script";
import { useGoingCounts } from "../lib/useGoingCounts";

export default function UpcomingEvent(props: UpcomingEventProps) {
  // #97: "not yet ended" (isEventExpired is keyed off endDate), not "not yet
  // started" — a currently live event stays featured here, badge and all,
  // instead of dropping off the homepage the moment it begins.
  const nextEvent = props.events
    ?.filter((e) => !isEventExpired(e))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  // On the home page this island fetches its own live count; inside
  // EventList the list fetches once for all its cards and passes goingCounts
  // (null until that resolves, which still means "don't fetch here").
  const parentFetches = props.goingCounts !== undefined;
  const fetchedCounts = useGoingCounts(parentFetches || !nextEvent ? [] : [nextEvent.slug]);
  const goingCounts = parentFetches ? props.goingCounts : fetchedCounts;

  if (!nextEvent) {
    return (
      <p className="cnf-event__empty">
        No upcoming events at the moment. Stay tuned for further updates!
      </p>
    );
  }

  return (
    <EventCard
      event={nextEvent}
      responsive={props.responsive}
      clubSlug={props.clubSlug}
      goingCount={goingCounts?.[nextEvent.slug]}
    />
  );
}

type UpcomingEventProps = {
  events?: Event[];
  responsive?: boolean;
  clubSlug?: string;
  goingCounts?: Record<string, number> | null;
};
