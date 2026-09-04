import { describe, it, expect } from "vitest";
import {
  buildEventIcs,
  buildGoogleCalendarUrl,
  escapeIcsText,
  foldIcsLine,
  formatIcsDateTime,
  type EventIcsData,
} from "./ics";

function makeEvent(overrides: Partial<EventIcsData> = {}): EventIcsData {
  return {
    name: "Philosophy Talk: Free Will",
    date: new Date("2026-09-05T17:00:00Z"),
    isOnline: false,
    venue: { name: "Caffe San Marco", url: "https://maps.google.com/caffe" },
    meetingUrl: null,
    slug: "philosophy-talk-free-will",
    description: "An evening discussion on whether free will exists.",
    summary: null,
    ...overrides,
  };
}

const ALL_WITHOUT_DESCRIPTION: EventIcsData = {
  name: "Talk",
  date: new Date("2026-09-05T17:00:00Z"),
  isOnline: false,
  venue: { name: "Venue", url: null },
  meetingUrl: null,
  slug: "talk",
  description: null,
  summary: null,
};

describe("formatIcsDateTime", () => {
  it("formats the UTC instant as yyyyMMddTHHmmssZ", () => {
    expect(formatIcsDateTime(new Date("2026-09-05T17:00:00Z"))).toBe(
      "20260905T170000Z"
    );
    expect(formatIcsDateTime(new Date("2026-01-02T03:04:05Z"))).toBe(
      "20260102T030405Z"
    );
  });

  it("is timezone-independent — UTC instant is identical for every viewer", () => {
    // 17:00 UTC == 19:00 CEST (Trieste summer) == 18:00 WEST (Lisbon). The
    // Z-suffixed value carries the instant, so local rendering is left to
    // each attendee's calendar app.
    const localInTrieste = formatIcsDateTime(
      new Date("2026-09-05T19:00:00+02:00")
    );
    expect(localInTrieste).toBe("20260905T170000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon and comma", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
  });

  it("escapes newlines as backslash-n", () => {
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("does not re-escape inserted escape sequences", () => {
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines untouched", () => {
    const line = "SUMMARY:Free Will";
    expect(foldIcsLine(line)).toBe(line);
  });

  it("folds long lines at 75 octets with CRLF + space continuations", () => {
    const long = "DESCRIPTION:" + "x".repeat(150);
    const folded = foldIcsLine(long);
    const physicalLines = folded.split("\r\n");
    expect(physicalLines).toHaveLength(3);
    for (const [i, line] of physicalLines.entries()) {
      expect(line.length).toBeLessThanOrEqual(75);
      if (i > 0) expect(line.startsWith(" ")).toBe(true);
    }
    // Unfolding the folded payload must reproduce the original byte-for-byte.
    const unfolded = physicalLines
      .map((l) => l.replace(/^ /, ""))
      .join("");
    expect(unfolded).toBe(long);
  });
});

describe("buildEventIcs", () => {
  it("produces a single well-formed VEVENT envelope with CRLF endings", () => {
    const ics = buildEventIcs(makeEvent());
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/m);
    expect(ics).toMatch(/\r\nEND:VCALENDAR\r\n$/);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(2);
    expect(ics.split("END:VEVENT")).toHaveLength(2);
  });

  it("maps the stored date to a UTC start and a 1.5-hour end", () => {
    const ics = buildEventIcs(makeEvent());
    expect(ics).toContain("DTSTART:20260905T170000Z");
    expect(ics).toContain("DTEND:20260905T183000Z");
  });

  it("sets a stable UID derived from the slug", () => {
    const ics = buildEventIcs(makeEvent());
    expect(ics).toContain(
      "UID:event-philosophy-talk-free-will@clubnafealsunachta.com"
    );
  });

  it("uses a well-formed DTSTAMP timestamp", () => {
    const ics = buildEventIcs(makeEvent());
    const stamp = ics.match(/DTSTAMP:(\d{8}T\d{6}Z)/)?.[1];
    expect(stamp).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("uses the event name as SUMMARY", () => {
    const ics = buildEventIcs(makeEvent());
    expect(ics).toContain("SUMMARY:Philosophy Talk: Free Will");
  });

  describe("location", () => {
    it("uses 'Online' with the meeting URL for online events", () => {
      const ics = buildEventIcs(
        makeEvent({
          isOnline: true,
          venue: null,
          meetingUrl: "https://meet.jit.si/feel-philosophy",
        })
      );
      expect(ics).toContain(
        "LOCATION:Online (https://meet.jit.si/feel-philosophy)"
      );
    });

    it("uses bare 'Online' when an online event has no meeting URL", () => {
      const ics = buildEventIcs(
        makeEvent({ isOnline: true, venue: null, meetingUrl: null })
      );
      expect(ics).toContain("LOCATION:Online");
    });

    it("uses venue name and URL for in-person events", () => {
      const ics = buildEventIcs(makeEvent());
      expect(ics).toContain("LOCATION:Caffe San Marco (https://maps.google.com/caffe)");
    });

    it("uses just the venue name when the venue has no URL", () => {
      const ics = buildEventIcs(
        makeEvent({ venue: { name: "Caffe San Marco", url: null } })
      );
      expect(ics).toContain("LOCATION:Caffe San Marco");
    });

    it("omits LOCATION when there is neither venue nor online URL", () => {
      const ics = buildEventIcs(
        makeEvent({ isOnline: false, venue: null, meetingUrl: null })
      );
      expect(ics).not.toContain("LOCATION:");
    });
  });

  describe("description", () => {
    it("includes the description", () => {
      const ics = buildEventIcs(makeEvent());
      expect(ics).toContain(
        "DESCRIPTION:An evening discussion on whether free will exists."
      );
    });

    it("combines description and summary when both are present", () => {
      const ics = buildEventIcs(
        makeEvent({ description: "Discussion.", summary: "Free will." })
      );
      expect(ics).toContain("DESCRIPTION:Discussion.\\n\\nFree will.");
    });

    it("falls back to summary when description is empty", () => {
      const ics = buildEventIcs(
        makeEvent({ description: "", summary: "Just the summary." })
      );
      expect(ics).toContain("DESCRIPTION:Just the summary.");
    });

    it("omits DESCRIPTION when both are absent", () => {
      const ics = buildEventIcs(ALL_WITHOUT_DESCRIPTION);
      expect(ics).not.toContain("DESCRIPTION:");
    });
  });

  it("escapes special characters in user-provided text values", () => {
    const ics = buildEventIcs(
      makeEvent({
        name: "Free Will & Friends, Semicolon; Talk",
        description: "Line one\nLine two, with a comma and a back\\slash",
      })
    );
    expect(ics).toContain("SUMMARY:Free Will & Friends\\, Semicolon\\; Talk");
    expect(ics).toContain(
      "DESCRIPTION:Line one\\nLine two\\, with a comma and a back\\\\slash"
    );
  });

  it("preserves UTF-8 content without quoted-printable encoding", () => {
    const ics = buildEventIcs(
      makeEvent({ name: "Dlí na Fealsúnachta", description: null, summary: null })
    );
    expect(ics).toContain("SUMMARY:Dlí na Fealsúnachta");
    expect(ics).not.toContain("ENCODING=QUOTED-PRINTABLE");
  });

  it("folds long names and descriptions", () => {
    const longName = "Talk: " + "r".repeat(140);
    const longDescription = "Words about " + "w".repeat(160);
    const ics = buildEventIcs(
      makeEvent({ name: longName, description: longDescription, summary: null })
    );
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // "SUMMARY:Talk: " is 14 octets, so the first physical line carries 61 r's.
    expect(ics).toContain("SUMMARY:Talk: " + "r".repeat(61));
    // Unfolding restores the full long values byte-for-byte.
    const unfolded = ics.split("\r\n").map((l) => l.replace(/^ /, "")).join("");
    expect(unfolded).toContain(`SUMMARY:${longName}`);
    expect(unfolded).toContain(`DESCRIPTION:${longDescription}`);
  });
});

describe("buildGoogleCalendarUrl", () => {
  it("builds a calendar.google.com render URL with action=TEMPLATE", () => {
    const url = buildGoogleCalendarUrl(makeEvent());
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
  });

  it("encodes the name as text and the UTC start/end as a dates range", () => {
    const url = buildGoogleCalendarUrl(makeEvent());
    const params = new URL(url).searchParams;
    expect(params.get("text")).toBe("Philosophy Talk: Free Will");
    expect(params.get("dates")).toBe("20260905T170000Z/20260905T183000Z");
  });

  it("includes venue name and url as location for in-person events", () => {
    const url = buildGoogleCalendarUrl(makeEvent());
    const params = new URL(url).searchParams;
    expect(params.get("location")).toBe("Caffe San Marco (https://maps.google.com/caffe)");
  });

  it("uses 'Online (url)' as location for online events with a meeting url", () => {
    const url = buildGoogleCalendarUrl(
      makeEvent({ isOnline: true, venue: null, meetingUrl: "https://meet.jit.si/feel-philosophy" })
    );
    const params = new URL(url).searchParams;
    expect(params.get("location")).toBe("Online (https://meet.jit.si/feel-philosophy)");
  });

  it("omits the location param entirely when there is none", () => {
    const url = buildGoogleCalendarUrl(
      makeEvent({ isOnline: false, venue: null, meetingUrl: null })
    );
    expect(new URL(url).searchParams.has("location")).toBe(false);
  });

  it("combines description and summary into details, same as the .ics", () => {
    const url = buildGoogleCalendarUrl(
      makeEvent({ description: "Discussion.", summary: "Free will." })
    );
    expect(new URL(url).searchParams.get("details")).toBe("Discussion.\n\nFree will.");
  });

  it("omits the details param entirely when both are absent", () => {
    const url = buildGoogleCalendarUrl(ALL_WITHOUT_DESCRIPTION);
    expect(new URL(url).searchParams.has("details")).toBe(false);
  });

  it("URI-encodes special characters rather than ICS-escaping them", () => {
    const url = buildGoogleCalendarUrl(
      makeEvent({ name: "Free Will & Friends, Semicolon; Talk" })
    );
    // URLSearchParams round-trips the raw value — no backslash-escaping.
    expect(new URL(url).searchParams.get("text")).toBe("Free Will & Friends, Semicolon; Talk");
  });
});