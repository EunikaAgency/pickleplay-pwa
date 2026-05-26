import { type HTMLAttributes, type KeyboardEvent } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'card';
  interactive?: boolean;
}

const paddingClass = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

export function Card({
  padding = 'md',
  elevation = 'card',
  interactive,
  className = '',
  children,
  onClick,
  onKeyDown,
  ...props
}: CardProps) {
  const isInteractive = interactive ?? Boolean(onClick);
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  return (
    <div
      className={`rounded-[12px] bg-surface-container-lowest ${paddingClass[padding]} ${elevation === 'card' ? 'shadow-card' : ''}
        ${isInteractive ? 'cursor-pointer transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''}
        ${className}`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}
