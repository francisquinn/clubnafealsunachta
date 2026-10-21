import { useEffect, useRef, useState, type JSX } from "react";

interface SelectorProps {
  label?: string;
  name?: string;
  // `onChange` fires on commit only (mouse/touch pick or Enter), not a
  // keyboard step or blur (#196) `value` is what it
  // reports (e.g. a chapter slug), `label` what's shown.
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

// Firefox and Windows Chrome fire `change` on keydown for arrows, Home/End,
// Page keys and type-ahead letters on a closed select. Those are movement,
// not a decision. Enter and Tab are not movement.
function isMovementKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key) || e.key.length === 1;
}

export default function Selector({ label, name, options, value, onChange }: SelectorProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  // True only between a movement keydown and its keyup (the browser's
  // `change` for that key lands in this window), so it can't go stale and
  // swallow a later mouse/touch pick.
  const keyboardMoving = useRef(false);
  // Last value handed to onChange, so a blur right after a pick doesn't
  // revert the display while the parent is navigating.
  const committed = useRef<string | null>(null);

  useEffect(() => {
    committed.current = null;
    setDraft(value);
  }, [value]);

  // Back/forward cache restores the page with its old state; re-sync.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) {
        setDraft(value);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [value]);

  function commit(next: string): void {
    if (next === value || next === committed.current) return;
    committed.current = next;
    onChange(next);
  }

  const id = label ? `${label.toLowerCase().replace(/\s+/g, "-")}-select` : "cnf-select";
  return (
    <div className="cnf-select">
      {label && <label htmlFor={id} className="cnf-select__label">{label}</label>}
      <select
        id={id}
        name={name}
        className="cnf-select__input"
        value={draft}
        onKeyDown={(e) => {
          if (isMovementKey(e)) keyboardMoving.current = true;
        }}
        onKeyUp={(e) => {
          keyboardMoving.current = false;
          // Commit on keyup so the browser has already applied Enter's pick
          // (open dropdown) and `e.currentTarget.value` is final.
          if (e.key === "Enter") commit(e.currentTarget.value);
        }}
        onPointerDown={() => {
          keyboardMoving.current = false;
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!keyboardMoving.current) commit(e.target.value);
        }}
        onBlur={() => {
          // Tabbing away never navigates; drop an uncommitted choice so the
          // picker shows the chapter we're actually on.
          keyboardMoving.current = false;
          if (draft !== committed.current) setDraft(value);
        }}
        autoComplete="off"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
