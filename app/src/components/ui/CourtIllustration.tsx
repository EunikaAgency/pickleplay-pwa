interface IllustrationProps {
  width?: number;
  opacity?: number;
  className?: string;
}

export function CourtIllustration({ width = 200, opacity = 0.95, className }: IllustrationProps) {
  return (
    <svg width={width} viewBox="0 0 200 150" style={{ opacity }} className={className}>
      <defs>
        <linearGradient id="court-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c1f100" />
          <stop offset="100%" stopColor="#abd600" />
        </linearGradient>
      </defs>
      <g transform="translate(20 10) skewY(-8)">
        <rect x="0" y="0" width="160" height="120" rx="8" fill="url(#court-grad)" stroke="#001356" strokeWidth="3" />
        <rect x="20" y="10" width="120" height="100" fill="#4d7cff" opacity="0.85" rx="2" />
        <line x1="80" y1="10" x2="80" y2="110" stroke="white" strokeWidth="2" />
        <line x1="20" y1="55" x2="60" y2="55" stroke="white" strokeWidth="2" />
        <line x1="100" y1="55" x2="140" y2="55" stroke="white" strokeWidth="2" />
        <line x1="20" y1="65" x2="60" y2="65" stroke="white" strokeWidth="2" />
        <line x1="100" y1="65" x2="140" y2="65" stroke="white" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function PeopleIllustration({ width = 160, opacity = 0.6, className }: IllustrationProps) {
  return (
    <svg width={width} viewBox="0 0 160 130" style={{ opacity }} className={className}>
      <circle cx="40" cy="40" r="16" fill="#c1f100" />
      <path d="M22 100 Q22 70 40 70 Q58 70 58 100 Z" fill="#c1f100" />
      <circle cx="80" cy="30" r="18" fill="#fff" opacity="0.9" />
      <path d="M58 100 Q58 65 80 65 Q102 65 102 100 Z" fill="#fff" opacity="0.9" />
      <circle cx="118" cy="42" r="15" fill="#ffd2c6" />
      <path d="M102 100 Q102 72 118 72 Q134 72 134 100 Z" fill="#ffd2c6" />
    </svg>
  );
}
