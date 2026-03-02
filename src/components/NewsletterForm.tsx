import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import "../styles/form.css";

export default function NewsletterForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => localStorage.removeItem("newsletter_subscribed"), []);

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
          className={`cnf-form__submit cnf-button cnf-button__gold ${isLoading && 'cnf-button--loading'}`}
        >
          <span className="cnf-button__text">Subscribe</span>
        </button>
      </form>
    );
  }

  return (
    <>
      {!isFormSubmitted ? (
        renderForm()
      ) : (
        <>
          <p className="cnf-form__message--success">{successMessage}</p>
        </>
      )}
    </>
  );
}
