import { useState } from "react";
import { actions } from "astro:actions";

export type PostFormInitialData = {
  title: string;
  slug: string;
  author: string;
  date: string;
  body: string;
};

type PostFormProps = {
  mode: "create" | "edit";
  initialData?: PostFormInitialData;
};

export default function PostForm({ mode, initialData }: PostFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);

    try {
      const action = mode === "edit" ? actions.updatePost : actions.createPost;
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
    return (
      <>
        <p>{mode === "edit" ? "Post updated" : "Post created"} successfully!</p>
        <a href="/admin/posts">Back to posts</a>
      </>
    );
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
              placeholder="my-post-title"
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers and hyphens only"
              required
            />
            <small className="cnf-form__hint">Used in URL: /posts/my-post-title</small>
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
            <small className="cnf-form__hint">Slug cannot be changed after creation.</small>
          </>
        )}
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
        <label className="cnf-form__label" htmlFor="date">
          Date *
        </label>
        <input
          className="cnf-form__input"
          type="date"
          id="date"
          name="date"
          defaultValue={initialData?.date}
          required
        />
      </div>

      <div className="cnf-form__group">
        <label className="cnf-form__label" htmlFor="body">
          Body (Markdown) *
        </label>
        <textarea
          className="cnf-form__input"
          id="body"
          name="body"
          rows={20}
          defaultValue={initialData?.body}
          required
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
        <span className="cnf-button__text">
          {mode === "edit" ? "Save changes" : "Create"}
        </span>
      </button>
    </form>
  );
}
