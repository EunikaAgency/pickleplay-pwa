// Player-UI design selector. Owns which player-side design is active, app-wide,
// so the floating DesignSwitch can drive every screen (not just Home).
//
//  - 'new'     → today's player UI; Home renders HomeScreenRefined
//  - 'classic' → today's player UI; Home renders the original HomeScreen
//  - 'v2'      → the "Pickleballers Mockup v2.1" redesign across all player screens
//
// The choice persists in localStorage. We reuse the legacy `pb-home-design` key
// so an existing New/Classic preference (stored as 'refined'/'classic') survives
// the upgrade and keeps mapping Home to refined/classic.

import { create } from 'zustand';

export type PlayerDesign = 'new' | 'classic' | 'v2';

const STORAGE_KEY = 'pb-home-design';

function readPref(): PlayerDesign {
  if (typeof window === 'undefined') return 'new';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'v2') return 'v2';
    if (raw === 'classic') return 'classic';
    // Legacy value 'refined' (and the default) map to the new layout.
    return 'new';
  } catch {
    return 'new';
  }
}

function persist(design: PlayerDesign) {
  try {
    window.localStorage.setItem(STORAGE_KEY, design);
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

interface PlayerDesignState {
  design: PlayerDesign;
  setDesign: (design: PlayerDesign) => void;
}

export const usePlayerDesign = create<PlayerDesignState>((set) => ({
  design: readPref(),
  setDesign: (design) => {
    persist(design);
    set({ design });
  },
}));
