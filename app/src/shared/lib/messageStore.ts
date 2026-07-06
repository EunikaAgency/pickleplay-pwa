import { create } from 'zustand';
import { getUnreadMessageCount } from './api';

// Tiny global store for the live unread-message count. Any component can
// subscribe (`useMessageStore((s) => s.unread)`) to show a badge on the
// Messages button, so we don't thread the count through props. `refresh()`
// re-fetches the tally; the polling hook keeps it current while the app is
// open (see shared/hooks/useMessagePolling.ts).
interface MessageState {
  unread: number;
  setUnread: (n: number) => void;
  refresh: () => Promise<void>;
}

export const useMessageStore = create<MessageState>((set) => ({
  unread: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  refresh: async () => {
    try {
      const n = await getUnreadMessageCount();
      set({ unread: n });
    } catch {
      /* best-effort — leave the last known count */
    }
  },
}));
