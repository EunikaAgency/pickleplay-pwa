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

// Remember a dismissal so the banner stays gone across reloads/navigation instead
// of nagging on every visit.
const DISMISSED_KEY = 'pb-install-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
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
  const [dismissed, setDismissed] = useState(wasDismissed);
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
      className="install-prompt fixed left-3 right-3 max-w-[480px] mx-auto z-50"
      style={{ bottom }}
    >
      <div className="flex items-center gap-3 p-3 rounded-[18px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <Icon name="plus" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">
            {showIosPrompt ? 'Add PickleBallers' : 'Install PickleBallers'}
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            {showIosPrompt ? 'Tap Share, then Add to Home Screen' : 'For the best experience'}
          </div>
        </div>
        {!showIosPrompt && (
          <button
            onClick={handleInstall}
            className="h-9 px-3.5 rounded-xl bg-[var(--ink)] text-white font-heading font-semibold text-[13px]"
          >
            Install
          </button>
        )}
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_KEY, '1');
            } catch {
              // localStorage may be unavailable; the banner just reappears next load.
            }
            setDismissed(true);
          }}
          aria-label="Close"
          className="w-8 h-8 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
