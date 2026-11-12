import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import "../../styles/form.css";

interface LoginFormProps {
  defaultIdentifier?: string;
  onSuccess?: () => void;
  // Swaps the login modal to its forgot-password view.
  onForgotPassword?: () => void;
}

export default function LoginForm({ defaultIdentifier = "", onSuccess = () => { window.location.href = "/profile"; }, onForgotPassword }: LoginFormProps) {
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set when login is refused because the email isn't confirmed yet.
  const [unverified, setUnverified] = useState(false);
  const [resend, setResend] = useState<"idle" | "loading" | "sent">("idle");

  useEffect(() => {
    setIdentifier(defaultIdentifier);
  }, [defaultIdentifier]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setResend("idle");
    setLoading(true);

    const form = e.currentTarget;
    const body = new FormData(form);

    try {
      const res = await fetch("/api/login", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setUnverified(data.unverified === true);
      } else {
        onSuccess?.();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResend("loading");
    const formData = new FormData();
    formData.set("identifier", identifier);
    try {
      const { error: actionError } = await actions.resendVerification(formData);
      if (actionError) {
        setError(actionError.message);
        setResend("idle");
        return;
      }
      setResend("sent");
    } catch {
      setError("Something went wrong");
      setResend("idle");
    }
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Login form">
      {error && (
        <div className="cnf-form__message--error">{error}</div>
      )}

      {unverified && (
        resend === "sent" ? (
          <p className="cnf-form__hint" role="status">Check your inbox: a new confirmation link is on its way, unless we sent you one in the last 5 minutes.</p>
        ) : (
          <p className="cnf-form__hint">
            Link expired or never arrived?{" "}
            <button type="button" className="cnf-modal__link" onClick={handleResend} disabled={resend === "loading"}>
              {resend === "loading" ? "Sending…" : "Send a new link"}
            </button>
          </p>
        )
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="identifier">Email or username</label>
        <input
          id="identifier"
          type="text"
          name="identifier"
          className="cnf-form__input"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          name="password"
          className="cnf-form__input"
          required
          autoComplete="current-password"
        />
        {onForgotPassword && (
          <p className="cnf-form__hint">
            <button type="button" className="cnf-modal__link" onClick={onForgotPassword}>Forgot your password?</button>
          </p>
        )}
      </div>

      <button type="submit" disabled={loading} aria-busy={loading} className={`cnf-form__submit cnf-button cnf-button__gold${loading ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Log in</span>
      </button>
    </form>
  );
}
