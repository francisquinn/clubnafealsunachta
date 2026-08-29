import { useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired, formatBlogDate } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";

export default function EventList(props: EventListProps) {
  const cityNames = [...new Set(
    props.events.map((e) => e.data.location?.name).filter(Boolean) as string[]
  )];
  const locationNames = props.events.some((e) => e.data.isOnline)
    ? [...cityNames, "Online"]
    : cityNames;
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  const nextUpcoming = props.events
    .filter((e) => !isEventExpired(e.data))
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime())[0];
  const defaultLocation = nextUpcoming?.data.isOnline
    ? "Online"
    : (nextUpcoming?.data.location?.name ?? locationNames[0] ?? "");
  const [selectedLocation, setSelectedLocation] = useState<string>(defaultLocation);
  const [selectedFormat, setSelectedFormat] = useState<EventFormat>("All");

  // #52: the top-level "Online" entry is the cross-chapter view — every
  // online event in this list, regardless of which club organizes it (each
  // card shows its hosting club). A selected club instead narrows to that
  // club's own events — in-person (its venue's club) and hosted-online
  // (club_id) — with an in-person/online sub-filter over just those.
  const isClubSelected = selectedLocation !== "Online";
  const inSelectedClub = (event: EventCollection) =>
    event.data.club?.name === selectedLocation ||
    event.data.location?.name === selectedLocation;

  const locationEvents =
    selectedLocation === "Online"
      ? props.events.filter((e) => e.data.isOnline)
      : props.events.filter(
          (event) =>
            inSelectedClub(event) &&
            (selectedFormat === "All"
              ? true
              : selectedFormat === "Online"
                ? event.data.isOnline
                : !event.data.isOnline)
        );

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
        onChange={(value) => {
          setSelectedLocation(value);
          setSelectedFormat("All");
        }}
      />
    );
  }

  function renderFormatSelector(): JSX.Element {
    return (
      <Selector
        label="Format"
        options={FORMAT_OPTIONS}
        value={selectedFormat}
        onChange={(value) => setSelectedFormat(value as EventFormat)}
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
          dateFormatter={formatBlogDate}
          clubSlug={props.clubSlug}
        />
    );
  }

  return (
    <>
      {renderLocationSelector()}
      {isClubSelected && renderFormatSelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

// #52: per-club sub-filter shown once a specific club is selected — splits
// that club's events into in-person and online, distinct from the top-level
// cross-chapter "Online" entry.
type EventFormat = "All" | "In-person" | "Online";

const FORMAT_OPTIONS: EventFormat[] = ["All", "In-person", "Online"];

type EventListProps = {
  events: EventCollection[];
  clubSlug?: string;
};
