// Kept apart from liveEvent.ts on purpose: this runs in the browser (the
// EventLiveActions island rebuilds its calendar links from live data), and
// liveEvent.ts imports the server-only Supabase client. A value import from
// there put that client and dotenv into the island's bundle, where dotenv's
// `process` lookup crashed hydration on every event page. Nothing in this
// file may import server code (clientBundle.test.ts checks).
import type { EventIcsData } from "./ics";
import type { LiveEvent } from "./liveEvent";

export function liveEventToIcsData(slug: string, live: LiveEvent): EventIcsData {
  return { ...live, slug, date: new Date(live.date), endDate: new Date(live.endDate) };
}
