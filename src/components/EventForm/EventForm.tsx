import { useState, useEffect } from "react";
import { actions } from "astro:actions";
import Checkbox from "../Checkbox/Checkbox";
import TagPicker from "../TagPicker/TagPicker";
import { DEFAULT_CHAPTER_SLUG, ONLINE_CHAPTER_SLUG } from "../../lib/chapterDefaults";
import { slugify } from "../../lib/slugify";
import { MIN_TAGS } from "../../lib/eventTags";

type Chapter = { id: number; name: string; slug: string };
type Venue = { id: number; name: string; url: string | null };

const NEW_VENUE = "__new__";
const DEFAULT_MEETING_URL = import.meta.env.PUBLIC_DEFAULT_MEETING_URL || '';

export type EventFormInitialData = {
  name: string;
  date: string;
  endDate: string;
  slug: string;
  isOnline?: boolean;
  venueId?: number;
  meetingUrl?: string;
  meetPoint?: string;
  instagram?: string;
  facebook?: string;
  meetup?: string;
  description?: string;
  summary?: string;
  tags?: string[];
};

type EventFormProps = {
  mode: "create" | "edit";
  initialData?: EventFormInitialData;
};

export default function EventForm({ mode, initialData }: EventFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(initialData?.isOnline ?? false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    initialData?.venueId ? String(initialData.venueId) : ""
  );
  // #100: end time defaults to 20:00 on the same calendar day as the start
  // (the chapter's usual end time), re-derived from the start field until the
  // admin actually edits the end field themselves — an existing event being
  // edited keeps its own stored end time untouched from the start.
  const [endDate, setEndDate] = useState<string>(initialData?.endDate ?? "");
  const [endDateTouched, setEndDateTouched] = useState<boolean>(!!initialData?.endDate);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const datePart = e.target.value.split("T")[0];
    if (!endDateTouched && datePart) {
      setEndDate(`${datePart}T20:00`);
    }
  }

  // #94: auto-fill the slug from the title on create, re-deriving it as the
  // title changes until the admin edits the slug field themselves — same
  // touched-flag pattern as endDate above.
  const [slug, setSlug] = useState<string>(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState<boolean>(!!initialData?.slug);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) {
      setSlug(slugify(e.target.value));
    }
  }

  useEffect(() => {
    actions.getChapters().then(({ data }) => {
      if (data) setChapters(data);
    });
    actions.getVenues().then(({ data }) => {
      if (data) setVenues(data);
      setVenuesLoading(false);
    });
  }, []);

  const isNewVenue = selectedVenueId === NEW_VENUE;
  // #177: the Online chapter never hosts a physical venue.
  const venueChapters = chapters.filter((c) => c.slug !== ONLINE_CHAPTER_SLUG);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

    if (formData.getAll("tags").length < MIN_TAGS) {
      setStatus("error");
      setErrorMessage("Pick at least one tag");
      return;
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
          setSelectedVenueId("");
          setEndDate("");
          setEndDateTouched(false);
          setSlug("");
          setSlugTouched(false);
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
          onChange={mode === "create" ? handleNameChange : undefined}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="date">
          Start Date & Time *
        </label>
        <input
          className="cnf-form__input"
          type="datetime-local"
          id="date"
          name="date"
          defaultValue={initialData?.date}
          onChange={handleDateChange}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="end_date">
          End Date & Time *
        </label>
        <input
          className="cnf-form__input"
          type="datetime-local"
          id="end_date"
          name="end_date"
          value={endDate}
          onChange={(e) => {
            setEndDateTouched(true);
            setEndDate(e.target.value);
          }}
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
          {/* #177: no Hosting chapter choice — online events always belong
              to the Online chapter (set server-side). */}
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
        <>
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
        </>
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
            <label className="cnf-form__label" htmlFor="chapter_id">
              Chapter *
            </label>
            <select className="cnf-form__input" id="chapter_id" name="chapter_id" required>
              <option value="">Select a chapter</option>
              {venueChapters.map((c) => (
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

      {!isOnline && (
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="meet_point">
            Meet point
          </label>
          <input
            className="cnf-form__input"
            type="text"
            id="meet_point"
            name="meet_point"
            placeholder="e.g., main entrance, room 3B, by the fountain"
            defaultValue={initialData?.meetPoint ?? ""}
          />
          <small className="cnf-form__hint">
            Where exactly to meet at the venue, if it's not obvious from the venue itself.
          </small>
        </div>
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
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
            />
            <small className="cnf-form__hint">
              {/* #39: the form doesn't yet know which chapter's page this will land
                  on (an existing venue's chapter isn't exposed to the client, and
                  there's only one real chapter to preview anyway) — DEFAULT_CHAPTER_SLUG
                  is a deliberate placeholder, not a guarantee, until a real
                  chapter picker exists here. Online events always land under
                  the Online chapter (#177), so that one is exact. */}
              Used in URL: /{isOnline ? ONLINE_CHAPTER_SLUG : DEFAULT_CHAPTER_SLUG}/events/my-event-name
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
          rows={10}
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
          rows={10}
          defaultValue={initialData?.summary ?? ""}
        />
      </div>

      <TagPicker name="tags" defaultValue={initialData?.tags} />

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
