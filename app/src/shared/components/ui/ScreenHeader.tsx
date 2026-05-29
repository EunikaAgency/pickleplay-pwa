import { type ReactNode } from 'react';
import { Icon } from './Icon';

interface ScreenHeaderProps {
  onBack: () => void;
  backIcon?: 'back' | 'close';
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function ScreenHeader({
  onBack,
  backIcon = 'back',
  eyebrow,
  title,
  subtitle,
  action,
  className = '',
}: ScreenHeaderProps) {
  return (
    <div className={`px-5 pt-1 pb-4 flex items-center gap-3.5 ${className}`}>
      <button
        type="button"
        onClick={onBack}
        aria-label={backIcon === 'close' ? 'Close' : 'Back'}
        className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center"
      >
        <Icon name={backIcon} size={16} />
      </button>
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="t-eyebrow">{eyebrow}</div>}
        <div className={`hd-2 ${eyebrow ? 'mt-0.5' : ''}`}>{title}</div>
        {subtitle && <div className="t-sm">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
