import { useEffect } from 'react';
import { apiUrl, getAccessToken } from '../lib/api';
import { emitRealtime } from '../lib/realtimeBus';
import { useNotificationStore } from '../lib/notificationStore';

// Opens ONE app-wide EventSource to GET /api/v1/me/stream while logged in, so
// new notifications and incoming direct messages arrive in realtime instead of
// waiting for the 30s poll. Events are fanned out via the in-app realtime bus
// (realtimeBus.ts): screens subscribe to 'message' / 'notification'. The
// notification unread badge is refreshed authoritatively on any event.
//
// EventSource can't set an Authorization header, so the access token rides in
// ?token=. Tokens expire (~15 min); EventSource does NOT auto-reconnect on an
// HTTP error response, so we manage reconnection ourselves and read a FRESH
// token each attempt (the 30s poll's API calls keep the stored token current).
// The poll in useNotificationPolling stays as a fallback if the stream drops.
const RECONNECT_MS = 5_000;

export function useRealtimeStream(enabled: boolean) {
  const refresh = useNotificationStore((s) => s.refresh);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let retry: number | null = null;
    let closed = false;

    const onMessage = (ev: MessageEvent) => {
      let data: any = null;
      try { data = JSON.parse(ev.data); } catch { /* ignore malformed frame */ }
      if (data) emitRealtime('message', data);
      void refresh(); // a new message also bumps the notification tally
    };
    const onMessageDeleted = (ev: MessageEvent) => {
      let data: any = null;
      try { data = JSON.parse(ev.data); } catch { /* ignore */ }
      if (data) emitRealtime('message.deleted', data);
    };
    const onGameMessage = (ev: MessageEvent) => {
      let data: any = null;
      try { data = JSON.parse(ev.data); } catch { /* ignore */ }
      if (data) emitRealtime('game.message', data);
    };
    const onNotification = (ev: MessageEvent) => {
      let data: any = null;
      try { data = JSON.parse(ev.data); } catch { /* ignore */ }
      emitRealtime('notification', data);
      void refresh();
    };

    const connect = () => {
      if (closed) return;
      const token = getAccessToken();
      if (!token) { retry = window.setTimeout(connect, RECONNECT_MS); return; }
      try {
        es = new EventSource(`${apiUrl('/api/v1/me/stream')}?token=${encodeURIComponent(token)}`);
      } catch {
        retry = window.setTimeout(connect, RECONNECT_MS);
        return;
      }
      es.addEventListener('message.created', onMessage);
      es.addEventListener('message.deleted', onMessageDeleted);
      es.addEventListener('game.message.created', onGameMessage);
      es.addEventListener('notification.created', onNotification);
      es.onerror = () => {
        // EventSource won't recover from an HTTP error (e.g. expired token), so
        // tear down and reconnect ourselves with a freshly-read token.
        es?.close();
        es = null;
        if (!closed && retry == null) retry = window.setTimeout(() => { retry = null; connect(); }, RECONNECT_MS);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      es?.close();
    };
  }, [enabled, refresh]);
}
