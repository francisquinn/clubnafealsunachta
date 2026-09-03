// Shared RSVP domain types + constants, imported by the server actions
// (src/actions/rsvps.ts), the content loader's per-event counts, and the
// client-side EventRsvp island. Kept free of any Supabase/auth imports so it
// can be pulled into a React client bundle without dragging server code in.

export const RSVP_STATUSES = ["going", "maybe", "not_going"] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type RsvpCounts = {
  going: number;
  maybe: number;
  not_going: number;
};

export type RsvpMember = {
  username: string;
  full_name: string | null;
  display_full_name: boolean;
};

export type RsvpLists = {
  going: RsvpMember[];
  maybe: RsvpMember[];
  not_going: RsvpMember[];
};

// The full page-level state returned by both RSVP server actions. `lists`
// (and therefore `myStatus`) are only populated for an authenticated member —
// a public visitor gets aggregate `counts` and nothing that could identify
// who's on them.
export type RsvpState = {
  counts: RsvpCounts;
  myStatus: RsvpStatus | null;
  lists: RsvpLists | null;
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
};

// Used once an event has passed, so the attendance breakdown reads as a
// record of what happened rather than a still-open invitation.
export const PAST_RSVP_LABELS: Record<RsvpStatus, string> = {
  going: "Went",
  maybe: "Maybe",
  not_going: "Didn't go",
};

export function isRsvpStatus(value: unknown): value is RsvpStatus {
  return typeof value === "string" && (RSVP_STATUSES as readonly string[]).includes(value);
}