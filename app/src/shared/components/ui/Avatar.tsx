import { useState, type CSSProperties } from 'react';
import { getInitials } from '../../lib/initials';
import { apiImageUrl } from '../../lib/api';

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
  // Seed data carries avatar URLs that 404 / fail to load; without this the
  // browser paints its broken-image icon. On error we fall back to the initials.
  // The <img> is keyed by the resolved URL so it remounts (and clears the error
  // state) whenever the src prop changes — no useState/useEffect reset needed.
  const [failed, setFailed] = useState(false);

  // Other users' avatars arrive as raw API values — often a relative
  // '/uploads/<file>' path that would 404 against the PWA's own origin. Resolve
  // them to the API host (apiImageUrl passes absolute URLs like randomuser.me
  // through unchanged, so it's a no-op for the already-resolved current user).
  const resolved = apiImageUrl(src);

  const merged: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.4)),
    ...style,
  };

  return (
    <span className={`avatar ${variant} ${className}`} style={merged}>
      {resolved && !failed ? <img key={resolved} src={resolved} alt="" onError={() => setFailed(true)} /> : getInitials(name)}
    </span>
  );
}
