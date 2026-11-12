import { useState } from "react";
import { actions } from "astro:actions";
import { isValidEmail } from "../../utils/script";
import "../../styles/form.css";

interface ResendVerificationFormProps {
  // Prefilled from an expired link, which still names the address it was for.
  defaultEmail?: string;
}

export default function ResendVerificationForm({ defaultEmail = "" }: ResendVerificationFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    if (!isValidEmail(formData.get("identifier")?.toString() ?? "")) {
      setError("Enter a valid email address");
      return;
    }

    setStatus("loading");
    try {
      const { error: actionError } = await actions.resendVerification(formData);
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
    return <p className="cnf-form__message--success" role="status">If that email belongs to an account waiting to be confirmed, we've sent a new link. It expires in 3 days.</p>;
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Resend confirmation form" noValidate>
      {error && <div className="cnf-form__message--error">{error}</div>}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="resend-email">Email</label>
        <input
          id="resend-email"
          type="email"
          name="identifier"
          className="cnf-form__input"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
        />
      </div>

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Send a new link</span>
      </button>
    </form>
  );
}
