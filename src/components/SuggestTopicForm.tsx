import { useEffect, useRef, useState, type JSX } from "react";
import Checkbox from "./Checkbox/Checkbox";
import "../styles/form.css";
import "../styles/suggest-topic.css";

// #140: topics kept across the login modal's reload when the session has
// expired mid-form, so the member only has to press Send again.
const PENDING_TOPICS_KEY = "cnf-suggest-topics";

interface TopicSuggestFormProps {
  // The chapters the member is in; the page doesn't render the form without one.
  chapters: { id: number; name: string }[];
  // The name they show publicly, which the email carries if they tick the box.
  displayName: string;
}

function takePendingTopics(): string[] {
  try {
    const saved = sessionStorage.getItem(PENDING_TOPICS_KEY);
    sessionStorage.removeItem(PENDING_TOPICS_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function savePendingTopics(topics: string[]): void {
  try {
    sessionStorage.setItem(PENDING_TOPICS_KEY, JSON.stringify(topics));
  } catch {
    // Storage blocked: they'd just need to re-add the topics after logging in.
  }
}

export default function TopicSuggestForm({ chapters, displayName }: TopicSuggestFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [topics, setTopics] = useState<string[]>([]);
  // One chapter: nothing to choose, so it starts picked.
  const [chapterId, setChapterId] = useState<string>(chapters.length === 1 ? String(chapters[0]!.id) : "");
  const [includeName, setIncludeName] = useState<boolean>(false);
  // The topic input only shows once they ask to add one, and hides again
  // after each add.
  const [isAddingTopic, setIsAddingTopic] = useState<boolean>(false);
  const topicRef = useRef<HTMLInputElement>(null);
  const addTopicRef = useRef<HTMLButtonElement>(null);
  const wasAddingTopic = useRef(false);

  // Focus follows the row: into the input when it opens, and back to "Add a
  // topic" when it closes, so a keyboard user isn't dropped at the top of
  // the page after each add. Not on first render, which would grab focus.
  useEffect(() => {
    if (isAddingTopic) topicRef.current?.focus();
    else if (wasAddingTopic.current) addTopicRef.current?.focus();
    wasAddingTopic.current = isAddingTopic;
  }, [isAddingTopic]);

  useEffect(() => {
    const pending = takePendingTopics();
    if (pending.length > 0) setTopics(pending);
  }, []);

  async function onSubmit(): Promise<void> {
    setIsLoading(true);

    if (topics.length === 0 || !chapterId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/suggest-topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics, chapterId: Number(chapterId), includeName }),
      });

      const data = await response.json();

      // The session ran out while they were filling the form in: log in
      // again (which reloads the page) and pick up the same topics after.
      if (response.status === 401) {
        savePendingTopics(topics);
        document.getElementById("cnf-login-trigger")?.click();
      }

      if (!response.ok) {
        throw new Error(data.message);
      }

      setSuccessMessage(data.message);
      setErrorMessage(null);
      setIsFormSubmitted(true);
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
      setIsAddingTopic(false);
    }
  }

  function removeTopic(index: number) {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  }

  function onTopicKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      addTopic();
    } else if (e.key === "Escape") {
      setIsAddingTopic(false);
    }
  }

  // The last row of the list adds to it, like Reminders: "Add a topic"
  // turns into the input in place, and back again once the topic is in.
  function renderAddRow() {
    return (
      <li className="cnf-suggest__add">
        {!isAddingTopic ? (
          <button
            type="button"
            ref={addTopicRef}
            onClick={() => setIsAddingTopic(true)}
            className="cnf-button cnf-button--compact cnf-button__secondary"
          >
            <span className="cnf-button__text">Add a topic</span>
          </button>
        ) : (
          <div className="cnf-suggest__input">
            <input
              id="topic-input"
              type="text"
              name="topic"
              className="cnf-form__input"
              placeholder="Enter a topic"
              aria-label="Topic"
              required
              onChange={onChange}
              onKeyDown={onTopicKeyDown}
              ref={topicRef}
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={addTopic}
              className={`cnf-button cnf-button--compact cnf-button__primary ${isLoading ? "cnf-button--loading" : ""}`}
            >
              <span className="cnf-button__text">Add</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTopic(false)}
              className="cnf-button cnf-button--compact cnf-button__ghost"
            >
              <span className="cnf-button__text">Cancel</span>
            </button>
          </div>
        )}
      </li>
    );
  }

  function renderTopics() {
    return (
      <div aria-live="polite">
        <div className="cnf-suggest__heading">
          <span className="cnf-count" aria-hidden="true">{topics.length}</span> Suggested
          topic{topics.length !== 1 ? "s" : ""}:
        </div>
        <ul className="cnf-suggest__list" aria-label="Suggested topics">
          {topics.map((topic: string, key: number) => (
            <li key={key}>
              <div className="cnf-suggest__topic">
                {topic}
                <button
                  type="button"
                  className="cnf-suggest__remove"
                  onClick={() => removeTopic(key)}
                  aria-label={`Remove ${topic}`}
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
          {renderAddRow()}
        </ul>
      </div>
    );
  }

  function renderForm(): JSX.Element {
    return (
      <div className="cnf-suggest" role="form" aria-label="Suggest a topic">
        {renderTopics()}
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="suggest-chapter">Chapter</label>
          <select
            id="suggest-chapter"
            name="chapter"
            className="cnf-form__input cnf-suggest__chapter"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            required
          >
            {chapters.length > 1 && <option value="" disabled>Choose a chapter</option>}
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
            ))}
          </select>
        </div>
        <div className="cnf-suggest__name">
          <Checkbox
            id="suggest-include-name"
            name="include_name"
            label={`Include my name (${displayName})`}
            checked={includeName}
            describedBy="anonymous-note"
            onChange={(e) => setIncludeName(e.target.checked)}
          />
          <p className="text-sm cnf-suggest__note" id="anonymous-note">
            Your suggestion is anonymous unless you include your name. See our{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
        <div>
          <button
            type="submit"
            onClick={onSubmit}
            disabled={isLoading || topics.length === 0 || !chapterId}
            aria-busy={isLoading}
            className={`cnf-form__submit cnf-button cnf-button__gold ${isLoading ? "cnf-button--loading" : ""}`}
          >
            <span className="cnf-button__text">Send</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isFormSubmitted ? (
        <>
          {renderForm()}
          {errorMessage && <p className="cnf-form__message--error">{errorMessage}</p>}
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
