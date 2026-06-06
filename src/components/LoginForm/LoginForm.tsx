import { useState } from "react";
import "../../styles/form.css";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const body = new FormData(form);

    try {
      const res = await fetch("/api/login", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        window.location.href = "/admin";
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Login form">
      {error && (
        <div className="cnf-form__message--error">{error}</div>
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          className="cnf-form__input"
          required
          autoComplete="email"
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
      </div>

      <button type="submit" className="cnf-form__submit cnf-button cnf-button__gold" disabled={loading}>
        <span className="cnf-button__text">{loading ? "Logging in…" : "Log in"}</span>
      </button>
    </form>
  );
}
