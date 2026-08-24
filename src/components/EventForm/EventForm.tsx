import { useState, useEffect } from "react";
import { actions } from "astro:actions";
import Checkbox from "../Checkbox/Checkbox";
import { DEFAULT_CLUB_SLUG } from "../../lib/clubDefaults";

type Club = { id: number; name: string };
type Venue = { id: number; name: string; url: string | null };

const NEW_VENUE = "__new__";
const DEFAULT_MEETING_URL = import.meta.env.PUBLIC_DEFAULT_MEETING_URL || '';

export type EventFormInitialData = {
  name: string;
  date: string;
  slug: string;
  isOnline?: boolean;
  venueId?: number;
  eventClubId?: number;
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
  isSuperAdmin: boolean;
};

export default function EventForm({ mode, initialData, isSuperAdmin }: EventFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(initialData?.isOnline ?? false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    initialData?.venueId ? String(initialData.venueId) : ""
  );

  useEffect(() => {
    actions.getClubs().then(({ data }) => {
      if (data) setClubs(data);
    });
    actions.getVenues().then(({ data }) => {
      if (data) setVenues(data);
      setVenuesLoading(false);
    });
  }, []);

  const isNewVenue = selectedVenueId === NEW_VENUE;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

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
        <Checkbox
          id="is_online"
          name="is_online"
          value="true"
          label="This event is online"
          defaultChecked={initialData?.isOnline}
          onChange={(e) => setIsOnline(e.target.checked)}
        />
      </div>

      {isOnline ? (
        <>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="event_club_id">
              Hosting club
            </label>
            <select
              className="cnf-form__input"
              id="event_club_id"
              name="event_club_id"
              defaultValue={initialData?.eventClubId ? String(initialData.eventClubId) : ""}
              required={!isSuperAdmin}
            >
              {isSuperAdmin && <option value="">No specific chapter</option>}
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <small className="cnf-form__hint">
              Which chapter is organizing this event.
            </small>
          </div>

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
        </>
      ) : (
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="venue_select">
            Venue *
          </label>
          {venuesLoading ? (
            <select className="cnf-form__input" id="venue_select" disabled>
              <option>Loading venues…</option>
            </select>
          ) : (
            <select
              className="cnf-form__input"
              id="venue_select"
              name="venue_id"
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              required
            >
              <option value="">Select a venue</option>
              {venues.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                </option>
              ))}
              <option value={NEW_VENUE}>New venue</option>
            </select>
          )}
        </div>
      )}

      {!isOnline && isNewVenue && (
        <>
          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="location_name">
              Venue name *
            </label>
            <input
              className="cnf-form__input"
              type="text"
              id="location_name"
              name="location_name"
              required
            />
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="club_id">
              Club *
            </label>
            <select className="cnf-form__input" id="club_id" name="club_id" required>
              <option value="">Select a club</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cnf-form__group">
            <label className="cnf-form__label" htmlFor="location_url">
              Location URL (Google Maps) *
            </label>
            <input
              className="cnf-form__input"
              type="url"
              id="location_url"
              name="location_url"
              required
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
              {/* #39: the form doesn't yet know which club's page this will land
                  on (an existing venue's club isn't exposed to the client, and
                  there's only one real club to preview anyway) — DEFAULT_CLUB_SLUG
                  is a deliberate placeholder, not a guarantee, until a real
                  club picker exists here. */}
              Used in URL: /{DEFAULT_CLUB_SLUG}/events/my-event-name
            </small>
          </>
        ) : (
          <>
            <input
              className="cnf-form__input cnf-form__input--readonly"
              type="text"
              id="slug-display"
              defaultValue={initialData?.slug ?? ""}
              readOnly
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
