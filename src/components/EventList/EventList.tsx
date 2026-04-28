import { useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import { formatBlogDate } from "../../utils/script";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";
import { CITY } from "../../types/types";

export default function EventList(props: EventListProps) {
  const cities = [...new Set(props.events.map((e) => e.data.city).filter(Boolean))] as string[];

  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  const [selectedCity, setSelectedCity] = useState<string>(cities[0] ?? CITY.TRIESTE);

  const filteredEvents = props.events.filter(
    (event) => event.data.city === selectedCity
  );
  const upcomingEvents = filteredEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = filteredEvents
    .filter((event) => isEventExpired(event.data))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

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
        {upcomingEvents.length > 0
          ? upcomingEvents.map((event) => <UpcomingEvent event={event.data} key={event.data.slug} />)
          : <p>No upcoming events at the moment. Stay tuned for further updates!</p>}
      </div>;
    }
    return <div className="cnf-events--grid">
      {pastEvents.length > 0 ? renderPastEvents() : <p>No past events in {selectedCity}.</p>}
    </div>;
  }

  function renderPastEvents() {
    return pastEvents.map(
      (event: EventCollection) =>
        <EventCard
          event={event.data}
          key={event.data.slug}
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
