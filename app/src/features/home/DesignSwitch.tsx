import { Icon } from '../../shared/components/ui/Icon';
import { usePlayerDesign, type PlayerDesign } from '../../shared/lib/playerDesign';

/**
 * Floating reviewer control that switches the player-side design app-wide:
 *
 *   New      → current layout; Home renders HomeScreenRefined
 *   Classic  → current layout; Home renders the original HomeScreen
 *   v2.1     → the "Pickleballers Mockup v2.1" redesign across all player screens
 *
 * It deliberately uses the app's own design tokens (not the v2 ones) and renders
 * outside any `.pb-v2` wrapper, so it keeps the current brand look in every mode.
 * The choice persists via `usePlayerDesign` (localStorage). Mounted from App.tsx
 * on player tab screens so the user can switch back from any tab.
 */
export function DesignSwitch() {
  const design = usePlayerDesign((s) => s.design);
  const setDesign = usePlayerDesign((s) => s.setDesign);

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
      className="home-design-switch fixed z-[1001] left-4 bottom-[calc(96px+env(safe-area-inset-bottom))] lg:left-[264px] lg:bottom-4 flex items-center gap-1 p-1 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]"
      role="group"
      aria-label="Player design"
    >
      <span className="flex items-center gap-1 pl-2 pr-0.5 t-eyebrow">
        <Icon name="sliders" size={13} /> UI
      </span>
      {pill('new', 'New')}
      {pill('classic', 'Classic')}
      {pill('v2', 'v2.1')}
    </div>
  );
}
