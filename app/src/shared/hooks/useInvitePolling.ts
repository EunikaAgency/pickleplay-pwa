import { useEffect } from 'react';
import { useInviteStore } from '../lib/inviteStore';
import { onRealtime } from '../lib/realtimeBus';

// How often to re-poll the pending-invite tally while the app is open. Invites
// also arrive over the realtime stream (`game.invited`), which we subscribe to
// for an instant bump; this interval + focus/visibility refresh are the fallback
// (mirrors useMessagePolling).
const POLL_MS = 30_000;

/** Keep the "Invites" FAB badge live while logged in. Polls on an interval, on
 *  window focus / tab visibility, and on the realtime `game.invited` event;
 *  clears to 0 when logged out. */
export function useInvitePolling(enabled: boolean) {
  const refresh = useInviteStore((s) => s.refresh);
  const setCount = useInviteStore((s) => s.setCount);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const unsub = onRealtime('game.invited', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      unsub();
    };
  }, [enabled, refresh, setCount]);
}
