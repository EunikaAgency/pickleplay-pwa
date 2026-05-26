import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const baseClass =
  'inline-flex items-center justify-center gap-2 font-heading font-semibold rounded-[14px] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/40';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'h-12 px-6 text-[15px] bg-[color:var(--lime)] text-[color:var(--lime-ink)] shadow-[0_8px_22px_-6px_rgba(193,241,0,0.5)]',
  dark:
    'h-12 px-6 text-[15px] bg-[color:var(--ink)] text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.35)]',
  outline:
    'h-12 px-6 text-[15px] bg-[color:var(--surface)] text-[color:var(--ink-2)] border border-[color:var(--hairline)]',
  ghost: 'h-11 px-5 text-[14px] bg-transparent text-[color:var(--ink-2)]',
  destructive:
    'h-12 px-6 text-[15px] bg-[color:var(--coral-soft)] text-[color:var(--coral)]',
};

export function Button({
  variant = 'primary',
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
      className={`${baseClass} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${
        disabled ? 'opacity-60 pointer-events-none' : ''
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
