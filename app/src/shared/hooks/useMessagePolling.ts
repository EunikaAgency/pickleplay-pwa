import { useEffect } from 'react';
import { useMessageStore } from '../lib/messageStore';

// How often to re-poll the unread message tally while the app is open.
// Messages also arrive via the realtime stream in ConversationsScreen; this
// keeps the sidebar/tab-bar badge live as a fallback. We additionally refresh
// on focus/visibility so switching back to the tab updates the badge immediately.
const POLL_MS = 30_000;

/** Keep the unread-message badge live while logged in. Polls on an interval
 *  plus on window focus / tab visibility; clears to 0 when logged out. */
export function useMessagePolling(enabled: boolean) {
  const refresh = useMessageStore((s) => s.refresh);
  const setUnread = useMessageStore((s) => s.setUnread);

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, refresh, setUnread]);
}
