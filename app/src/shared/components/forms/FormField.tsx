import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';

interface BaseProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  leadingIcon?: string;
  trailingSlot?: ReactNode;
  containerClassName?: string;
}

interface FormFieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {}

export function FormField({
  label,
  hint,
  error,
  required,
  leadingIcon,
  trailingSlot,
  containerClassName = '',
  id,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const showError = Boolean(error);

  return (
    <div className={`field p-0! ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="lbl">
          {label}
          {required && <span className="ml-0.5 text-[var(--coral)]">*</span>}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none">
            <Icon name={leadingIcon} size={18} />
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className={`control ${leadingIcon ? 'pl-[42px]!' : 'pl-4!'} ${trailingSlot ? 'pr-[44px]!' : 'pr-4!'} ${
            showError ? 'border-[var(--coral)]!' : ''
          }`}
          {...inputProps}
        />
        {trailingSlot && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{trailingSlot}</div>
        )}
      </div>
      {showError ? (
        <p id={errorId} className="mt-1.5 text-[12px] font-bold text-[var(--coral)]">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
