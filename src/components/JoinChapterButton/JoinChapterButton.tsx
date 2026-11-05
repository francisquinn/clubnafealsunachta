import { useEffect, useRef, useState } from "react";
import { actions } from "astro:actions";
import { fetchSessionInfo } from "../../utils/session";
import Modal from "../Modal/Modal";
import Checkbox from "../Checkbox/Checkbox";

type Status = "loading" | "unavailable" | "logged-out" | "can-join" | "joining" | "joined" | "leaving" | "error";

// The chapter page's "Join chapter" button. Logged-out visitors get the
// site's login modal (the header's trigger), logged-in members join in place
// and then see a "Member" button that takes them back out of the chapter.
// Shows an empty placeholder until the session and membership are known, so
// the button never flashes the wrong state.
// #211: a successful join opens a welcome modal whose unticked checkbox is the
// member's opt-in to the chapter's event emails. Closing it without saving
// leaves them off.
interface Props {
  chapterId: number;
  chapterName: string;
  meetingWhen?: string;
  chatUrl?: string;
}

export default function JoinChapterButton({ chapterId, chapterName, meetingWhen, chatUrl }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [leaveFailed, setLeaveFailed] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [wantsEmails, setWantsEmails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const memberButtonRef = useRef<HTMLButtonElement>(null);
  const welcomeTitleId = `join-chapter-${chapterId}-title`;

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
    if (!error) {
      setWantsEmails(false);
      setSaveFailed(false);
      setWelcomeOpen(true);
    }
  }

  async function saveWelcome() {
    if (!wantsEmails) {
      setWelcomeOpen(false);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    const { error } = await actions.setChapterEmails({ chapterId, enabled: true });
    setSaving(false);
    if (error) setSaveFailed(true);
    else setWelcomeOpen(false);
  }

  const welcome = (
    <Modal
      isOpen={welcomeOpen}
      // Stays open while a save is in flight, so a failure isn't shown on a
      // closed modal to a member who thinks they opted in.
      onClose={() => {
        if (!saving) setWelcomeOpen(false);
      }}
      labelledBy={welcomeTitleId}
      returnFocusRef={memberButtonRef}
    >
      <h2 id={welcomeTitleId}>Welcome to {chapterName}!</h2>
      {meetingWhen && <p>We meet {meetingWhen}.</p>}
      {chatUrl && (
        <p>
          <a className="cnf-chapter-page__chat" href={chatUrl} target="_blank" rel="noopener">
            <img className="cnf-chapter-page__chat-icon" src="/whatsapp.svg" alt="" />
            Join the WhatsApp group
          </a>
        </p>
      )}
      <form
        className="cnf-form"
        onSubmit={(e) => {
          e.preventDefault();
          saveWelcome();
        }}
      >
        <div className="cnf-form__group">
          <Checkbox
            id={`chapter-${chapterId}-emails`}
            name="emails_enabled"
            label="Email me about upcoming events"
            onChange={(e) => setWantsEmails(e.target.checked)}
          />
          <p className="cnf-form__hint">You can change this any time in your profile settings.</p>
        </div>
        {saveFailed && (
          <p className="cnf-rsvp__error" role="alert">
            Something went wrong. Please try again.
          </p>
        )}
        <button
          type="submit"
          className={`cnf-button cnf-button__gold${saving ? " cnf-button--loading" : ""}`}
          // Sized to its label at every width, unlike other forms' full-width
          // mobile submit; the grid would otherwise stretch it.
          style={{ justifySelf: "start" }}
          disabled={saving}
        >
          <span className="cnf-button__text">Save</span>
        </button>
      </form>
    </Modal>
  );

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
        {welcome}
        <button
          ref={memberButtonRef}
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
