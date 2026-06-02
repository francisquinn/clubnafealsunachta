import { useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import { formatBlogDate } from "../../utils/script";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";

export default function EventList(props: EventListProps) {
  const locationNames = [...new Set(
    props.events.map((e) => e.data.location?.name).filter(Boolean) as string[]
  )];
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<string>(locationNames[0] ?? "");

  const onlineEvents = props.events.filter((e) => e.data.meetingUrl);
  const locationEvents = selectedLocation === "Online"
    ? onlineEvents
    : props.events.filter((e) => e.data.location?.name === selectedLocation);

  const upcomingEvents = locationEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = locationEvents
    .filter((event) => isEventExpired(event.data))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  function renderLocationSelector(): JSX.Element {
    return (
      <Selector
        options={locationNames}
        value={selectedLocation}
        onChange={setSelectedLocation}
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
          ? upcomingEvents.map((event) => <UpcomingEvent events={[event.data]} key={event.data.slug} />)
          : <p>No upcoming events at the moment. Stay tuned for further updates!</p>}
      </div>;
    }
    return <div className="cnf-events--grid">
      {pastEvents.length > 0 ? renderPastEvents() : <p>No past events in {selectedLocation}.</p>}
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
      {renderLocationSelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
};
