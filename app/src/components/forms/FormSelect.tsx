import { useId, type SelectHTMLAttributes } from 'react';

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  containerClassName?: string;
  selectClassName?: string;
}

export function FormSelect({
  label,
  hint,
  error,
  required,
  options,
  containerClassName = '',
  selectClassName = '',
  id,
  ...selectProps
}: FormSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const showError = Boolean(error);

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant ml-1"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : hint ? hintId : undefined}
        className={`w-full h-12 px-4 bg-surface-container-low border ${showError ? 'border-error' : 'border-outline-variant'}
          rounded-[12px] focus:outline-none focus:ring-2 ${showError ? 'focus:ring-error/30 focus:border-error' : 'focus:ring-primary/20 focus:border-primary'}
          transition-all text-body-md ${selectClassName}`}
        {...selectProps}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {showError ? (
        <p id={errorId} className="text-label-sm font-bold text-error ml-1">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-label-sm text-on-surface-variant ml-1">{hint}</p>
      ) : null}
    </div>
  );
}
