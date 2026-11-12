import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actions } from "astro:actions";
import { validatePassword } from "../../utils/validation";
import Modal from "../Modal/Modal";
import "../../styles/form.css";

type FieldName = "current_password" | "new_password" | "confirm_password";
type FieldErrors = Partial<Record<FieldName, string>>;

// The password in the account form's "Account details", laid out like the
// email (#219): a read-only field and a button that opens a modal with its
// own Save, so changing the password no longer rides on the main form.
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [changed, setChanged] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  // The section sits inside the account form, and forms can't nest, so the
  // modal (with its own form) is portalled to <body> once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setFieldErrors({});
    // The dialog stays mounted when closed, so clear the typed passwords.
    formRef.current?.reset();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as FieldName;
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    // React bubbles events through portals, so without this the account
    // form's own submit handler would run too.
    e.stopPropagation();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("current_password")?.toString() ?? "";
    const newPassword = formData.get("new_password")?.toString() ?? "";
    const confirmPassword = formData.get("confirm_password")?.toString() ?? "";

    const errors: FieldErrors = {
      current_password: currentPassword ? undefined : "Enter your current password",
      new_password: validatePassword(newPassword) ?? undefined,
      confirm_password: newPassword === confirmPassword ? undefined : "Passwords do not match",
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSaving(true);
    let actionError: { message: string } | undefined;
    try {
      ({ error: actionError } = await actions.changePassword(formData));
    } catch {
      actionError = { message: "Something went wrong. Please try again." };
    }
    setSaving(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setChanged(true);
    setOpen(false);
    formRef.current?.reset();
  }

  return (
    <>
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="current-password-display">Password</label>
        <div className="cnf-form__input-row">
          {/* Placeholder dots, not the real password, and no name so the
              account form doesn't submit it. */}
          <input
            id="current-password-display"
            type="text"
            className="cnf-form__input cnf-form__input--readonly"
            value="••••••••"
            readOnly
          />
          <button
            ref={openButtonRef}
            type="button"
            className="cnf-button cnf-button__secondary"
            onClick={() => setOpen(true)}
          >
            {/* Screen readers still hear "Change password" out of context. */}
            <span className="cnf-button__text">Change<span className="cnf-visually-hidden"> password</span></span>
          </button>
        </div>
      </div>
      {/* The live region stays put; the message only appears once there's
          something to say, so screen readers announce it. */}
      <div className="cnf-form__status" role="status">
        {changed && (
          <p className="cnf-form__message--success">
            Your password is changed. Any other devices you were logged in on have been logged out.
          </p>
        )}
      </div>

      {mounted && createPortal(
      <Modal isOpen={open} onClose={close} labelledBy={titleId} returnFocusRef={openButtonRef}>
        <h2 id={titleId}>Change your password</h2>
        <form ref={formRef} className="cnf-form" onSubmit={handleSubmit} noValidate>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              name="current_password"
              className="cnf-form__input"
              autoComplete="current-password"
              onChange={handleChange}
              aria-invalid={!!fieldErrors.current_password}
            />
            {fieldErrors.current_password && <div className="cnf-form__message--error">{fieldErrors.current_password}</div>}
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              name="new_password"
              className="cnf-form__input"
              autoComplete="new-password"
              onChange={handleChange}
              aria-invalid={!!fieldErrors.new_password}
            />
            <p className="cnf-form__hint">At least 8 characters, with a number and an uppercase letter.</p>
            {fieldErrors.new_password && <div className="cnf-form__message--error">{fieldErrors.new_password}</div>}
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="confirm-new-password">Confirm new password</label>
            <input
              id="confirm-new-password"
              type="password"
              name="confirm_password"
              className="cnf-form__input"
              autoComplete="new-password"
              onChange={handleChange}
              aria-invalid={!!fieldErrors.confirm_password}
            />
            {fieldErrors.confirm_password && <div className="cnf-form__message--error">{fieldErrors.confirm_password}</div>}
          </div>

          {error && (
            <div className="cnf-form__message--error" role="alert">
              {error}
            </div>
          )}
          <div className="cnf-form__actions">
            <button
              type="submit"
              className={`cnf-button cnf-button__gold${saving ? " cnf-button--loading" : ""}`}
              disabled={saving}
              aria-busy={saving}
            >
              <span className="cnf-button__text">Save</span>
            </button>
            <button type="button" className="cnf-button cnf-button__ghost" disabled={saving} onClick={close}>
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
