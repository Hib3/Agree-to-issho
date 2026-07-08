import { FormEvent, ReactNode, useState } from "react";

type TextInputPanelProps = {
  label: string;
  submitLabel: string;
  maxLength?: number;
  children?: ReactNode;
  onSubmit: (value: string) => void;
};

export function TextInputPanel({ label, submitLabel, maxLength = 40, children, onSubmit }: TextInputPanelProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form className="panel form-stack" onSubmit={handleSubmit}>
      <label>
        {label}
        <input value={value} maxLength={maxLength} onChange={(event) => setValue(event.target.value)} />
      </label>
      {children}
      <button className="primary" type="submit" disabled={!value.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
