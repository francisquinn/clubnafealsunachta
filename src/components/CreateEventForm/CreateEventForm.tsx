import { useState, useEffect } from "react";
import { actions } from "astro:actions";
import { CITY } from "../../types/types";
import type { City } from "../../types/types";

type Venue = { id: number; name: string; url: string | null; city: string };

const NEW_VENUE = "__new__";

export default function CreateEventForm() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [city, setCity] = useState<City>(CITY.TRIESTE);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  useEffect(() => {
    actions.getVenues().then(({ data }) => {
      if (data) setVenues(data);
    });
  }, []);

  const cityVenues = venues.filter((v) => v.city === city);
  const isNewVenue = selectedVenueId === NEW_VENUE;
  const selectedVenue = venues.find((v) => String(v.id) === selectedVenueId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

    if (selectedVenue && !isNewVenue) {
      formData.set("location_name", selectedVenue.name);
      formData.set("location_url", selectedVenue.url ?? "");
    }

    try {
      const { error, data } = await actions.createEvent(formData);

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data?.success) {
        setStatus("success");
        setCity(CITY.TRIESTE);
        setSelectedVenueId("");
        const form = e.currentTarget as HTMLFormElement;
        if (form) form.reset();
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "success") {
    return (
      <>
        <p>Event created successfully!</p>
        <a href="/events">See all events</a>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="cnf-form">
      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="name">
          Title *
        </label>
        <input
          className="cnf-form__input"
          type="text"
          id="name"
          name="name"
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="date">
          Date & Time *
        </label>
        <input
          className="cnf-form__input"
          type="datetime-local"
          id="date"
          name="date"
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="city">
          City
        </label>
        <select
          className="cnf-form__input"
          id="city"
          name="city"
          value={city}
          onChange={(e) => {
            setCity(e.target.value as City);
            setSelectedVenueId("");
          }}
        >
          {Object.values(CITY).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="venue_select">
          Venue
        </label>
        <select
          className="cnf-form__input"
          id="venue_select"
          value={selectedVenueId}
          onChange={(e) => setSelectedVenueId(e.target.value)}
        >
          <option value="">— none —</option>
          {cityVenues.map((v) => (
            <option key={v.id} value={String(v.id)}>
              {v.name}
            </option>
          ))}
          <option value={NEW_VENUE}>New venue...</option>
        </select>
      </div>

      {isNewVenue && (
        <>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="location_name">
              Name
            </label>
            <input
              className="cnf-form__input"
              type="text"
              id="location_name"
              name="location_name"
            />
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="location_url">
              Location URL (Google Maps)
            </label>
            <input
              className="cnf-form__input"
              type="url"
              id="location_url"
              name="location_url"
            />
          </div>
        </>
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="slug">
          URL slug *
        </label>
        <input
          className="cnf-form__input"
          type="text"
          id="slug"
          name="slug"
          placeholder="my-event-name"
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers and hyphens only"
          required
        />
        <small className="cnf-form__hint">
          Used in URL: /events/my-event-name
        </small>
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="instagram">
          Instagram URL
        </label>
        <input
          className="cnf-form__input"
          type="url"
          id="instagram"
          name="instagram"
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="facebook">
          Facebook URL
        </label>
        <input
          className="cnf-form__input"
          type="url"
          id="facebook"
          name="facebook"
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="meetup">
          Meetup URL
        </label>
        <input
          className="cnf-form__input"
          type="url"
          id="meetup"
          name="meetup"
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="description">
          Description
        </label>
        <textarea
          className="cnf-form__input"
          id="description"
          name="description"
          rows={4}
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="summary">
          Summary
        </label>
        <textarea
          className="cnf-form__input"
          id="summary"
          name="summary"
          rows={3}
        />
      </div>

      {status === "error" && (
        <div className="cnf-form__message--error">{errorMessage}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        className={`cnf-form__submit cnf-button cnf-button__gold ${status === "loading" ? "cnf-button--loading" : ""}`}
      >
        <span className="cnf-button__text">Create</span>
      </button>
    </form>
  );
}
