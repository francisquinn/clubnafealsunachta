import { useState, type JSX } from "react";
import { EVENT_TAGS, MAX_TAGS, normalizeTags, type EventTagSlug } from "../../lib/eventTags";
import "../../styles/tag-picker.css";

interface TagPickerProps {
  name: string;
  defaultValue?: readonly string[];
}

// #92: toggle chips over the fixed tag list, posted as one hidden input per
// picked tag.
export default function TagPicker({ name, defaultValue = [] }: TagPickerProps): JSX.Element {
  const [selected, setSelected] = useState<EventTagSlug[]>(() => normalizeTags(defaultValue));
  const isFull = selected.length >= MAX_TAGS;

  function toggle(slug: EventTagSlug) {
    setSelected((current) =>
      normalizeTags(current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug])
    );
  }

  return (
    <div className="cnf-form__group" role="group" aria-labelledby="tags-label">
      <span className="cnf-form__label" id="tags-label">Tags *</span>
      <div className="cnf-tag-picker">
        {EVENT_TAGS.map(({ slug, label }) => {
          const isSelected = selected.includes(slug);
          return (
            <button
              key={slug}
              type="button"
              className="cnf-badge cnf-tag-picker__chip"
              aria-pressed={isSelected}
              disabled={!isSelected && isFull}
              onClick={() => toggle(slug)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <small className="cnf-form__hint">
        Pick one tag, or two if the event really spans both.
      </small>
      {selected.map((slug) => (
        <input key={slug} type="hidden" name={name} value={slug} />
      ))}
    </div>
  );
}
