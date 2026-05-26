import { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface InstallPromptProps {
  hasBottomChrome?: boolean;
}

function detectInitialState() {
  if (typeof window === 'undefined') return { standalone: false, ios: false };
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  return { standalone, ios };
}

export function InstallPrompt({ hasBottomChrome = false }: InstallPromptProps) {
  const initial = detectInitialState();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(initial.standalone);
  const [dismissed, setDismissed] = useState(false);
  const [showIosPrompt] = useState(!initial.standalone && initial.ios);

  useEffect(() => {
    const { standalone, ios } = detectInitialState();
    if (standalone || ios) return;
    const handle = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handle);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handle);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  if (installed || dismissed || (!deferredPrompt && !showIosPrompt)) return null;

  const bottom = hasBottomChrome
    ? 'calc(96px + env(safe-area-inset-bottom))'
    : 'calc(20px + env(safe-area-inset-bottom))';

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom,
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface)',
          border: '0.5px solid var(--hairline)',
          borderRadius: 18,
          padding: 12,
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--primary-tint)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="plus" size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
            {showIosPrompt ? 'Add PickleBallers' : 'Install PickleBallers'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {showIosPrompt ? 'Tap Share, then Add to Home Screen' : 'For the best experience'}
          </div>
        </div>
        {!showIosPrompt && (
          <button
            onClick={handleInstall}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 12,
              background: 'var(--ink)',
              color: 'white',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
