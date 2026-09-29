import { useState } from "react";
import { actions } from "astro:actions";
import { validatePassword } from "../../utils/validation";
import "../../styles/form.css";

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("new_password")?.toString() ?? "";
    const confirm = formData.get("confirm_password")?.toString() ?? "";

    const validationError = validatePassword(password) ?? (password === confirm ? null : "Passwords do not match");
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("loading");
    try {
      const { error: actionError } = await actions.resetPassword(formData);
      if (actionError) {
        setError(actionError.message);
        setStatus("idle");
        return;
      }
      setStatus("success");
    } catch {
      setError("Something went wrong");
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <div>
        <p>Your password has been reset. You can now log in with it.</p>
        <p><a href="/">Back to homepage</a></p>
      </div>
    );
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Reset password form" noValidate>
      {error && <div className="cnf-form__message--error">{error}</div>}

      <input type="hidden" name="token" value={token} />

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="reset-new-password">New password</label>
        <input
          id="reset-new-password"
          type="password"
          name="new_password"
          className="cnf-form__input"
          required
          autoComplete="new-password"
        />
        <p className="cnf-form__hint">At least 8 characters, with a number and an uppercase letter.</p>
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="reset-confirm-password">Confirm new password</label>
        <input
          id="reset-confirm-password"
          type="password"
          name="confirm_password"
          className="cnf-form__input"
          required
          autoComplete="new-password"
        />
      </div>

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Reset password</span>
      </button>
    </form>
  );
}
