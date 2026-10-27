import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import { fetchSessionInfo } from "../../utils/session";

type Status = "loading" | "unavailable" | "logged-out" | "can-join" | "joining" | "joined" | "leaving" | "error";

// The chapter page's "Join chapter" button. Logged-out visitors get the
// site's login modal (the header's trigger), logged-in members join in place
// and then see a "Member" button that takes them back out of the chapter.
// Shows an empty placeholder until the session and membership are known, so
// the button never flashes the wrong state.
export default function JoinChapterButton({ chapterId }: { chapterId: number }) {
  const [status, setStatus] = useState<Status>("loading");
  const [leaveFailed, setLeaveFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await fetchSessionInfo();
        if (cancelled) return;
        if (!session.loggedIn) {
          // A transient lookup failure ("degraded") is not proof of being
          // logged out: show nothing rather than a login prompt to a member.
          setStatus(session.degraded ? "unavailable" : "logged-out");
          return;
        }
        const { data, error } = await actions.getChapterMembership({ chapterId });
        if (cancelled) return;
        if (error) {
          setStatus("error");
          return;
        }
        setStatus(data.joined ? "joined" : "can-join");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  async function join() {
    if (status === "logged-out") {
      const trigger = document.getElementById("cnf-login-trigger");
      if (trigger) trigger.click();
      else window.location.href = "/?login=1";
      return;
    }

    setStatus("joining");
    const { error } = await actions.joinChapter({ chapterId });
    setStatus(error ? "error" : "joined");
  }

  async function leave() {
    setLeaveFailed(false);
    setStatus("leaving");
    const { error } = await actions.leaveChapter({ chapterId });
    if (error) setLeaveFailed(true);
    setStatus(error ? "joined" : "can-join");
  }

  // Holds the button's space while the session and membership load, so the
  // content beside it (the WhatsApp link) doesn't jump when the button arrives.
  if (status === "loading") return <div aria-hidden="true" style={{ height: "3.5rem", width: "9.5rem" }} />;
  if (status === "unavailable") return null;

  if (status === "joined" || status === "leaving") {
    return (
      <div>
        <button
          type="button"
          className={`cnf-button cnf-button__gold-outline${status === "leaving" ? " cnf-button--loading" : ""}`}
          onClick={leave}
          disabled={status === "leaving"}
          title="Click to leave this chapter"
        >
          <span className="cnf-button__text">Member</span>
        </button>
        {leaveFailed && (
          <p className="cnf-rsvp__error" role="alert">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`cnf-button cnf-button__gold${status === "joining" ? " cnf-button--loading" : ""}`}
        onClick={join}
        disabled={status === "joining"}
      >
        <span className="cnf-button__text">Join chapter</span>
      </button>
      {status === "error" && (
        <p className="cnf-rsvp__error" role="alert">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
