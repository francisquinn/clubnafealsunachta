import { useState } from "react";
import { actions } from "astro:actions";
import { validateUsername, validateFullName, validatePassword } from "../../utils/validation";
import Checkbox from "../Checkbox/Checkbox";
import "../../styles/form.css";

type FieldName = "username" | "full_name" | "current_password" | "new_password" | "confirm_password";
type FieldErrors = Partial<Record<FieldName, string>>;

interface Props {
  initialUsername: string;
  initialFullName: string | null;
  initialDisplayFullName: boolean;
}

export default function AccountForm({ initialUsername, initialFullName, initialDisplayFullName }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as FieldName;
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username")?.toString().trim() ?? "";
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const currentPassword = formData.get("current_password")?.toString() ?? "";
    const newPassword = formData.get("new_password")?.toString() ?? "";
    const confirmPassword = formData.get("confirm_password")?.toString() ?? "";

    // A filled-in "new password" is what signals intent to change the password, not
    // "current password" — password managers autofill current-password fields on page
    // load, which would otherwise make an untouched form look like a password-change
    // attempt.
    const wantsPasswordChange = newPassword !== "";

    const errors: FieldErrors = {
      username: validateUsername(username) ?? undefined,
      full_name: validateFullName(fullName) ?? undefined,
      current_password: wantsPasswordChange && !currentPassword ? "Enter your current password" : undefined,
      new_password: wantsPasswordChange ? validatePassword(newPassword) ?? undefined : undefined,
      confirm_password: wantsPasswordChange && newPassword !== confirmPassword ? "Passwords do not match" : undefined,
    };
    setFieldErrors(errors);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setStatus("loading");

    try {
      const [usernameResult, passwordResult] = await Promise.all([
        actions.updateUsername(formData),
        wantsPasswordChange ? actions.changePassword(formData) : Promise.resolve(null),
      ]);

      const usernameError = usernameResult.error?.message ?? null;
      const passwordError = wantsPasswordChange ? passwordResult?.error?.message ?? null : null;

      if (!usernameError && !passwordError) {
        setStatus("success");
        setMessage(wantsPasswordChange ? "Your info and password have been updated." : "Your info has been updated.");
        return;
      }

      setStatus("error");

      if (!wantsPasswordChange) {
        setMessage(usernameError);
        return;
      }

      if (!usernameError) {
        setMessage(`Your info has been updated. Password unchanged: ${passwordError}`);
      } else if (!passwordError) {
        setMessage(`Your password has been updated. Info unchanged: ${usernameError}`);
      } else {
        setMessage(`Info unchanged: ${usernameError} Password unchanged: ${passwordError}`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p>{message}</p>;
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Account settings form" noValidate>
      {message && <div className="cnf-form__message--error">{message}</div>}

      <fieldset className="cnf-form__fieldset">
        <legend className="cnf-visually-hidden">Profile details</legend>
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            className="cnf-form__input"
            defaultValue={initialUsername}
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
            defaultValue={initialFullName ?? ""}
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
            defaultChecked={initialDisplayFullName}
            label="Show my full name instead of my username"
          />
        </div>
      </fieldset>

      <fieldset className="cnf-form__fieldset">
        <legend>Change password</legend>

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
          <p className="cnf-form__hint">Leave these blank to keep your current password.</p>
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
      </fieldset>

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Save</span>
      </button>
    </form>
  );
}
