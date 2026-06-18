import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { usePlayerDesign, type PlayerDesign } from '../../shared/lib/playerDesign';

/**
 * Floating reviewer control that switches the player-side design app-wide:
 *
 *   New      → current layout; Home renders HomeScreenRefined
 *   Classic  → current layout; Home renders the original HomeScreen
 *   v2.1     → the "Pickleballers Mockup v2.1" redesign across all player screens
 *
 * Collapsible so it doesn't block content: it sits as a small "UI" handle by
 * default and expands to the option row on tap (collapse state persists in
 * localStorage). Uses the app's own design tokens (not v2 ones) and renders
 * outside any `.pb-v2` wrapper. The design choice persists via `usePlayerDesign`.
 * Mounted from App.tsx on player tab screens so the user can switch from any tab.
 */
const OPEN_KEY = 'pb-designswitch-open';
function loadOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}

const POS = 'fixed z-[1001] left-4 bottom-[calc(96px+env(safe-area-inset-bottom))] lg:left-[264px] lg:bottom-4';

export function DesignSwitch() {
  const design = usePlayerDesign((s) => s.design);
  const setDesign = usePlayerDesign((s) => s.setDesign);
  const [open, setOpen] = useState(loadOpen);

  const setOpenPersist = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };

  // Collapsed: a small unobtrusive handle showing the active design.
  if (!open) {
    const label = design === 'v2' ? 'v2.1' : design === 'classic' ? 'Classic' : 'New';
    return (
      <button
        type="button"
        onClick={() => setOpenPersist(true)}
        aria-label={`Design: ${label}. Tap to change`}
        className={`${POS} flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)] t-eyebrow opacity-80 hover:opacity-100 transition-opacity`}
      >
        <Icon name="sliders" size={13} /> {label}
      </button>
    );
  }

  const pill = (value: PlayerDesign, label: string) => (
    <button
      type="button"
      onClick={() => setDesign(value)}
      aria-pressed={design === value}
      className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
        design === value ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-2)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`${POS} flex items-center gap-1 p-1 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]`}
      role="group"
      aria-label="Player design"
    >
      <span className="flex items-center gap-1 pl-2 pr-0.5 t-eyebrow">
        <Icon name="sliders" size={13} /> UI
      </span>
      {pill('new', 'New')}
      {pill('classic', 'Classic')}
      {pill('v2', 'v2.1')}
      <button
        type="button"
        onClick={() => setOpenPersist(false)}
        aria-label="Collapse design switcher"
        className="w-6 h-6 ml-0.5 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
