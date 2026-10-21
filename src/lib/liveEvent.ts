// #197: the event page is prerendered, so anything time- or edit-sensitive on
// it (meeting link, schedule, calendar links) can be stale by view time. This
// is the live read behind getEventLive and the live .ics route — one query,
// one shape, so the two can't disagree.
import { supabaseAdmin } from "./supabase";
import { unwrapRelation } from "./supabaseRelations";
import type { EventIcsData } from "./ics";

// Dates are ISO strings (JSON-safe for the action); toEventIcsData-compatible
// once parsed — see liveEventToIcsData.
export type LiveEvent = {
  name: string;
  date: string;
  endDate: string;
  isOnline: boolean;
  meetingUrl: string | null;
  meetPoint: string | null;
  description: string | null;
  summary: string | null;
  venue: { name: string | null; url: string | null } | null;
};

export async function fetchLiveEvent(slug: string): Promise<LiveEvent | null> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("name, date, end_date, is_online, meeting_url, meet_point, description, summary, venues(name, url)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const venue = unwrapRelation(data.venues);
  return {
    name: data.name,
    // Normalised to UTC "Z" ISO strings, matching what the build-time loader's
    // `new Date(...)` produces — Postgres may hand back "+00:00" offsets.
    date: new Date(data.date).toISOString(),
    endDate: new Date(data.end_date).toISOString(),
    isOnline: data.is_online,
    meetingUrl: data.meeting_url,
    meetPoint: data.meet_point,
    description: data.description,
    summary: data.summary,
    venue: venue ? { name: venue.name, url: venue.url } : null,
  };
}

export function liveEventToIcsData(slug: string, live: LiveEvent): EventIcsData {
  return { ...live, slug, date: new Date(live.date), endDate: new Date(live.endDate) };
}
