import { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import LoginForm from "../LoginForm/LoginForm";
import ForgotPasswordForm from "../ForgotPasswordForm/ForgotPasswordForm";
import SignupForm from "../SignupForm/SignupForm";
import { fetchSessionInfo, refreshSessionInfo } from "../../utils/session";

type View = "login" | "signup" | "forgot";

// The visible Login/Logout toggle is plain static markup in Header.astro, shown/hidden
// by a synchronous inline script (see BaseLayout's <head>) that reads a cookie hint
// before first paint - it can't depend on this island's hydration timing without
// flashing on every page load. This component only owns the modal: it wires a click
// handler onto the static "Login" trigger, and reconciles the hint against the real
// session in the background in case it drifted (e.g. a session revoked without
// hitting /api/logout).
export default function LoginButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("login");
  const [prefillEmail, setPrefillEmail] = useState("");

  useEffect(() => {
    function openModal() {
      setView("login");
      setPrefillEmail("");
      setIsOpen(true);
    }

    const trigger = document.getElementById("cnf-login-trigger");
    trigger?.addEventListener("click", openModal);

    // Middleware sends logged-out visitors to a gated page here as /?login=1.
    // Open the modal for them, then drop the param so a refresh (or a shared
    // link) doesn't reopen it.
    const url = new URL(window.location.href);
    if (url.searchParams.has("login")) {
      openModal();
      url.searchParams.delete("login");
      window.history.replaceState(null, "", url);
    }

    applySessionInfo(fetchSessionInfo());

    function reconcile() {
      applySessionInfo(refreshSessionInfo());
    }
    window.addEventListener("pageshow", reconcile);

    return () => {
      trigger?.removeEventListener("click", openModal);
      window.removeEventListener("pageshow", reconcile);
    };
  }, []);

  function applySessionInfo(info: ReturnType<typeof fetchSessionInfo>) {
    info.then((data) => {
      document.documentElement.classList.toggle("cnf-logged-in", data.loggedIn);
      document.documentElement.classList.toggle("cnf-logged-out", !data.loggedIn);
    });
  }

  function handleSignupSuccess(email: string) {
    setPrefillEmail(email);
    setView("login");
  }

  function handleLoginSuccess() {
    window.location.reload();
  }

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      {view === "login" ? (
        <>
          <h2>Login</h2>
          <LoginForm defaultIdentifier={prefillEmail} onSuccess={handleLoginSuccess} onForgotPassword={() => setView("forgot")} />
          <p className="cnf-modal__footer">
            Not a member yet?{" "}
            <button type="button" className="cnf-modal__link" onClick={() => setView("signup")}>
              Become a member
            </button>
          </p>
        </>
      ) : view === "forgot" ? (
        <>
          <h2>Forgot password</h2>
          <ForgotPasswordForm onBackToLogin={() => setView("login")} />
        </>
      ) : (
        <>
          <h2>Become a member</h2>
          <SignupForm onSwitchToLogin={handleSignupSuccess} />
          <p className="cnf-modal__footer">
            Already a member?{" "}
            <button type="button" className="cnf-modal__link" onClick={() => setView("login")}>
              Login
            </button>
          </p>
        </>
      )}
    </Modal>
  );
}
