export type ChoiceOption<T extends string> = { value: T; label: string };

export function ChoiceButtons<T extends string>({
  options,
  value,
  onChoose,
  disabled = false,
  label = "選択肢"
}: {
  options: ChoiceOption<T>[];
  value?: T;
  onChoose: (value: T) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="choice-grid" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`choice-${option.value}`}
          aria-pressed={value === option.value}
          className={value === option.value ? "selected" : ""}
          disabled={disabled}
          onClick={() => onChoose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
