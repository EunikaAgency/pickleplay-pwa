import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface OfflineBannerProps {
  /** When true, render even if the browser reports online (for demo / preview). */
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
      className="flex w-full items-center justify-center gap-2 bg-tertiary-container/70 px-4 py-1.5 text-body-md font-bold text-on-tertiary-container"
    >
      <Icon name="cloud_off" size={16} />
      <span>You're offline — showing your last view.</span>
    </div>
  );
}
