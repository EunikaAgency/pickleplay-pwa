export default function Icon({ name, size = 24, filled = false, weight = 400, className = '', onClick }) {
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size <= 20 ? 20 : 24}`,
      }}
      onClick={onClick}
      {...(onClick ? { type: 'button', 'aria-label': name } : {})}
    >
      {name}
    </Tag>
  );
}
