import { useId, type ChangeEvent, type SelectHTMLAttributes } from 'react';
import { Dropdown } from '../ui/Dropdown';

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  options: Array<{ value: string; label: string; icon?: string; iconColor?: string }>;
  containerClassName?: string;
  placeholder?: string;
}

/**
 * Labelled form select. Renders the shared on-brand `Dropdown` (not a native
 * <select>, whose popup is OS-styled and inconsistent with the rest of the app)
 * while keeping a native-select-like API — callers still pass `value` +
 * `onChange={(e) => …e.target.value}`, so existing call sites are unchanged.
 */
export function FormSelect({
  label,
  hint,
  error,
  required,
  options,
  containerClassName = '',
  id,
  value,
  onChange,
  disabled,
  placeholder,
  'aria-label': ariaLabel,
}: FormSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const showError = Boolean(error);

  // Bridge the shared Dropdown's (value) callback back to the native-select
  // onChange the call sites expect, so nothing downstream has to change.
  const handleChange = (next: string) => {
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className={`field p-0! ${containerClassName}`}>
      {label && (
        <label htmlFor={selectId} className="lbl">
          {label}
          {required && <span className="ml-0.5 text-[var(--coral)]">*</span>}
        </label>
      )}
      <Dropdown
        id={selectId}
        value={value != null ? String(value) : ''}
        onChange={handleChange}
        options={options}
        variant="field"
        triggerClassName="control"
        placeholder={placeholder ?? 'Select'}
        disabled={disabled}
        invalid={showError}
        aria-label={ariaLabel ?? label}
      />
      {showError ? (
        <p id={errorId} className="mt-1.5 text-[12px] font-bold text-[var(--coral)]">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
