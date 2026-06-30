// Push notifications — browser side.
//
// Two channels, tried in order:
// 1. FCM (Firebase Cloud Messaging) — Google's push infrastructure, better
//    delivery on Android (uses Play Services) and free topic/multicast routing.
// 2. VAPID (Web Push) — browser-native, fallback when FCM isn't available.
//
// Both register with our API, which fans a push out to every device the user
// has subscribed. All best-effort: nothing here ever throws to the caller.

import { getPushPublicKey, subscribePush, subscribeFcmToken, unsubscribeFcmToken, unsubscribePush } from './api';
import { getFirebaseMessaging } from './firebase';
import type { Messaging } from 'firebase/messaging';

// Remembered so logout can unbind the device server-side *synchronously*
// while the access token is still valid.
const PUSH_ENDPOINT_KEY = 'pb-push-endpoint';
const FCM_TOKEN_KEY = 'pb-fcm-token';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 'granted' | 'denied' | 'default' | 'unsupported'. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

/* ─── VAPID helpers ────────────────────────────────────────────── */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerVapidSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return;
  await subscribePush({
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  });
  try { localStorage.setItem(PUSH_ENDPOINT_KEY, sub.endpoint); } catch { /* ignore */ }
}

/* ─── FCM helpers ──────────────────────────────────────────────── */

/** The VAPID key from Firebase Console → Cloud Messaging → Web Push certificates. */
const FCM_VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || '';

let _fcMessaging: Messaging | null = null;
async function getMessaging(): Promise<Messaging | null> {
  if (_fcMessaging) return _fcMessaging;
  try {
    _fcMessaging = await getFirebaseMessaging();
    return _fcMessaging;
  } catch {
    return null;
  }
}

/** Gets an FCM token for this device, then registers it with our API. */
async function registerFcmToken(): Promise<boolean> {
  if (!FCM_VAPID_KEY || FCM_VAPID_KEY.startsWith('REPLACE_')) return false;
  const messaging = await getMessaging();
  if (!messaging) return false;

  try {
    const { getToken } = await import('firebase/messaging');
    const swReg = await navigator.serviceWorker.ready;
    const currentToken = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!currentToken) return false;

    await subscribeFcmToken({ token: currentToken, userAgent: navigator.userAgent });
    try { localStorage.setItem(FCM_TOKEN_KEY, currentToken); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

/** Handle foreground FCM messages (show in-app toast or notification). */
async function listenFcmForeground(): Promise<void> {
  const messaging = await getMessaging();
  if (!messaging) return;
  try {
    const { onMessage } = await import('firebase/messaging');
    onMessage(messaging, (payload) => {
      // Foreground messages are handled by the app's UI layer (NotificationsScreen
      // polls + SSE). We just log — the SW handles the OS notification already.
      console.debug('[fcm:fg]', payload.messageId);
    });
  } catch { /* best-effort */ }
}

/* ─── Public API ──────────────────────────────────────────────── */

export type EnablePushResult =
  | { ok: true; channel: 'fcm' | 'vapid' }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error' };

/**
 * Prompt for permission (must come from a user gesture), then subscribe via
 * FCM first (better Android delivery), falling back to VAPID browser push.
 * Idempotent — reuses an existing subscription if there is one.
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    // 1. Try FCM first.
    const fcmOk = await registerFcmToken();
    if (fcmOk) {
      listenFcmForeground();
      return { ok: true, channel: 'fcm' };
    }

    // 2. Fall back to VAPID browser push.
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await getPushPublicKey();
      if (!publicKey) return { ok: false, reason: 'denied' };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await registerVapidSubscription(sub);
    return { ok: true, channel: 'vapid' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Re-bind the device to the current user after login/restore. No prompt,
 * no-op unless permission is already granted. Silently registers both FCM
 * and VAPID so the account stays wired to push.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    // FCM
    await registerFcmToken().catch(() => {});
    // VAPID — reuse existing browser subscription
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await registerVapidSubscription(sub);
  } catch { /* best-effort */ }
}

/**
 * Server-side unbind on logout. Synchronous — reads remembered identifiers
 * and fires the unsubscribe with the still-valid token.
 */
export function unbindPushOnLogout(): void {
  try {
    const endpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);
    if (endpoint) void unsubscribePush(endpoint).catch(() => {});
    localStorage.removeItem(PUSH_ENDPOINT_KEY);

    const fcmToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (fcmToken) void unsubscribeFcmToken(fcmToken).catch(() => {});
    localStorage.removeItem(FCM_TOKEN_KEY);
  } catch { /* ignore */ }
}

/** Fully turn push off on this device (server unbind + browser unsubscribe). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    // FCM
    const fcmToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (fcmToken) {
      await unsubscribeFcmToken(fcmToken).catch(() => {});
      localStorage.removeItem(FCM_TOKEN_KEY);
      // Delete the FCM token so it's not reused
      try {
        const messaging = await getMessaging();
        if (messaging) {
          const { deleteToken } = await import('firebase/messaging');
          await deleteToken(messaging).catch(() => {});
        }
      } catch { /* ok */ }
    }

    // VAPID
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    try { localStorage.removeItem(PUSH_ENDPOINT_KEY); } catch { /* ignore */ }
  } catch { /* best-effort */ }
}
