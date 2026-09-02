import { useState } from "react";
import { actions } from "astro:actions";
import Checkbox from "../Checkbox/Checkbox";
import "../../styles/form.css";

interface ClubSubscriptionsProps {
  clubs: { id: number; name: string }[];
  initialClubIds: number[];
}

export default function ClubSubscriptions({ clubs, initialClubIds }: ClubSubscriptionsProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setStatus("loading");

    const formData = new FormData(e.currentTarget);

    try {
      const result = await actions.updateClubMemberships(formData);
      if (result.error) {
        setStatus("error");
        setMessage(result.error.message);
        return;
      }
      setStatus("success");
      setMessage("Your club subscriptions have been updated.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Club subscriptions form" noValidate>
      {status === "success" && message && <p role="status">{message}</p>}
      {status === "error" && message && (
        <div className="cnf-form__message--error" role="alert" aria-live="polite">{message}</div>
      )}

      <fieldset className="cnf-form__fieldset">
        <legend>Club subscriptions</legend>

        <p className="cnf-form__hint">
          Choose which clubs you want to receive news and updates from. You can still browse events and RSVP from any
          club, subscribed or not.
        </p>

        <div className="cnf-form__group">
          {clubs.map((club) => (
            <Checkbox
              key={club.id}
              id={`club-${club.id}`}
              name="club_id"
              value={String(club.id)}
              defaultChecked={initialClubIds.includes(club.id)}
              label={club.name}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}
      >
        <span className="cnf-button__text">Save subscriptions</span>
      </button>
    </form>
  );
}