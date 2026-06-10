import { useState } from "react";
import { actions } from "astro:actions";
import "../../styles/form.css";

export default function SignupForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setStatus("loading");

    const formData = new FormData(e.currentTarget);

    try {
      const { error, data } = await actions.createUser(formData);

      if (error) {
        setErrorMessage(error.message);
        setStatus("error");
        return;
      }

      if (data?.success) {
        setStatus("success");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p>Account created successfully.</p>;
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Create user form">
      {errorMessage && <div className="cnf-form__message--error">{errorMessage}</div>}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          className="cnf-form__input"
          required
          autoComplete="off"
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
          autoComplete="new-password"
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="confirm_password">Confirm password</label>
        <input
          id="confirm_password"
          type="password"
          name="confirm_password"
          className="cnf-form__input"
          required
          autoComplete="new-password"
        />
      </div>

      <div className="cnf-form__group cnf-form__group--inline">
        <input id="is_admin" type="checkbox" name="is_admin" value="true" />
        <label className="cnf-form__label" htmlFor="is_admin">Admin</label>
      </div>

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Create account</span>
      </button>
    </form>
  );
}
