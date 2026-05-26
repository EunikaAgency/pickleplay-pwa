import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  variant?: 'default' | 'accent' | 'tag';
  onClick?: () => void;
  className?: string;
}

const variantClasses = {
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
};

export function Chip({ children, selected = false, variant = 'default', onClick, className = '' }: ChipProps) {
  const styles = variantClasses[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full whitespace-nowrap font-bold transition-all active:scale-95
        px-4 py-2 text-label-sm
        ${selected ? styles.selected : styles.base}
        ${className}`}
    >
      {children}
    </button>
  );
}
