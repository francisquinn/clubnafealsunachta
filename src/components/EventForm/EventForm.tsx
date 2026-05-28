import { useState, useEffect } from "react";
import { actions } from "astro:actions";
import { CITY } from "../../types/types";
import type { City } from "../../types/types";

type Venue = { id: number; name: string; url: string | null; city: string };

const NEW_VENUE = "__new__";

export type EventFormInitialData = {
  name: string;
  date: string; // datetime-local format e.g. "2025-06-01T19:00"
  city: string;
  slug: string;
  venueId?: number;
  locationName?: string;
  locationUrl?: string;
  instagram?: string;
  facebook?: string;
  meetup?: string;
  description?: string;
  summary?: string;
};

type EventFormProps = {
  mode: "create" | "edit";
  initialData?: EventFormInitialData;
};

export default function EventForm({ mode, initialData }: EventFormProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [city, setCity] = useState<City>(
    (initialData?.city as City) ?? CITY.TRIESTE
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    initialData?.venueId ? String(initialData.venueId) : ""
  );

  useEffect(() => {
    actions.getVenues().then(({ data }) => {
      if (data) setVenues(data);
      setVenuesLoading(false);
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
      const action =
        mode === "edit" ? actions.updateEvent : actions.createEvent;
      const { error, data } = await action(formData);

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data?.success) {
        setStatus("success");
        if (mode === "create") {
          setCity(CITY.TRIESTE);
          setSelectedVenueId("");
          const form = e.currentTarget as HTMLFormElement;
          if (form) form.reset();
        }
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "success") {
    if (mode === "edit") {
      return (
        <>
          <p>Event updated successfully!</p>
          <a href="/admin/events">Back to events</a>
        </>
      );
    }
    return (
      <>
        <p>Event created successfully!</p>
        <a href="/events">See all events</a>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="cnf-form">
      {/* Hidden slug input for edit mode — carries the identifier for the action */}
      {mode === "edit" && (
        <input type="hidden" name="slug" value={initialData?.slug ?? ""} />
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="name">
          Title *
        </label>
        <input
          className="cnf-form__input"
          type="text"
          id="name"
          name="name"
          defaultValue={initialData?.name}
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
          defaultValue={initialData?.date}
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
        {venuesLoading ? (
          <select className="cnf-form__input" id="venue_select" disabled>
            <option>Loading venues…</option>
          </select>
        ) : (
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
        )}
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
              defaultValue={initialData?.locationName}
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
              defaultValue={initialData?.locationUrl}
            />
          </div>
        </>
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor={mode === "edit" ? "slug-display" : "slug"}>
          URL slug {mode === "create" && "*"}
        </label>
        {mode === "create" ? (
          <>
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
          </>
        ) : (
          <>
            <input
              className="cnf-form__input"
              type="text"
              id="slug-display"
              defaultValue={initialData?.slug ?? ""}
              readOnly
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            />
            <small className="cnf-form__hint">
              Slug cannot be changed after creation.
            </small>
          </>
        )}
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
          defaultValue={initialData?.instagram ?? ""}
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
          defaultValue={initialData?.facebook ?? ""}
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
          defaultValue={initialData?.meetup ?? ""}
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
          defaultValue={initialData?.description ?? ""}
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
          defaultValue={initialData?.summary ?? ""}
        />
      </div>

      {status === "error" && (
        <div className="cnf-form__message--error">{errorMessage}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading" || venuesLoading}
        aria-busy={status === "loading"}
        className={`cnf-form__submit cnf-button cnf-button__gold ${status === "loading" ? "cnf-button--loading" : ""}`}
      >
        <span className="cnf-button__text">
          {mode === "edit" ? "Save changes" : "Create"}
        </span>
      </button>
    </form>
  );
}
