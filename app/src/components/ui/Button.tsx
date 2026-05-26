import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-secondary-container text-on-secondary-container hover:brightness-105 shadow-button',
  secondary:
    'bg-primary text-on-primary hover:brightness-110 shadow-button',
  ghost:
    'bg-transparent text-primary border border-outline-variant hover:bg-surface-container-low',
  dark:
    'bg-inverse-surface text-inverse-on-surface hover:opacity-90',
  destructive:
    'bg-error-container text-on-error-container hover:brightness-105',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-body-md',
  md: 'h-11 px-5 text-body-md',
  lg: 'h-12 px-6 text-body-lg',
};

export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-heading font-bold transition-all active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        ${variantClasses[variant]}
        ${sizeClasses[size]}
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
