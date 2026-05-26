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

interface FormFieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  inputClassName?: string;
}

export function FormField({
  label,
  hint,
  error,
  required,
  leadingIcon,
  trailingSlot,
  containerClassName = '',
  inputClassName = '',
  id,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const showError = Boolean(error);

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant ml-1"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative group">
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary"
          />
        )}
        <input
          id={inputId}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className={`w-full h-12 ${leadingIcon ? 'pl-12' : 'pl-4'} ${trailingSlot ? 'pr-12' : 'pr-4'}
            bg-surface-container-low border ${showError ? 'border-error' : 'border-outline-variant'}
            rounded-[12px] focus:outline-none focus:ring-2 ${showError ? 'focus:ring-error/30 focus:border-error' : 'focus:ring-primary/20 focus:border-primary'}
            transition-all text-body-md ${inputClassName}`}
          {...inputProps}
        />
        {trailingSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">{trailingSlot}</div>
        )}
      </div>
      {showError ? (
        <p id={errorId} className="text-label-sm font-bold text-error ml-1">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-label-sm text-on-surface-variant ml-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
