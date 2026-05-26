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
    <div className={`field ${containerClassName}`} style={{ padding: 0 }}>
      {label && (
        <label htmlFor={inputId} className="lbl">
          {label}
          {required && <span style={{ color: 'var(--coral)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leadingIcon && (
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              pointerEvents: 'none',
            }}
          >
            <Icon name={leadingIcon} size={18} />
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : hint ? hintId : undefined}
          className="control"
          style={{
            paddingLeft: leadingIcon ? 42 : 16,
            paddingRight: trailingSlot ? 44 : 16,
            borderColor: showError ? 'var(--coral)' : undefined,
          }}
          {...inputProps}
        />
        {trailingSlot && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>{trailingSlot}</div>
        )}
      </div>
      {showError ? (
        <p id={errorId} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--coral)' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
