import { useState } from "react";
import { actions } from "astro:actions";
import { validateUsername, validatePassword } from "../../utils/validation";
import { isValidEmail } from "../../utils/script";
import Checkbox from "../Checkbox/Checkbox";
import "../../styles/form.css";

interface SignupFormProps {
  onSwitchToLogin?: (email: string) => void;
  isAdmin?: boolean;
}

type FieldName = "username" | "email" | "password" | "confirm_password";
type FieldErrors = Partial<Record<FieldName, string>>;

export default function SignupForm({ onSwitchToLogin, isAdmin = false }: SignupFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as FieldName;
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username")?.toString() ?? "";
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirm_password")?.toString() ?? "";

    const errors: FieldErrors = {
      username: validateUsername(username) ?? undefined,
      email: isValidEmail(email) ? undefined : "Enter a valid email address",
      password: validatePassword(password) ?? undefined,
      confirm_password: password === confirmPassword ? undefined : "Passwords do not match",
    };
    setFieldErrors(errors);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setStatus("loading");

    try {
      const { error, data } = isAdmin ? await actions.createMember(formData) : await actions.signup(formData);

      if (error) {
        setErrorMessage(error.message);
        setStatus("error");
        return;
      }

      if (data?.success) {
        setSubmittedEmail(email);
        setStatus("success");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    if (isAdmin) {
      return <p>Member added successfully.</p>;
    }
    return (
      <div>
        <p>Account created successfully. Check your email to confirm your address, then log in.</p>
        <button
          type="button"
          className="cnf-modal__link"
          onClick={() => onSwitchToLogin?.(submittedEmail)}
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label={isAdmin ? "Create member form" : "Become a member form"} noValidate>
      {errorMessage && <div className="cnf-form__message--error">{errorMessage}</div>}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          type="text"
          name="username"
          className="cnf-form__input"
          required
          autoComplete="username"
          onChange={handleChange}
          aria-invalid={!!fieldErrors.username}
        />
        <p className="cnf-form__hint">3-20 characters: letters, numbers, and underscores only.</p>
        {fieldErrors.username && <div className="cnf-form__message--error">{fieldErrors.username}</div>}
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          name="email"
          className="cnf-form__input"
          required
          autoComplete="email"
          onChange={handleChange}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email && <div className="cnf-form__message--error">{fieldErrors.email}</div>}
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          name="password"
          className="cnf-form__input"
          required
          autoComplete="new-password"
          onChange={handleChange}
          aria-invalid={!!fieldErrors.password}
        />
        <p className="cnf-form__hint">At least 8 characters, with a number and an uppercase letter.</p>
        {fieldErrors.password && <div className="cnf-form__message--error">{fieldErrors.password}</div>}
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="signup-confirm-password">Confirm password</label>
        <input
          id="signup-confirm-password"
          type="password"
          name="confirm_password"
          className="cnf-form__input"
          required
          autoComplete="new-password"
          onChange={handleChange}
          aria-invalid={!!fieldErrors.confirm_password}
        />
        {fieldErrors.confirm_password && <div className="cnf-form__message--error">{fieldErrors.confirm_password}</div>}
      </div>

      {isAdmin && (
        <div className="cnf-form__group">
          <Checkbox id="signup-is-admin" name="is_admin" value="true" label="Admin" />
        </div>
      )}

      {!isAdmin && (
        <p className="cnf-form__hint">
          By joining, you agree to our <a href="/privacy">Privacy Policy</a>.
        </p>
      )}

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">{isAdmin ? "Add member" : "Join"}</span>
      </button>
    </form>
  );
}
