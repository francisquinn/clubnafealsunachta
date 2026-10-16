import { type JSX } from "react";

interface SelectorProps {
  label?: string;
  name?: string;
  // `value` is what onChange reports (e.g. a chapter slug), `label` what's shown.
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export default function Selector({ label, name, options, value, onChange }: SelectorProps): JSX.Element {
  const id = label ? `${label.toLowerCase().replace(/\s+/g, "-")}-select` : "cnf-select";
  return (
    <div className="cnf-select">
      {label && <label htmlFor={id} className="cnf-select__label">{label}</label>}
      <select
        id={id}
        name={name}
        className="cnf-select__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}