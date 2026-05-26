import { type HTMLAttributes, type KeyboardEvent } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
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
      className={`card ${paddingClass[padding]} ${
        isInteractive ? 'cursor-pointer transition-transform active:scale-[0.98]' : ''
      } ${className}`}
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
