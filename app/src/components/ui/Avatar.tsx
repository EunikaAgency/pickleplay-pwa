import type { CSSProperties } from 'react';

function getInitials(name?: string): string {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

type AvatarVariant = 'blue' | 'lime' | 'coral';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  variant?: AvatarVariant;
  className?: string;
  style?: CSSProperties;
}

export function Avatar({ src, name, size = 40, variant = 'blue', className = '', style }: AvatarProps) {
  const merged: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.4)),
    ...style,
  };

  return (
    <span className={`avatar ${variant} ${className}`} style={merged}>
      {src ? <img src={src} alt="" /> : getInitials(name)}
    </span>
  );
}
