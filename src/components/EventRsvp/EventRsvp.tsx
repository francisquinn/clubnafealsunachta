import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import { getDisplayName } from "../../lib/memberDisplay";
import Modal from "../Modal/Modal";
import {
  RSVP_LABELS,
  RSVP_STATUSES,
  type RsvpCounts,
  type RsvpLists,
  type RsvpStatus,
} from "../../lib/rsvpTypes";

// #27: the event page's attendance widget. RSVPs don't trigger a rebuild
// (only createEvent/updateEvent do), so the build-time counts baked into
// EventRsvpProps.initialCounts can be stale — a single getEventRsvps call on
// hydration is what makes them trustworthy, and — for a logged-in member
// only — brings back their own status plus the full named breakdowns.
// Deliberate tradeoff: the summary shows "Loading…" until that call
// resolves, on every load, so a no-JS visitor (or a crawler that doesn't
// wait on hydration) sees that placeholder rather than a real count — chosen
// over a silent stale-number swap for the sake of a visible "this is live"
// loading state. Setting/clearing a status goes through setEventRsvp and
// re-renders from its fresh state.
export default function EventRsvp({ slug, initialCounts, date }: EventRsvpProps) {
  const [counts, setCounts] = useState<RsvpCounts>(initialCounts);
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [lists, setLists] = useState<RsvpLists | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [setting, setSetting] = useState<RsvpStatus | null>(null);
  const [error, setError] = useState("");
  const [showAttendees, setShowAttendees] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const eventHasPassed = new Date(date).getTime() < Date.now();

  useEffect(() => {
    let cancelled = false;
    actions.getEventRsvps({ slug }).then(({ data, error: actionError }) => {
      if (cancelled) return;
      // Falls back to the build-time counts on error — data left untouched,
      // isMember stays null, so the member-only controls simply don't show.
      if (!actionError && data) {
        setCounts(data.counts);
        setMyStatus(data.myStatus);
        setLists(data.lists);
        setIsMember(data.lists !== null);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleStatus(status: RsvpStatus) {
    if (eventHasPassed || setting !== null) return;
    // Clicking your own active status again clears it, rather than being a
    // no-op — the same toggle-button behavior as Meetup/Facebook's RSVP.
    const nextStatus = status === myStatus ? null : status;
    setSetting(status);
    setError("");
    const { data, error: actionError } = await actions.setEventRsvp({ slug, status: nextStatus });
    setSetting(null);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    if (data) {
      setCounts(data.counts);
      setMyStatus(data.myStatus);
      setLists(data.lists);
    }
  }

  // Reuses the header's existing login modal (LoginButton.tsx) rather than
  // duplicating it — that component wires its click listener onto this exact
  // static trigger, which is always present in the page's Header.
  function openLoginModal() {
    document.getElementById("cnf-login-trigger")?.click();
  }

  // The one place that decides "is this visitor allowed to do member-only
  // things" — used by both the status buttons and "See all", so a future
  // change to the gating condition only has one call site to update.
  function gate(action: () => void) {
    return () => (isMember ? action() : openLoginModal());
  }

  const total = counts.going + counts.maybe + counts.not_going;
  const summary = [counts.going > 0 && `${counts.going} going`, counts.maybe > 0 && `${counts.maybe} maybe`, counts.not_going > 0 && `${counts.not_going} not going`]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-label="Attendance">
      <div className="cnf-section__header">
        <h2 className="cnf-rsvp__title">Attendance</h2>
        {isMember !== null && total > 0 && (
          // Not shown at all until isMember resolves — before that we treat
          // attendance as unknown/empty rather than showing a disabled
          // placeholder, since we don't yet know whether a click should
          // open the attendee list or the login modal.
          <button
            type="button"
            className="cnf-button cnf-button--link"
            onClick={gate(() => setShowAttendees(true))}
          >
            See all
          </button>
        )}
      </div>
      <p className="cnf-rsvp__summary">
        {loaded ? summary || (total === 0 ? "No responses yet." : "") : "Loading…"}
      </p>

      {!eventHasPassed && (
        // Rendered from the first paint (no isMember-gated pop-in) — each
        // button stays disabled until isMember resolves, since we don't yet
        // know whether a click should set a status or open the login modal.
        // Anonymous visitors see the same real buttons as members —
        // clicking one just pops the header's login modal instead of
        // setting a status (mirrors Meetup/Facebook: show the real
        // action, gate it on click, rather than a separate "log in to
        // RSVP" prompt).
        <div className="cnf-rsvp__controls" role="group" aria-label="Your attendance">
          {RSVP_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`cnf-button cnf-button--compact cnf-rsvp__status ${myStatus === status ? "cnf-button__primary" : "cnf-button__secondary"}${setting === status ? " cnf-button--loading" : ""}`}
              aria-pressed={myStatus === status}
              aria-busy={setting === status}
              disabled={isMember === null || setting !== null}
              onClick={gate(() => handleStatus(status))}
            >
              <span className="cnf-button__text">{RSVP_LABELS[status]}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="cnf-rsvp__error" role="alert">
          {error}
        </p>
      )}

      {lists && (
        <Modal isOpen={showAttendees} onClose={() => setShowAttendees(false)}>
          <h2>Attendance</h2>
          <div className="cnf-rsvp__lists">
            {RSVP_STATUSES.map((status) =>
              lists[status].length > 0 ? (
                <div key={status} className="cnf-rsvp__list">
                  <div className="cnf-rsvp__list-header">
                    <h3 className="cnf-rsvp__list-title">{RSVP_LABELS[status]}</h3>
                    <span className="cnf-count" aria-hidden="true">{lists[status].length}</span>
                  </div>
                  <ul className="cnf-rsvp__list-members">
                    {lists[status].map((member) => (
                      <li key={member.username}>
                        <a href={`/profile/${member.username}`}>{getDisplayName(member)}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

type EventRsvpProps = {
  slug: string;
  initialCounts: RsvpCounts;
  date: string;
};