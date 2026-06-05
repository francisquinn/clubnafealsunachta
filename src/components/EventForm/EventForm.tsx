import { useState, useEffect } from "react";
import { actions } from "astro:actions";

type Location = { id: number; name: string };
type Venue = { id: number; name: string; url: string | null; location_id: number };

const NEW_VENUE = "__new__";
const DEFAULT_MEETING_URL = import.meta.env.PUBLIC_DEFAULT_MEETING_URL || '';

export type EventFormInitialData = {
  name: string;
  date: string;
  locationId?: number;
  slug: string;
  venueId?: number;
  locationName?: string;
  locationUrl?: string;
  meetingUrl?: string;
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
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">(
    initialData?.locationId ?? ""
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    initialData?.venueId ? String(initialData.venueId) : ""
  );

  useEffect(() => {
    actions.getLocations().then(({ data }) => {
      if (data) setLocations(data);
    });
    actions.getVenues().then(({ data }) => {
      if (data) setVenues(data);
      setVenuesLoading(false);
    });
  }, []);

  const isOnline = locations.find((l) => l.id === selectedLocationId)?.name === "Online";
  const locationVenues = venues.filter((v) => v.location_id === selectedLocationId);
  const isNewVenue = selectedVenueId === NEW_VENUE;
  const selectedVenue = venues.find((v) => String(v.id) === selectedVenueId);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

    if (selectedVenue && !isNewVenue) {
      formData.set("location_name", selectedVenue.name);
      formData.set("location_url", selectedVenue.url ?? "");
    }

    try {
      const action = mode === "edit" ? actions.updateEvent : actions.createEvent;
      const { error, data } = await action(formData);

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data?.success) {
        setStatus("success");
        if (mode === "create") {
          setSelectedLocationId("");
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
      return <p>Event updated successfully!</p>;
    }
    return <p>Event created successfully!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="cnf-form">
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
        <label className="cnf-form__label" htmlFor="location">
          Location
        </label>
        <select
          className="cnf-form__input"
          id="location"
          name="location_id"
          value={selectedLocationId}
          onChange={(e) => {
            setSelectedLocationId(e.target.value ? Number(e.target.value) : "");
            setSelectedVenueId("");
          }}
        >
          <option value="">— select —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {isOnline ? (
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="meeting_url">
            Meeting URL
          </label>
          <input
            className="cnf-form__input"
            type="url"
            id="meeting_url"
            name="meeting_url"
            defaultValue={initialData?.meetingUrl ?? DEFAULT_MEETING_URL}
          />
        </div>
      ) : selectedLocationId ? (
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
              {locationVenues.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                </option>
              ))}
              <option value={NEW_VENUE}>New venue...</option>
            </select>
          )}
        </div>
      ) : null}

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
