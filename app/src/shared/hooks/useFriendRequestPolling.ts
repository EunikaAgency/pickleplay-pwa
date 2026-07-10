import { useEffect } from 'react';
import { useFriendRequestStore } from '../lib/friendRequestStore';
import { onRealtime } from '../lib/realtimeBus';

// How often to re-poll the pending friend-request tally while the app is open.
// Requests also arrive over the realtime stream (a `notification` bus event),
// which refreshes immediately; the interval + focus/visibility refresh is the
// fallback, mirroring useMessagePolling.ts.
const POLL_MS = 30_000;

/** Keep the Social tab's friend-request badge live while logged in.
 *  Clears to 0 when logged out, so the badge simply cannot render for guests. */
export function useFriendRequestPolling(enabled: boolean) {
  const refresh = useFriendRequestStore((s) => s.refresh);
  const setPending = useFriendRequestStore((s) => s.setPending);

  useEffect(() => {
    if (!enabled) {
      setPending(0);
      return;
    }
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const offRealtime = onRealtime('notification', refresh);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      offRealtime();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, refresh, setPending]);
}
