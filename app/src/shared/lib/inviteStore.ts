import { create } from 'zustand';
import { listGames } from './api';

// Tiny global store for the live count of pending Open Play invites — the games
// someone invited you to that you haven't accepted/declined yet. The floating
// "Invites" FAB subscribes (`useInviteStore((s) => s.count)`) to show a badge,
// so the user knows they have invites without opening the Games tab. `refresh()`
// re-fetches; the polling hook keeps it current (see hooks/useInvitePolling.ts).
//
// Mirrors the Games screen's `openInvitedGames` set: invited games whose type is
// Open Play (`gameType` empty/"open"). Inlined here so shared/ never imports the
// games feature.
interface InviteState {
  count: number;
  setCount: (n: number) => void;
  refresh: () => Promise<void>;
}

export const useInviteStore = create<InviteState>((set) => ({
  count: 0,
  setCount: (n) => set({ count: Math.max(0, n) }),
  refresh: async () => {
    try {
      const games = await listGames({ invited: true });
      const openInvites = games.filter((g) => ((g.gameType || '').toLowerCase() || 'open') === 'open');
      set({ count: openInvites.length });
    } catch {
      /* best-effort — leave the last known count */
    }
  },
}));
