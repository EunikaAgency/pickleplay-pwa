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
    <div className={`field ${containerClassName}`} style={{ padding: 0 }}>
      {label && (
        <label htmlFor={selectId} className="lbl">
          {label}
          {required && <span style={{ color: 'var(--coral)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
        className="control"
        style={{ borderColor: showError ? 'var(--coral)' : undefined }}
        {...selectProps}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {showError ? (
        <p id={errorId} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--coral)' }}>{error}</p>
      ) : hint ? (
        <p id={hintId} style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{hint}</p>
      ) : null}
    </div>
  );
}
