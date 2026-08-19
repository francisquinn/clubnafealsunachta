import { type JSX } from "react";

interface SelectorProps {
  label?: string;
  name?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function Selector({ label, name, options, value, onChange }: SelectorProps): JSX.Element {
  const id = label ? `${label.toLowerCase()}-select` : "cnf-select";
  const placeholder = label ? `Select ${label.toLowerCase()}` : "Select a location";
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
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}