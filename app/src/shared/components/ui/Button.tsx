import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'brand' | 'dark' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const baseClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-heading font-semibold transition-transform duration-[120ms] ease-out active:scale-[0.98] disabled:opacity-60 disabled:cursor-default disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'h-[52px] px-5 text-base bg-[var(--lime)] text-[var(--lime-ink)] shadow-[0_8px_22px_-6px_rgba(193,241,0,0.5)]',
  brand:
    'h-[52px] px-5 text-base bg-[var(--primary)] text-white shadow-[0_8px_22px_-6px_rgba(0,64,224,0.5)]',
  dark:
    'h-[52px] px-5 text-base bg-[var(--ink)] text-white shadow-[0_8px_22px_-6px_rgba(0,0,0,0.35)]',
  outline:
    'h-[52px] px-5 text-base bg-[var(--surface)] text-[var(--ink-2)] border-[0.5px] border-[var(--hairline)]',
  ghost:
    'h-11 px-4 text-sm bg-transparent text-[var(--ink-2)]',
  destructive:
    'h-[52px] px-5 text-base bg-[var(--coral-soft)] text-[var(--coral)]',
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClass} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
