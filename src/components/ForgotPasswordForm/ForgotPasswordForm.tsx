import { useState } from "react";
import { actions } from "astro:actions";
import { isValidEmail } from "../../utils/script";
import "../../styles/form.css";

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    if (!isValidEmail(formData.get("email")?.toString() ?? "")) {
      setError("Enter a valid email address");
      return;
    }

    setStatus("loading");
    try {
      const { error: actionError } = await actions.requestPasswordReset(formData);
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
        <p>If there's a confirmed account for that email, we've sent a link to reset your password. It expires in 1 hour.</p>
        <p>
          <button type="button" className="cnf-modal__link" onClick={onBackToLogin}>Back to login</button>
        </p>
      </div>
    );
  }

  return (
    <>
      <form className="cnf-form" onSubmit={handleSubmit} aria-label="Forgot password form" noValidate>
        {error && <div className="cnf-form__message--error">{error}</div>}

        <p className="cnf-form__intro">Enter your email and we'll send you a link to choose a new password.</p>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            name="email"
            className="cnf-form__input"
            required
            autoComplete="email"
          />
        </div>

        <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
          <span className="cnf-button__text">Send reset link</span>
        </button>
      </form>
      <p className="cnf-modal__footer">
        Remembered it?{" "}
        <button type="button" className="cnf-modal__link" onClick={onBackToLogin}>
          Login
        </button>
      </p>
    </>
  );
}
