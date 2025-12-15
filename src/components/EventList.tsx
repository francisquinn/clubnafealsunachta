import { useState, type JSX } from "react";
import UpcomingEvent from "../components/UpcomingEvent";
import { fetchEventGistJson, isEventExpired } from "../utils/script";
import EventCard from "../layouts/EventCard";
import { formatBlogDate } from "../utils/script";
const events = await fetchEventGistJson();

export default function EventList() {
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
      {showUpcoming ? <UpcomingEvent /> : renderPastEvents()}
    </div>;
  }

  function renderPastEvents() {
    return events.map(
      (event, index) =>
        isEventExpired(event) && (
          <EventCard
            event={event}
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
