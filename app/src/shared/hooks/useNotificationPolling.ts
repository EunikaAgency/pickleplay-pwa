import { useEffect } from 'react';
import { useNotificationStore } from '../lib/notificationStore';

// How often to re-poll the unread tally while the app is open. Notifications
// also arrive via Web Push (OS) when the app is closed; this keeps the in-app
// badge live without a websocket. We additionally refresh on focus/visibility
// so switching back to the tab updates the badge immediately.
const POLL_MS = 30_000;

/** Keep the unread-notification badge live while logged in. Polls on an
 *  interval plus on window focus / tab visibility; clears to 0 when logged out. */
export function useNotificationPolling(enabled: boolean) {
  const refresh = useNotificationStore((s) => s.refresh);
  const setUnread = useNotificationStore((s) => s.setUnread);

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
