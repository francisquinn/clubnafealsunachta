import { useRef, useState, type JSX } from "react";
import "../styles/form.css";
import "../styles/suggest-topic.css";

export default function TopicSuggestForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [topics, setTopics] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);

  async function onSubmit(): Promise<void> {
    setIsLoading(true);

    if (topics.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/suggest-topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics }),
      });

      const data = await response.json();
      setIsFormSubmitted(true);

      if (!response.ok) {
        throw new Error(data.message);
      }

      setSuccessMessage(data.message);
      setErrorMessage(null);
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
        setSuccessMessage(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function onChange(): void {
    setErrorMessage(null);
  }

  function addTopic() {
    if (topicRef.current?.value) {
      setTopics([...topics, topicRef.current?.value]);
      topicRef.current.value = "";
    }
  }

  function removeTopic(index: number) {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  }

  function renderTopics() {
    return (
      <div aria-live="polite">
        <span className="cnf-suggest__count" aria-hidden="true">{topics.length}</span> Suggested
        topic{topics.length !== 1 ? "s" : ""}:
        <ul className="cnf-suggest__list" aria-label="Suggested topics">
          {topics.map((topic: string, key: number) => (
            <li key={key}>
              <div className="cnf-suggest__topic">
                {topic}
                <button
                  className="cnf-button cnf-button__link cnf-button--compact"
                  onClick={() => removeTopic(key)}
                  aria-label={`Remove ${topic}`}
                >
                  <img className="cnf-suggest__icon" src="/x.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function renderForm(): JSX.Element {
    return (
      <div className="cnf-suggest" role="form" aria-label="Suggest a topic">
        <div className="cnf-suggest__input">
          <input
            id="topic-input"
            type="text"
            name="topic"
            className="cnf-form__input"
            placeholder="Enter a topic"
            required
            onChange={onChange}
            ref={topicRef}
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={addTopic}
            className={`cnf-button cnf-button--compact cnf-button__link ${isLoading ? "cnf-button--loading" : ""}`}
          >
            <span className="cnf-button__text">Add</span>
          </button>
        </div>
        <div>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={isLoading || topics.length === 0}
            aria-busy={isLoading}
            className={`cnf-form__submit cnf-button cnf-button__gold ${isLoading ? "cnf-button--loading" : ""}`}
          >
            <span className="cnf-button__text">Send</span>
          </button>
          <p className="text-sm" id="anonymous-note">
            Just so you know, the form is completely anonymous.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isFormSubmitted ? (
        <>
          {renderTopics()}
          {renderForm()}
        </>
      ) : (
        <>
          {successMessage !== null && (
            <p className="cnf-form__message--success">{successMessage}</p>
          )}
          {errorMessage !== null && (
            <p className="cnf-form__message--error">{errorMessage}</p>
          )}
        </>
      )}
    </>
  );
}
