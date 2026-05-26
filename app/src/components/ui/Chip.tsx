import type { ReactNode } from 'react';

type ChipVariant = 'default' | 'accent' | 'tag' | 'success' | 'danger';
type ChipSize = 'sm' | 'md';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  variant?: ChipVariant;
  size?: ChipSize;
  onClick?: () => void;
  className?: string;
  /** When provided, used as the accessible label (useful for icon-only chips). */
  ariaLabel?: string;
}

const variantClasses: Record<ChipVariant, { base: string; selected: string }> = {
  default: {
    base: 'bg-surface-container-highest text-on-surface-variant',
    selected: 'bg-secondary-container text-on-secondary-container',
  },
  accent: {
    base: 'bg-surface-container-highest text-on-surface-variant',
    selected: 'bg-primary-container text-on-primary-container',
  },
  tag: {
    base: 'bg-primary/10 text-primary',
    selected: 'bg-primary/20 text-primary',
  },
  success: {
    base: 'bg-secondary-container/60 text-on-secondary-container',
    selected: 'bg-secondary-container text-on-secondary-container',
  },
  danger: {
    base: 'bg-tertiary-container/60 text-on-tertiary-container',
    selected: 'bg-tertiary-container text-on-tertiary-container',
  },
};

const sizeClasses: Record<ChipSize, string> = {
  sm: 'px-3 py-1 text-label-sm',
  md: 'px-4 py-2 text-label-sm',
};

export function Chip({
  children,
  selected = false,
  variant = 'default',
  size = 'md',
  onClick,
  className = '',
  ariaLabel,
}: ChipProps) {
  const styles = variantClasses[variant];
  const classes = `inline-flex items-center gap-1.5 rounded-full whitespace-nowrap font-bold transition-all
    ${sizeClasses[size]}
    ${selected ? styles.selected : styles.base}
    ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={`${classes} active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
      >
        {children}
      </button>
    );
  }
  return (
    <span aria-label={ariaLabel} className={classes}>
      {children}
    </span>
  );
}
