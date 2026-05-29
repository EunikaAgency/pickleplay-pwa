import { useId, type SelectHTMLAttributes } from 'react';

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  containerClassName?: string;
}

export function FormSelect({
  label,
  hint,
  error,
  required,
  options,
  containerClassName = '',
  id,
  ...selectProps
}: FormSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const showError = Boolean(error);

  return (
    <div className={`field p-0! ${containerClassName}`}>
      {label && (
        <label htmlFor={selectId} className="lbl">
          {label}
          {required && <span className="ml-0.5 text-[var(--coral)]">*</span>}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
        className={`control ${showError ? 'border-[var(--coral)]!' : ''}`}
        {...selectProps}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {showError ? (
        <p id={errorId} className="mt-1.5 text-[12px] font-bold text-[var(--coral)]">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
