// Every event time is entered via a `type="datetime-local"` input, which
// produces a naive "YYYY-MM-DDTHH:mm" string with no timezone info at all —
// the organizer's intent is always that club's own local wall-clock time
// (see DEFAULT_CLUB_TIMEZONE), never UTC and never the visitor's own zone.
// These two functions are the only place that boundary is crossed: one
// direction when a form value is written to the (true-UTC) `date` column,
// the other when a stored UTC instant needs to be shown as, or re-edited as,
// that club's local wall-clock time.
//
// Bug this exists to fix (found 2026-09-04): the event actions used to write
// the naive form string straight into a `timestamptz` column with no
// conversion at all, so Postgres's default UTC session timezone treated
// "18:30" as if it were already UTC — silently storing every event 1-2 hours
// (the Rome/UTC offset, which itself varies with DST) off from the real
// instant. It stayed invisible because the site's own display code read the
// same raw (mislabeled) UTC digits back out untouched; it surfaced once a
// spec-correct UTC consumer (the .ics/Google Calendar links) converted that
// wrong instant to each viewer's real local time.

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  // Midnight can format as "24" under hour12: false in some environments.
  const hour = parts.hour === "24" ? "0" : parts.hour;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUtc - date.getTime();
}

// Converts a naive "YYYY-MM-DDTHH:mm" (a datetime-local input's value) into
// the real UTC instant it represents in `timeZone`. Two-pass: a first guess
// treats the digits as UTC just to land on roughly the right calendar date
// (so the correct DST offset for that date can be looked up), then corrects
// by that date's actual offset.
//
// That first guess can itself land the offset lookup on the wrong side of a
// DST transition (#72): for a wall-clock time shortly before the actual
// changeover, treating the naive digits as UTC pushes the lookup instant
// *past* the transition even though the real local time hasn't reached it
// yet, so the offset comes back wrong by exactly the DST delta. Re-deriving
// the offset from the candidate UTC instant (rather than the guess) and
// redoing the subtraction when that disagrees corrects for this — the same
// self-correcting round-trip most wall-clock<->UTC libraries use around DST
// boundaries. Looped to a fixed point (capped, so a `timeZone` with back-to-
// back transitions can't spin forever) rather than a single correction pass,
// since this is a general-purpose function taking an arbitrary IANA zone, not
// just DEFAULT_CLUB_TIMEZONE's simple 1-hour Europe/Rome rule. Like any
// conversion using this trick, the one genuinely ambiguous hour during a
// "fall back" transition (which wall-clock time maps to two different UTC
// instants) still isn't uniquely resolvable — fine here, nobody's scheduling
// a philosophy talk at 2:30am on a clock-change night.
export function localWallTimeToUtc(naiveLocal: string, timeZone: string): Date {
  const guess = new Date(`${naiveLocal}:00.000Z`);
  let offsetMs = getTimeZoneOffsetMs(guess, timeZone);
  let candidate = new Date(guess.getTime() - offsetMs);

  // Re-derive the offset from the candidate instant and try again if it
  // disagrees. A handful of iterations is generous for any real timezone's
  // rules — this is just guarding against a pathological zone/input looping
  // forever, not a case expected to actually occur.
  for (let i = 0; i < 5; i++) {
    const correctedOffsetMs = getTimeZoneOffsetMs(candidate, timeZone);
    if (correctedOffsetMs === offsetMs) break;
    offsetMs = correctedOffsetMs;
    candidate = new Date(guess.getTime() - offsetMs);
  }

  return candidate;
}

// The inverse: renders a true UTC instant as `timeZone`'s wall-clock time, in
// the same "YYYY-MM-DDTHH:mm" shape a datetime-local input's value/defaultValue
// expects (e.g. the admin edit form pre-filling from a stored event).
export function utcToLocalWallTime(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}
