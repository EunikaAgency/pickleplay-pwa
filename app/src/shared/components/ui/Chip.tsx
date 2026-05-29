import type { ReactNode } from 'react';

type ChipVariant = 'default' | 'lime' | 'dark';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  variant?: ChipVariant;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function Chip({
  children,
  selected = false,
  variant = 'default',
  onClick,
  className = '',
  ariaLabel,
}: ChipProps) {
  let cls = 'chip';
  if (variant === 'lime') cls += ' lime';
  else if (variant === 'dark' || selected) cls += ' active';
  if (className) cls += ` ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} className={cls}>
        {children}
      </button>
    );
  }
  return (
    <span aria-label={ariaLabel} className={cls}>
      {children}
    </span>
  );
}
