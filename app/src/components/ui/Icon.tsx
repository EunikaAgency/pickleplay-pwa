interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  className?: string;
  onClick?: () => void;
}

export function Icon({ name, size = 24, filled = false, weight = 400, className = '', onClick }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size <= 20 ? 20 : 24}`,
        width: size,
        height: size,
        lineHeight: 1,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {name}
    </span>
  );
}
