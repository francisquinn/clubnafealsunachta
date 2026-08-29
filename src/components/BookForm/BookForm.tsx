import { useState } from "react";
import { actions } from "astro:actions";

export type BookFormInitialData = {
  title: string;
  author: string;
  slug: string;
  blurb: string;
  coverImageUrl?: string;
};

type BookFormProps = {
  mode: "create" | "edit";
  initialData?: BookFormInitialData;
};

export default function BookForm({ mode, initialData }: BookFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

    try {
      const action = mode === "edit" ? actions.updateBook : actions.createBook;
      const { error, data } = await action(formData);

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data?.success) {
        setStatus("success");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "success") {
    return <p>{mode === "edit" ? "Book updated" : "Book created"} successfully!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="cnf-form">
      {mode === "edit" && (
        <input type="hidden" name="slug" value={initialData?.slug ?? ""} />
      )}

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="title">
          Title *
        </label>
        <input
          className="cnf-form__input"
          type="text"
          id="title"
          name="title"
          defaultValue={initialData?.title}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="author">
          Author *
        </label>
        <input
          className="cnf-form__input"
          type="text"
          id="author"
          name="author"
          defaultValue={initialData?.author}
          required
        />
      </div>

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
              placeholder="book-title"
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers and hyphens only"
              required
            />
            <small className="cnf-form__hint">Internal identifier for the book entry.</small>
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
            <small className="cnf-form__hint">Slug cannot be changed after creation.</small>
          </>
        )}
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="blurb">
          Blurb (Markdown) *
        </label>
        <textarea
          className="cnf-form__input"
          id="blurb"
          name="blurb"
          rows={6}
          placeholder="A short note on why this book is here…"
          defaultValue={initialData?.blurb}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="cover_image_url">
          Cover image URL
        </label>
        <input
          className="cnf-form__input"
          type="url"
          id="cover_image_url"
          name="cover_image_url"
          defaultValue={initialData?.coverImageUrl ?? ""}
        />
        <small className="cnf-form__hint">
          Optional. Entered by hand for now; auto-fetching from a books API is a possible future enhancement.
        </small>
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
        <span className="cnf-button__text">
          {mode === "edit" ? "Save changes" : "Create"}
        </span>
      </button>
    </form>
  );
}