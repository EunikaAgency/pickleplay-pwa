import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface OfflineBannerProps {
  forceShow?: boolean;
}

export function OfflineBanner({ forceShow = false }: OfflineBannerProps) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !forceShow) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: 'var(--coral-soft)',
        color: 'var(--coral)',
        padding: '6px 16px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <Icon name="wifi_off" size={14} />
      <span>You're offline — showing your last view.</span>
    </div>
  );
}
