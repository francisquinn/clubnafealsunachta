import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import { fetchSessionInfo } from "../../utils/session";

type Status = "loading" | "logged-out" | "can-join" | "joining" | "joined" | "error";

// The chapter page's "Join the chapter" button. Logged-out visitors get the
// site's login modal (the header's trigger), logged-in members join in place
// and then see that they are in. Renders nothing until the session and
// membership are known, so the button never flashes the wrong state.
export default function JoinChapterButton({ chapterId, chapterName }: { chapterId: number; chapterName: string }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await fetchSessionInfo();
        if (cancelled) return;
        if (!session.loggedIn) {
          // A transient lookup failure ("degraded") is not proof of being
          // logged out: show nothing rather than a login prompt to a member.
          setStatus(session.degraded ? "loading" : "logged-out");
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

  if (status === "loading") return null;

  if (status === "joined") {
    return <p className="cnf-chapter-page__joined">You're part of the {chapterName} chapter.</p>;
  }

  return (
    <div>
      <button
        type="button"
        className={`cnf-button cnf-button__gold${status === "joining" ? " cnf-button--loading" : ""}`}
        onClick={join}
        disabled={status === "joining"}
      >
        <span className="cnf-button__text">Join the {chapterName} chapter</span>
      </button>
      {status === "error" && (
        <p className="cnf-rsvp__error" role="alert">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
