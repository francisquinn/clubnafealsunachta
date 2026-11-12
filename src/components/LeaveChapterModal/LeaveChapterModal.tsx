import { useId } from "react";
import Modal from "../Modal/Modal";
import "../../styles/form.css";

interface Props {
  isOpen: boolean;
  chapterName: string;
  leaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

// Asks before taking a member out of a chapter, from the chapter page's
// Member button and from the account form's chapter memberships (#219).
// Leaving saves straight away, so this is the only thing between a stray
// tap and losing the chapter's event emails.
export default function LeaveChapterModal({ isOpen, chapterName, leaving, error, onConfirm, onCancel, returnFocusRef }: Props) {
  const titleId = useId();
  return (
    <Modal
      isOpen={isOpen}
      // Stays open while leaving is in flight, so a failure shows here.
      onClose={() => {
        if (!leaving) onCancel();
      }}
      labelledBy={titleId}
      returnFocusRef={returnFocusRef}
    >
      <h2 id={titleId}>Leave {chapterName}?</h2>
      <p>You'll stop getting emails about its events. You can join again any time from the chapter's page.</p>
      {error && (
        <div className="cnf-form__message--error" role="alert">
          {error}
        </div>
      )}
      <div className="cnf-form__actions">
        <button
          type="button"
          className={`cnf-button cnf-button__danger${leaving ? " cnf-button--loading" : ""}`}
          disabled={leaving}
          aria-busy={leaving}
          onClick={onConfirm}
        >
          <span className="cnf-button__text">Leave</span>
        </button>
        <button type="button" className="cnf-button cnf-button__ghost" disabled={leaving} onClick={onCancel}>
          <span className="cnf-button__text">Cancel</span>
        </button>
      </div>
    </Modal>
  );
}
