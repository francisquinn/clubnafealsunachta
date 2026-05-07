import { useState } from "react";
import { isValidEmail } from "../../utils/script";
import "../../styles/form.css";

class ApiError extends Error {}

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data.message);
      }

      setSuccessMessage(data.message);
      setIsFormSubmitted(true);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isFormSubmitted) {
    return <p>{successMessage}</p>;
  }

  return (
    <form className="cnf-form" onSubmit={onSubmit} aria-label="Contact form">
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          name="name"
          className="cnf-form__input"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrorMessage(null); }}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          className="cnf-form__input"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrorMessage(null); }}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          className="cnf-form__input"
          rows={6}
          value={message}
          onChange={(e) => { setMessage(e.target.value); setErrorMessage(null); }}
          required
        />
      </div>

      <div className="cnf-form__honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {errorMessage && <p className="cnf-form__message--error">{errorMessage}</p>}

      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className={`cnf-form__submit cnf-button cnf-button__gold ${isLoading ? "cnf-button--loading" : ""}`}
      >
        <span className="cnf-button__text">Send</span>
      </button>
    </form>
  );
}
