import { useEffect, useState } from "react";
import { useLiveEvent } from "../../lib/useLiveEvent";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from "../../lib/ics";
import { liveEventToIcsData } from "../../lib/liveEventIcs";
import { isPastDate } from "../../utils/script";
import JoinEventButton from "../JoinEventButton/JoinEventButton";
import AddToCalendarButton from "../AddToCalendarButton/AddToCalendarButton";

// #197: the event page is prerendered, so the Join online / Add to calendar
// buttons start from build-time props and are replaced by live data
// (getEventLive) once hydrated. Handles both directions: an event that ended
// since the build hides them, one extended/rescheduled into the future shows
// them even if the build thought it was over.
//
// Flash/shift choice: markup is server-rendered only when the event was
// still running at build (`visibleAtBuild`); an event already over at build
// renders nothing until live data says otherwise (a rare late appearance
// beats a flash of buttons on every past event). If the live call fails we
// keep the build-time values and still hide once the client clock passes
// the build-time end.
export default function EventLiveActions({
  slug,
  visibleAtBuild,
  endDate,
  isOnline,
  meetingUrl,
  icsHref,
  icsFilename,
  googleUrl,
  outlookUrl,
}: EventLiveActionsProps) {
  const { live, gone } = useLiveEvent(slug);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  let visible: boolean;
  let online = isOnline;
  let url = meetingUrl;
  let ics = icsHref;
  let google = googleUrl;
  let outlook = outlookUrl;
  if (live) {
    visible = !isPastDate(live.endDate);
    online = live.isOnline;
    url = live.meetingUrl;
    // The static .ics is frozen at build; the live route serves current data.
    ics = `/api/event-ics/${encodeURIComponent(slug)}`;
    const liveIcsData = liveEventToIcsData(slug, live);
    google = buildGoogleCalendarUrl(liveIcsData);
    outlook = buildOutlookCalendarUrl(liveIcsData);
  } else {
    visible = visibleAtBuild && !(mounted && isPastDate(endDate));
  }

  if (gone || !visible) return null;

  return (
    <>
      {online && url ? <JoinEventButton meetingUrl={url} /> : null}
      <AddToCalendarButton icsHref={ics} icsFilename={icsFilename} googleUrl={google} outlookUrl={outlook} />
    </>
  );
}

type EventLiveActionsProps = {
  slug: string;
  visibleAtBuild: boolean;
  endDate: Date | string;
  isOnline: boolean;
  meetingUrl: string | null;
  icsHref: string;
  icsFilename: string;
  googleUrl: string;
  outlookUrl: string;
};
