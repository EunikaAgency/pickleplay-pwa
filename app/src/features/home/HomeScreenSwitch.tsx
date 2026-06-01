import { useEffect, useState } from 'react';
import { HomeScreen } from './HomeScreen';
import { HomeScreenRefined } from './HomeScreenRefined';
import { Icon } from '../../shared/components/ui/Icon';
import type { Navigate } from '../../shared/lib/navigation';

interface HomeScreenSwitchProps {
  onNavigate: Navigate;
}

type HomeDesign = 'refined' | 'classic';
const STORAGE_KEY = 'pb-home-design';

function readPref(): HomeDesign {
  if (typeof window === 'undefined') return 'refined';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'classic' ? 'classic' : 'refined';
  } catch {
    return 'refined';
  }
}

/**
 * Mounts the home screen and lets a reviewer flip between the new ("refined")
 * layout and the original ("classic") one. The choice persists in
 * localStorage, so it survives reloads. Layout only — both screens share the
 * same fonts, colors, components and brand.
 */
export function HomeScreenSwitch({ onNavigate }: HomeScreenSwitchProps) {
  const [design, setDesign] = useState<HomeDesign>(readPref);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, design);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }, [design]);

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
      active ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-2)]'
    }`;

  return (
    <>
      {design === 'refined' ? (
        <HomeScreenRefined onNavigate={onNavigate} />
      ) : (
        <HomeScreen onNavigate={onNavigate} />
      )}

      <div
        className="home-design-switch fixed z-[1001] left-4 bottom-[calc(96px+env(safe-area-inset-bottom))] lg:left-[264px] lg:bottom-4 flex items-center gap-1 p-1 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]"
        role="group"
        aria-label="Home layout"
      >
        <span className="flex items-center gap-1 pl-2 pr-0.5 t-eyebrow">
          <Icon name="sliders" size={13} /> Home
        </span>
        <button
          type="button"
          onClick={() => setDesign('refined')}
          aria-pressed={design === 'refined'}
          className={pill(design === 'refined')}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => setDesign('classic')}
          aria-pressed={design === 'classic'}
          className={pill(design === 'classic')}
        >
          Classic
        </button>
      </div>
    </>
  );
}
