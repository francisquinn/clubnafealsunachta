import "../../styles/checkbox.css";

interface CheckboxProps {
  id: string;
  name: string;
  label: string;
  value?: string;
  defaultChecked?: boolean;
  // Controlled instead: for a box that only changes once a save succeeds.
  checked?: boolean;
  disabled?: boolean;
  // Saving in the background: announced, but still focusable.
  busy?: boolean;
  describedBy?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Checkbox({ id, name, label, value, defaultChecked, checked, disabled, busy, describedBy, onChange }: CheckboxProps) {
  return (
    <label className="cnf-checkbox" htmlFor={id}>
      <span className="cnf-checkbox__control">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          checked={checked}
          disabled={disabled}
          aria-busy={busy || undefined}
          aria-describedby={describedBy}
          onChange={onChange}
          className="cnf-checkbox__input"
        />
        <span className="cnf-checkbox__box" aria-hidden="true">
          <svg className="cnf-checkbox__check" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
      <span className="cnf-checkbox__label">{label}</span>
    </label>
  );
}
