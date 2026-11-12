import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actions } from "astro:actions";
import { validateUsername, validateFullName } from "../../utils/validation";
import { getCachedMember, setCachedMember } from "../../utils/session";
import Checkbox from "../Checkbox/Checkbox";
import Modal from "../Modal/Modal";
import "../../styles/form.css";

type FieldName = "username" | "full_name";
type FieldErrors = Partial<Record<FieldName, string>>;

interface ChangeNameProps {
  memberId: string;
  username: string;
  fullName: string | null;
  displayFullName: boolean;
  avatarUrl: string | null;
  // Lets the account form refresh what depends on the name (the avatar letter).
  onSaved?: (name: { username: string; fullName: string | null; displayFullName: boolean }) => void;
}

// The username and full name in the account form's "Account details"
// (#219): read-only, each with an Edit button; both open the same modal,
// with its own Save.
export default function ChangeName({ memberId, username: initialUsername, fullName: initialFullName, displayFullName: initialDisplayFullName, avatarUrl, onSaved }: ChangeNameProps) {
  // What's saved now; updated after a save so the read-only fields match.
  const [saved, setSaved] = useState({
    username: initialUsername,
    fullName: initialFullName,
    displayFullName: initialDisplayFullName,
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [changed, setChanged] = useState(false);
  // Either Edit button opens the same modal; focus goes back to the one used.
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  // The section sits inside the account form, and forms can't nest, so the
  // modal (with its own form) is portalled to <body> once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openFrom(e: React.MouseEvent<HTMLButtonElement>) {
    openButtonRef.current = e.currentTarget;
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
    setFieldErrors({});
    // Back to the saved values for next time.
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
    const username = formData.get("username")?.toString().trim() ?? "";
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const displayFullName = formData.get("display_full_name") === "true";

    const errors: FieldErrors = {
      username: validateUsername(username) ?? undefined,
      full_name: validateFullName(fullName) ?? undefined,
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSaving(true);
    let actionError: { message: string } | undefined;
    try {
      ({ error: actionError } = await actions.updateUsername(formData));
    } catch {
      actionError = { message: "Something went wrong. Please try again." };
    }
    setSaving(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }

    // AccountMenu's header avatar is seeded from this cache on the next page
    // load (see session.ts), so update it now rather than leave the old
    // name/letter up until the background /api/me fetch catches up.
    const base = getCachedMember() ?? {
      id: memberId,
      username: saved.username,
      full_name: saved.fullName,
      display_full_name: saved.displayFullName,
      avatar_url: avatarUrl,
    };
    setCachedMember({ ...base, id: memberId, username, full_name: fullName || null, display_full_name: displayFullName });

    setSaved({ username, fullName: fullName || null, displayFullName });
    onSaved?.({ username, fullName: fullName || null, displayFullName });
    setChanged(true);
    setOpen(false);
  }

  return (
    <>
      {/* Display only, with no names, so the account form doesn't submit them. */}
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="current-username">Username</label>
        <div className="cnf-form__input-row cnf-form__input-row--inline">
          <input id="current-username" type="text" className="cnf-form__input cnf-form__input--readonly" value={saved.username} readOnly />
          <button type="button" className="cnf-button cnf-button__secondary" onClick={openFrom}>
            {/* Screen readers still hear "Edit username" out of context. */}
            <span className="cnf-button__text">Edit<span className="cnf-visually-hidden"> username</span></span>
          </button>
        </div>
      </div>
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="current-full-name">Full name</label>
        <div className="cnf-form__input-row cnf-form__input-row--inline">
          <input
            id="current-full-name"
            type="text"
            className="cnf-form__input cnf-form__input--readonly"
            value={saved.fullName ?? ""}
            placeholder="Not set"
            readOnly
          />
          <button type="button" className="cnf-button cnf-button__secondary" onClick={openFrom}>
            <span className="cnf-button__text">Edit<span className="cnf-visually-hidden"> full name</span></span>
          </button>
        </div>
        {saved.fullName && saved.displayFullName && <p className="cnf-form__hint">Shown instead of your username.</p>}
      </div>
      {/* The live region stays put; the message only appears once there's
          something to say, so screen readers announce it. */}
      <div className="cnf-form__status" role="status">
        {changed && <p className="cnf-form__message--success">Your name is updated.</p>}
      </div>

      {mounted && createPortal(
      <Modal isOpen={open} onClose={close} labelledBy={titleId} returnFocusRef={openButtonRef}>
        <h2 id={titleId}>Edit your name</h2>
        {/* Keyed on the saved values so reopening starts from them. */}
        <form key={`${saved.username}|${saved.fullName}|${saved.displayFullName}`} ref={formRef} className="cnf-form" onSubmit={handleSubmit} noValidate>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              name="username"
              className="cnf-form__input"
              defaultValue={saved.username}
              required
              onChange={handleChange}
              aria-invalid={!!fieldErrors.username}
            />
            <p className="cnf-form__hint">3-20 characters: letters, numbers, and underscores only.</p>
            {fieldErrors.username && <div className="cnf-form__message--error">{fieldErrors.username}</div>}
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              type="text"
              name="full_name"
              className="cnf-form__input"
              defaultValue={saved.fullName ?? ""}
              onChange={handleChange}
              aria-invalid={!!fieldErrors.full_name}
            />
            {fieldErrors.full_name && <div className="cnf-form__message--error">{fieldErrors.full_name}</div>}
          </div>

          <div className="cnf-form__group">
            <Checkbox
              id="display_full_name"
              name="display_full_name"
              value="true"
              defaultChecked={saved.displayFullName}
              label="Show my full name instead of my username"
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
