import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-secondary-container text-on-secondary-container hover:brightness-105 active:scale-95 shadow-[0_8px_15px_-3px_rgba(0,64,224,0.15)]',
  secondary:
    'bg-primary text-on-primary hover:bg-primary-container active:scale-95',
  ghost:
    'bg-transparent text-primary border-2 border-primary hover:bg-primary/5 active:scale-95',
  dark:
    'bg-inverse-surface text-inverse-on-surface hover:opacity-90 active:scale-95',
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all
        touch-target px-6 py-2 text-body-lg
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
