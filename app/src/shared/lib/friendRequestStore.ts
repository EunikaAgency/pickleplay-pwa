import { create } from 'zustand';
import { listPendingFriendRequests } from './api';

// Tiny global store for the count of friend requests *awaiting my answer*.
// The Social tab badge subscribes (`useFriendRequestStore((s) => s.pending)`),
// so the count doesn't have to be threaded through chrome props — the same
// pattern messageStore.ts uses for the unread-message badge.
//
// Before this existed, an incoming friend request produced exactly one
// notification and then vanished; nothing persisted, so Friends was
// unreachable in practice. The badge is what makes it discoverable.
interface FriendRequestState {
  pending: number;
  /** False until the count is known once. The Social tab's landing rule waits on
   *  this, otherwise a cold load would always read 0 and never open on Friends. */
  loaded: boolean;
  setPending: (n: number) => void;
  refresh: () => Promise<void>;
}

export const useFriendRequestStore = create<FriendRequestState>((set) => ({
  pending: 0,
  loaded: false,
  setPending: (n) => set({ pending: Math.max(0, n), loaded: true }),
  refresh: async () => {
    try {
      const rows = await listPendingFriendRequests();
      // `sentByMe` requests are waiting on *them*, not on me — they don't badge.
      set({ pending: rows.filter((r) => !r.sentByMe).length, loaded: true });
    } catch {
      // Best-effort — keep the last known count, but unblock the landing rule
      // rather than holding the screen on a skeleton forever.
      set({ loaded: true });
    }
  },
}));
