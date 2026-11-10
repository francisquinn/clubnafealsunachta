import { useId, useRef, useState } from "react";
import { actions } from "astro:actions";
import { clearCachedMember } from "../../utils/session";
import Modal from "../Modal/Modal";
import "../../styles/form.css";

// #210: the "Delete account" section under the account settings form. The
// button opens a modal that says what goes and what stays, and the member
// confirms with their password. On success the session is gone, so the page
// moves to the home page.
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  function close() {
    if (deleting) return;
    setOpen(false);
    setError(null);
    // The dialog stays mounted when closed, so clear the typed password.
    formRef.current?.reset();
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    // A dropped connection throws rather than returning an error. The delete
    // may still have gone through, so a reload shows which: a deleted member
    // lands logged out on the home page.
    let actionError: { message: string } | undefined;
    try {
      ({ error: actionError } = await actions.deleteAccount(new FormData(e.currentTarget)));
    } catch {
      actionError = { message: "Something went wrong. Reload the page and try again." };
    }
    if (actionError) {
      setDeleting(false);
      setError(actionError.message);
      // Disabling the submit button dropped focus to the page, so put the
      // member back in the field, ready to retype.
      passwordRef.current?.focus();
      passwordRef.current?.select();
      return;
    }
    clearCachedMember();
    window.location.assign("/");
  }

  return (
    // Same fieldset and legend as the account form's sections.
    <fieldset className="cnf-form__fieldset cnf-form__danger-zone">
      <legend>Delete account</legend>
      <p className="cnf-form__hint">Permanently delete your account and the data that belongs to it.</p>
      <button
        ref={openButtonRef}
        type="button"
        className="cnf-button cnf-button__danger"
        onClick={() => setOpen(true)}
      >
        <span className="cnf-button__text">Delete account</span>
      </button>

      <Modal isOpen={open} onClose={close} labelledBy={titleId} returnFocusRef={openButtonRef}>
        <h2 id={titleId}>Delete your account</h2>
        <p>This can't be undone. We'll delete:</p>
        <ul className="cnf-modal__list">
          <li>your username, name, email, password and photo</li>
          <li>your chapter memberships and email settings</li>
          <li>your RSVPs</li>
        </ul>
        <p>Posts and events you wrote stay on the site, shown as by "Former member".</p>
        {/* The newsletter is a separate Mailchimp list keyed by email, not
            linked to the account (#213 moves it off Mailchimp). */}
        <p>This doesn't unsubscribe you from the newsletter. Use the unsubscribe link in any newsletter email.</p>
        <form ref={formRef} className="cnf-form" onSubmit={handleSubmit} noValidate>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="delete-account-password">Your password</label>
            <input
              ref={passwordRef}
              id="delete-account-password"
              type="password"
              name="password"
              className="cnf-form__input"
              autoComplete="current-password"
              required
              aria-invalid={!!error}
              aria-describedby={error ? "delete-account-error" : undefined}
            />
          </div>
          {error && (
            <div id="delete-account-error" className="cnf-form__message--error" role="alert">
              {error}
            </div>
          )}
          <div className="cnf-form__actions">
            <button
              type="submit"
              className={`cnf-button cnf-button__danger${deleting ? " cnf-button--loading" : ""}`}
              disabled={deleting}
              aria-busy={deleting}
            >
              <span className="cnf-button__text">Delete my account</span>
            </button>
            <button type="button" className="cnf-button cnf-button__ghost" disabled={deleting} onClick={close}>
              <span className="cnf-button__text">Cancel</span>
            </button>
          </div>
        </form>
      </Modal>
    </fieldset>
  );
}
