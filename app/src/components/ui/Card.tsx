import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ padding = true, className = '', children, onClick, ...props }: CardProps) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-[16px] ${padding ? 'p-[20px]' : ''}
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}`}
      style={{ boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
