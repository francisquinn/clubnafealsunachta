import { useState, type JSX } from "react";
import UpcomingEvent from "../components/UpcomingEvent";
import { isEventExpired } from "../utils/script";
import EventCard from "../layouts/EventCard";
import { formatBlogDate } from "../utils/script";
import type { Event, EventCollection } from "../types/types";

export default function EventList(props: EventListProps) {
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);

  function renderNavigation(): JSX.Element {
    return (
      <>
        <div className="cnf-events__tabs">
          <a
            className={`cnf-events__tab ${showUpcoming ? "tab-active" : ""}`}
            onClick={() => setShowUpcoming(true)}
          >
            Upcoming
          </a>
          <a
            className={`cnf-events__tab ${!showUpcoming ? "tab-active" : ""}`}
            onClick={() => setShowUpcoming(false)}
          >
            Past
          </a>
        </div>
      </>
    );
  }

  function renderEvents(): JSX.Element {
    return <div className="cnf-events--grid">
      {showUpcoming ? <UpcomingEvent event={props.currentEvent} /> : renderPastEvents()}
    </div>;
  }

  function renderPastEvents() {
    return props.events.map(
      (event: EventCollection, index: number) =>
        isEventExpired(event.data) && (
          <EventCard
            event={event.data}
            key={index}
            dateFormatter={formatBlogDate}
          />
        )
    );
  }

  return (
    <>
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
  currentEvent: Event;
};
