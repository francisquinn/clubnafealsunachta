import { useEffect, useState, type JSX } from "react";
import UpcomingEvent from "../UpcomingEvent";
import { isEventExpired } from "../../utils/script";
import EventCard from "../../layouts/EventCard";
import { formatBlogDate } from "../../utils/script";
import Selector from "../Selector/Selector";
import type { EventCollection } from "../../types/types";
import { DEFAULT_CHAPTER_TIMEZONE } from "../../lib/chapterDefaults";

// #185: the chosen tab lives in the URL, so going back from an event's page
// returns to the same tab instead of resetting to Upcoming.
const PAST_HASH = "#past";

export default function EventList(props: EventListProps) {
  const [showUpcoming, setShowUpcoming] = useState<boolean>(true);

  // The page is prerendered, so the hash can only be read once it's mounted.
  useEffect(() => {
    setShowUpcoming(window.location.hash !== PAST_HASH);
  }, []);

  function selectTab(upcoming: boolean) {
    setShowUpcoming(upcoming);
    // replaceState, not a #hash link: switching tabs shouldn't add a history
    // entry, or back would step through tabs instead of leaving the page.
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", pathname + search + (upcoming ? "" : PAST_HASH));
  }

  // #177: each [chapterSlug]/events page already holds just that chapter's
  // events (Online included, now that it's a chapter), so there's nothing
  // to filter here — the picker switches chapter by going to its page.
  const currentChapter = props.chapters.find((chapter) => chapter.slug === props.chapterSlug);
  const locationEvents = props.events;

  const upcomingEvents = locationEvents.filter(
    (event) => !isEventExpired(event.data)
  );
  const pastEvents = locationEvents
    .filter((event) => isEventExpired(event.data))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  function renderChapterSelector(): JSX.Element {
    return (
      <Selector
        label="Select a chapter"
        options={props.chapters.map((chapter) => ({ value: chapter.slug, label: chapter.name }))}
        value={currentChapter?.slug ?? ""}
        onChange={(slug) => {
          if (slug !== props.chapterSlug) {
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
            onClick={() => selectTab(true)}
          >
            Upcoming
          </a>
          <a
            className={`cnf-events__tab ${!showUpcoming ? "tab-active" : ""}`}
            onClick={() => selectTab(false)}
          >
            Past
          </a>
        </div>
      </>
    );
  }

  function renderEvents(): JSX.Element {
    if (showUpcoming) {
      return <div className="cnf-card-grid">
        {upcomingEvents.length > 0
          ? upcomingEvents.map((event) => <UpcomingEvent events={[event.data]} key={event.data.slug} />)
          : <p>No upcoming events at the moment. Stay tuned for further updates!</p>}
      </div>;
    }
    return <div className="cnf-card-grid">
      {pastEvents.length > 0 ? renderPastEvents() : <p>No past events in {currentChapter?.name ?? "this chapter"}.</p>}
    </div>;
  }

  function renderPastEvents() {
    return pastEvents.map(
      (event: EventCollection) =>
        <EventCard
          event={event.data}
          key={event.data.slug}
          dateFormatter={(date) => formatBlogDate(date, DEFAULT_CHAPTER_TIMEZONE)}
        />
    );
  }

  return (
    <>
      {renderChapterSelector()}
      {renderNavigation()}
      {renderEvents()}
    </>
  );
}

type EventListProps = {
  events: EventCollection[];
  chapterSlug: string;
  chapters: { name: string; slug: string }[];
};
