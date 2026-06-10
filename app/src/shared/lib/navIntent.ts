// One-shot navigation intent. Tab navigation can't carry params (the screen-stack
// strips them for tab screens), so when one screen wants a destination tab to open
// on a specific sub-view, it sets the intent right before navigating; the
// destination reads + clears it once on mount.

type GamesTab = 'booking' | 'games';

let pendingGamesTab: GamesTab | null = null;

/** Request which top tab the Games screen should open on (set just before navigating to 'games'). */
export function setPendingGamesTab(tab: GamesTab): void {
  pendingGamesTab = tab;
}

/** Read + clear the pending Games tab (call once when the Games screen mounts). */
export function takePendingGamesTab(): GamesTab | null {
  const t = pendingGamesTab;
  pendingGamesTab = null;
  return t;
}
