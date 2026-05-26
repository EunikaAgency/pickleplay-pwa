function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 48, className = '' }: AvatarProps) {
  const style = { width: size, height: size, minWidth: size };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`rounded-full object-cover border-2 border-secondary-container/30 ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-primary-fixed text-on-primary-fixed font-bold flex items-center justify-center ${className}`}
      style={{ ...style, fontSize: size * 0.35 }}
    >
      {getInitials(name)}
    </div>
  );
}
