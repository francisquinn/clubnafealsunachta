import { useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import { formatBlogDate } from "../../utils/script";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";
import { DEFAULT_CLUB_TIMEZONE } from "../../lib/clubDefaults";

export default function EventList(props: EventListProps) {
  const cityNames = [...new Set(
    props.events.map((e) => e.data.location?.name).filter(Boolean) as string[]
  )];
  const locationNames = props.events.some((e) => e.data.isOnline)
    ? [...cityNames, "Online"]
    : cityNames;
  
  // Extract all unique tags from events
  const allTags = [...new Set(
    props.events.flatMap((e) => e.data.tags ?? []).filter(Boolean) as string[]
  )].sort();
  const tagOptions = ["All", ...allTags];
  
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  const nextUpcoming = props.events
    .filter((e) => !isEventExpired(e.data))
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime())[0];
  const defaultLocation = nextUpcoming?.data.isOnline
    ? "Online"
    : (nextUpcoming?.data.location?.name ?? locationNames[0] ?? "");
  const [selectedLocation, setSelectedLocation] = useState<string>(defaultLocation);
  const [selectedTag, setSelectedTag] = useState<string>("All");

  const onlineEvents = props.events.filter((e) => e.data.isOnline);
  const locationEvents = selectedLocation === "Online"
    ? onlineEvents
    : props.events.filter((e) => e.data.location?.name === selectedLocation);

  const tagFilteredEvents = selectedTag === "All"
    ? locationEvents
    : locationEvents.filter((e) => (e.data.tags ?? []).includes(selectedTag));

  const upcomingEvents = tagFilteredEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = tagFilteredEvents
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

  function renderTagSelector(): JSX.Element {
    if (allTags.length === 0) return null;
    return (
      <Selector
        label="Filter by tag"
        options={tagOptions}
        value={selectedTag}
        onChange={setSelectedTag}
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
          ? upcomingEvents.map((event) => <UpcomingEvent events={[event.data]} clubSlug={props.clubSlug} key={event.data.slug} />)
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
          dateFormatter={(date) => formatBlogDate(date, DEFAULT_CLUB_TIMEZONE)}
          showEndTime={false}
          clubSlug={props.clubSlug}
        />
    );
  }

  return (
    <>
      {renderLocationSelector()}
      {allTags.length > 0 && renderTagSelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
  clubSlug?: string;
};
