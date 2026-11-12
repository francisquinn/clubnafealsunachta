import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actions } from "astro:actions";
import { isValidEmail } from "../../utils/script";
import Modal from "../Modal/Modal";
import "../../styles/form.css";

interface ChangeEmailProps {
  email: string;
}

// #219: the email in the account form's "Account details". Shows the
// current address; the button opens a modal for the new one and the
// member's password. Nothing switches until the link sent to the new
// address is opened.
export default function ChangeEmail({ email }: ChangeEmailProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The address a link was sent to, once one has been.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  // The section sits inside the account form, and forms can't nest, so the
  // modal (with its own form) is portalled to <body> once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function close() {
    if (sending) return;
    setOpen(false);
    setError(null);
    // The dialog stays mounted when closed, so clear the typed password.
    formRef.current?.reset();
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    // React bubbles events through portals, so without this the account
    // form's own submit handler would run too.
    e.stopPropagation();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newEmail = formData.get("new_email")?.toString().trim() ?? "";
    if (!isValidEmail(newEmail)) {
      setError("Enter a valid email address");
      return;
    }

    setSending(true);
    let actionError: { message: string } | undefined;
    try {
      ({ error: actionError } = await actions.requestEmailChange(formData));
    } catch {
      actionError = { message: "Something went wrong. Please try again." };
    }
    setSending(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setSentTo(newEmail.toLowerCase());
    setOpen(false);
    formRef.current?.reset();
  }

  return (
    <>
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="current-email">Email</label>
        <div className="cnf-form__input-row">
          {/* No name: it's display only, so the account form doesn't submit it. */}
          <input id="current-email" type="email" className="cnf-form__input cnf-form__input--readonly" value={email} readOnly />
          <button
            ref={openButtonRef}
            type="button"
            className="cnf-button cnf-button__secondary"
            onClick={() => setOpen(true)}
          >
            {/* Screen readers still hear "Change email" out of context. */}
            <span className="cnf-button__text">Change<span className="cnf-visually-hidden"> email</span></span>
          </button>
        </div>
      </div>
      {/* The live region stays put; the message only appears once there's
          something to say, so screen readers announce it. */}
      <div className="cnf-form__status" role="status">
        {sentTo && (
          <p className="cnf-form__message--success">
            We've sent a link to {sentTo}. Open it within 24 hours to switch. Until then, keep using {email}.
          </p>
        )}
      </div>

      {mounted && createPortal(
      <Modal isOpen={open} onClose={close} labelledBy={titleId} returnFocusRef={openButtonRef}>
        <h2 id={titleId}>Change your email</h2>
        <p>We'll send a link to the new address. Your email changes once you open it.</p>
        <form ref={formRef} className="cnf-form" onSubmit={handleSubmit} noValidate>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="change-email-new">New email</label>
            <input
              id="change-email-new"
              type="email"
              name="new_email"
              className="cnf-form__input"
              // "email" would invite autofilling the current address.
              autoComplete="off"
              required
            />
          </div>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="change-email-password">Your password</label>
            <input
              id="change-email-password"
              type="password"
              name="password"
              className="cnf-form__input"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="cnf-form__message--error" role="alert">
              {error}
            </div>
          )}
          <div className="cnf-form__actions">
            <button
              type="submit"
              className={`cnf-button cnf-button__gold${sending ? " cnf-button--loading" : ""}`}
              disabled={sending}
              aria-busy={sending}
            >
              <span className="cnf-button__text">Send link</span>
            </button>
            <button type="button" className="cnf-button cnf-button__ghost" disabled={sending} onClick={close}>
              <span className="cnf-button__text">Cancel</span>
            </button>
          </div>
        </form>
      </Modal>,
      document.body,
      )}
    </>
  );
}
