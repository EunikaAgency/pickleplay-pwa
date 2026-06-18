import { create } from 'zustand';
import { getUnreadNotificationCount } from './api';

// Tiny global store for the live unread-notification count. Any component can
// subscribe (`useNotificationStore((s) => s.unread)`) to show a badge, so we
// don't thread the count through props. `refresh()` re-fetches the tally; the
// polling hook keeps it current while the app is open (see
// shared/hooks/useNotificationPolling.ts), and screens that mark notifications
// read call refresh()/setUnread() to update the badge immediately.
interface NotificationState {
  unread: number;
  setUnread: (n: number) => void;
  refresh: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unread: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  refresh: async () => {
    try {
      const n = await getUnreadNotificationCount();
      set({ unread: n });
    } catch {
      /* best-effort — leave the last known count */
    }
  },
}));
