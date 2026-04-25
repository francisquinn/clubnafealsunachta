import { useState, type JSX } from "react";
import UpcomingEvent from "../components/UpcomingEvent";
import { isEventExpired } from "../utils/script";
import EventCard from "../layouts/EventCard";
import { formatBlogDate } from "../utils/script";
import Selector from "./Selector/Selector";
import type { EventCollection } from "../types/types";

export default function EventList(props: EventListProps) {
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  const [selectedCity, setSelectedCity] = useState<string>("Trieste");

  const filteredEvents = props.events.filter(
    (event) => event.data.city === selectedCity
  );
  const upcomingEvents = filteredEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = filteredEvents.filter((event) =>
    isEventExpired(event.data)
  );
  const currentEvent = upcomingEvents[0]?.data;

  const cities = [...new Set(props.events.map((e) => e.data.city).filter(Boolean))] as string[];

  function renderCitySelector(): JSX.Element {
    return (
      <Selector
        options={cities}
        value={selectedCity}
        onChange={setSelectedCity}
      />
    );
  }

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
    if (showUpcoming) {
      return <div className="cnf-events--grid">
        {currentEvent ? <UpcomingEvent event={currentEvent} /> : <p>No upcoming events at the moment. Stay tuned for further updates!</p>}
      </div>;
    }
    return <div className="cnf-events--grid">
      {pastEvents.length > 0 ? renderPastEvents() : <p>No past events in {selectedCity}.</p>}
    </div>;
  }

  function renderPastEvents() {
    return pastEvents.map(
      (event: EventCollection, index: number) =>
        <EventCard
          event={event.data}
          key={index}
          dateFormatter={formatBlogDate}
        />
    );
  }

  return (
    <>
      {renderCitySelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
};