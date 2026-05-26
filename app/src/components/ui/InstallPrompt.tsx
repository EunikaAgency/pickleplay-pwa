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

export function InstallPrompt({ hasBottomChrome = false }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
    if (isStandalone) return;

    const platform = window.navigator.platform || '';
    const userAgent = window.navigator.userAgent || '';
    const isAppleTouchDevice = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

    if (isAppleTouchDevice) {
      setShowIosPrompt(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (installed || dismissed || (!deferredPrompt && !showIosPrompt)) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 mx-auto max-w-md animate-slide-up"
      style={{
        bottom: hasBottomChrome ? 'calc(7rem + env(safe-area-inset-bottom))' : 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="flex items-center gap-3 rounded-[14px] bg-surface-container-lowest p-4 border border-outline-variant/50"
        style={{ boxShadow: '0 10px 30px -10px rgba(0, 64, 224, 0.15)' }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon name={showIosPrompt ? 'ios_share' : 'install_mobile'} size={24} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-body-lg font-bold text-on-surface">
            {showIosPrompt ? 'Add PickleBaller' : 'Install PickleBaller'}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {showIosPrompt ? 'Tap Share, then Add to Home Screen' : 'Add to home screen for the best experience'}
          </p>
        </div>
        {!showIosPrompt && (
          <button
            onClick={handleInstallClick}
            className="shrink-0 h-10 rounded-full bg-primary px-5 text-label-sm font-bold text-on-primary active:scale-95 transition-all"
          >
            Install
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-90"
          aria-label="Close"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  );
}
