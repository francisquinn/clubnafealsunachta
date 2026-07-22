import { useEffect, useState } from "react";
import "../../styles/form.css";

interface LoginFormProps {
  defaultIdentifier?: string;
  onSuccess?: () => void;
}

export default function LoginForm({ defaultIdentifier = "", onSuccess = () => { window.location.href = "/profile"; } }: LoginFormProps) {
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIdentifier(defaultIdentifier);
  }, [defaultIdentifier]);

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
        onSuccess?.();
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
      </div>

      <button type="submit" disabled={loading} aria-busy={loading} className={`cnf-form__submit cnf-button cnf-button__gold${loading ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Log in</span>
      </button>
    </form>
  );
}
