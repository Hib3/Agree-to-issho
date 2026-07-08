type ChoiceButtonsProps<T extends string> = {
  options: Array<{ value: T; label: string }>;
  value?: T;
  variant?: "grid" | "chips" | "primary";
  disabled?: boolean;
  ariaLabel?: string;
  onChoose: (value: T) => void;
};

export function ChoiceButtons<T extends string>({
  options,
  value,
  variant = "grid",
  disabled = false,
  ariaLabel,
  onChoose
}: ChoiceButtonsProps<T>) {
  return (
    <div className={`option-grid option-grid-${variant}`} aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          className={value === option.value ? "selected" : ""}
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          data-testid={`choice-${option.value}`}
          data-value={option.value}
          onClick={() => onChoose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
