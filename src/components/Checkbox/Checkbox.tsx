import "../../styles/checkbox.css";

interface CheckboxProps {
  id: string;
  name: string;
  label: string;
  value?: string;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Checkbox({ id, name, label, value, defaultChecked, onChange }: CheckboxProps) {
  return (
    <label className="cnf-checkbox" htmlFor={id}>
      <span className="cnf-checkbox__control">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={defaultChecked}
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
