// RFC 5545 iCalendar generation for event pages. UTC ("Z") times are a fixed
// instant, so every attendee's calendar app renders the same local time
// whether they're in Trieste or remote. DTEND now comes straight from the
// event's own stored end_date (#100) rather than a synthetic guess.

import type { EventCollection } from "../types/types";

const MAX_LINE_OCTETS = 75;

export type EventIcsData = {
  name: string;
  date: Date;
  endDate: Date;
  isOnline: boolean;
  venue: { name: string | null; url: string | null } | null;
  meetingUrl: string | null;
  slug: string;
  description: string | null;
  summary: string | null;
};

// The one place that narrows a full event collection entry down to what the
// calendar builders below need — used by both [eventSlug].astro (Google
// Calendar link) and [eventSlug].ics.ts (the served .ics file) so the two
// outputs can't quietly disagree on content if EventIcsData's fields change.
export function toEventIcsData(event: EventCollection): EventIcsData {
  const { name, date, endDate, isOnline, venue, meetingUrl, slug, description, summary } = event.data;
  return { name, date, endDate, isOnline, venue, meetingUrl, slug, description, summary };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatIcsDateTime(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

// Section 3.3.11: backslash, semicolon, comma and newlines are escaped so the
// SYMANTICS of the value survive a round trip. Backslashes first so the
// escape sequences we insert aren't re-escaped.
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function buildEventLocation(event: EventIcsData): string {
  if (event.isOnline) {
    return event.meetingUrl ? `Online (${event.meetingUrl})` : "Online";
  }
  const venueName = event.venue?.name?.trim() ?? "";
  const venueUrl = event.venue?.url?.trim() ?? null;
  if (!venueName && !venueUrl) return "";
  return venueUrl ? `${venueName} (${venueUrl})` : venueName;
}

// Section 3.1: content lines longer than 75 octets are "folded" by inserting
// a CRLF followed by a single space; unfold by removing CRLF+space. Splits at
// code-point boundaries so multi-byte characters are never torn apart.
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;

  const chars = Array.from(line);
  const physical: string[] = [];
  let part = "";
  let octets = 0;
  for (const ch of chars) {
    const chOctets = encoder.encode(ch).length;
    if (octets + chOctets <= MAX_LINE_OCTETS) {
      part += ch;
      octets += chOctets;
    } else {
      physical.push(part);
      // Continuation lines include the leading space in the 75-octet budget.
      part = " " + ch;
      octets = 1 + chOctets;
    }
  }
  if (part) physical.push(part);
  return physical.join("\r\n");
}

function getEventBounds(event: EventIcsData): { start: Date; end: Date } {
  return { start: new Date(event.date), end: new Date(event.endDate) };
}

function combineDescription(event: EventIcsData): string {
  return [event.description, event.summary]
    .filter((s) => s !== null && s.trim() !== "")
    .join("\n\n");
}

export function buildEventIcs(event: EventIcsData): string {
  const { start, end } = getEventBounds(event);
  const location = buildEventLocation(event);
  const description = combineDescription(event);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Club na Fealsunachta//NONSGML Club event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.slug}@clubnafealsunachta.com`,
    `DTSTAMP:${formatIcsDateTime(new Date())}`,
    `DTSTART:${formatIcsDateTime(start)}`,
    `DTEND:${formatIcsDateTime(end)}`,
    `SUMMARY:${escapeIcsText(event.name)}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

// Google's own "render" endpoint pre-fills its web compose screen — a real
// deep link, not a file, so there's no download/MIME-sniffing step for
// Google Calendar users at all. Reuses the same UTC instants and combined
// description/location as the .ics (formatIcsDateTime's Z-suffixed format
// happens to be exactly what Google's `dates` param wants), just plain
// URI-encoded rather than ICS-escaped.
export function buildGoogleCalendarUrl(event: EventIcsData): string {
  const { start, end } = getEventBounds(event);
  const location = buildEventLocation(event);
  const description = combineDescription(event);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${formatIcsDateTime(start)}/${formatIcsDateTime(end)}`,
  });
  if (description) params.set("details", description);
  if (location) params.set("location", location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}