import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import "../styles/newsletter.css";

export default function Newsletter() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const LOCALSTORAGE_KEY = "newsletter_subscribed";

  useEffect(() => {
    setIsSubscribed(Boolean(localStorage.getItem(LOCALSTORAGE_KEY)));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    const email = emailRef.current?.value.trim();

    if (!formRef.current?.checkValidity()) {
      setIsLoading(false);
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(email),
    });

    const data = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setErrorMessage(data.message);
      setSuccessMessage(null);
    } else {
      localStorage.setItem(LOCALSTORAGE_KEY, "true");
      setSuccessMessage(data.message);
      setIsFormSubmitted(true);
      setErrorMessage(null);
    }
  }

  function onChange(): void {
    setErrorMessage(null);
  }

  function renderForm(): JSX.Element {
    return (
      <form className="cnf-form" noValidate onSubmit={onSubmit} ref={formRef}>
        <input
          type="email"
          name="email"
          className="cnf-form__input"
          placeholder="Enter your email"
          required
          onChange={onChange}
          ref={emailRef}
        />
        <div className="cnf-form__message--error">{errorMessage}</div>
        <button
          type="submit"
          disabled={isLoading}
          className={`cnf-button cnf-button__primary cnf-button--compact ${isLoading && 'cnf-button--loading'}`}
        >
          <span className="cnf-button__text">Subscribe</span>
        </button>
      </form>
    );
  }

  return (
    <>
      {!isSubscribed && (
        <section className="cnf-section" style={{ textAlign: "center" }}>
          <h3>Subscribe to the newsletter!</h3>
          <p className="cnf-newsletter__description">Stay up to date with events, blog posts and updates.</p>
          {!isFormSubmitted ? (
            renderForm()
          ) : (
            <>
              <div className="cnf-form__message--success">{successMessage}</div>
            </>
          )}
        </section>
      )}
    </>
  );
}
