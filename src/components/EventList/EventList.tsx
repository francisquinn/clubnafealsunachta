import { useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import { formatBlogDate } from "../../utils/script";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";
import { DEFAULT_CLUB_TIMEZONE } from "../../lib/clubDefaults";

export default function EventList(props: EventListProps) {
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);
  // #177: each [clubSlug]/events page already holds just that chapter's
  // events (Online included, now that it's a chapter), so there's nothing
  // to filter here — the picker switches chapter by going to its page.
  const currentClub = props.clubs.find((club) => club.slug === props.clubSlug);
  const locationEvents = props.events;

  const upcomingEvents = locationEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = locationEvents
    .filter((event) => isEventExpired(event.data))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  function renderClubSelector(): JSX.Element {
    return (
      <Selector
        label="Select a chapter"
        options={props.clubs.map((club) => ({ value: club.slug, label: club.name }))}
        value={currentClub?.slug ?? ""}
        onChange={(slug) => {
          if (slug !== props.clubSlug) {
            window.location.assign(`/${slug}/events/`);
          }
        }}
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
      {pastEvents.length > 0 ? renderPastEvents() : <p>No past events in {currentClub?.name ?? "this chapter"}.</p>}
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
      {renderClubSelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
  clubSlug: string;
  clubs: { name: string; slug: string }[];
};
