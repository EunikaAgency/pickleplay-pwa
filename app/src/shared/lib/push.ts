// Web Push (OS notifications) — browser side. Subscribes this device through the
// service worker and registers it with the API, which signs + sends pushes via
// VAPID (e.g. "your lobby is full"). All best-effort: nothing here ever throws to
// the caller, and everything no-ops where push isn't supported.

import { getPushPublicKey, subscribePush, unsubscribePush } from './api';

// Remembered so logout can unbind the device server-side *synchronously* (while
// the access token is still valid), without an async getSubscription() round-trip.
const PUSH_ENDPOINT_KEY = 'pb-push-endpoint';

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

/** VAPID public keys are base64url; the subscribe API wants a Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registerSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return;
  await subscribePush({
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  });
  try { localStorage.setItem(PUSH_ENDPOINT_KEY, sub.endpoint); } catch { /* ignore */ }
}

export type EnablePushResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-key' | 'error' };

/**
 * Prompt for permission (must be from a user gesture), subscribe via the service
 * worker, and register the subscription with the API. Idempotent — reuses an
 * existing browser subscription if there is one.
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await getPushPublicKey();
      if (!publicKey) return { ok: false, reason: 'no-key' };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await registerSubscription(sub);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Re-bind an existing browser subscription to the current user (call after
 * login/restore). No prompt, no-op unless permission is already granted and a
 * subscription exists — so it silently keeps the right account wired to push.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await registerSubscription(sub);
  } catch { /* best-effort */ }
}

/**
 * Server-side unbind on logout. Synchronous on purpose: it reads the remembered
 * endpoint and fires the unsubscribe with the still-valid token before the
 * caller clears the session. The browser subscription itself is kept so a later
 * login can silently re-bind it.
 */
export function unbindPushOnLogout(): void {
  try {
    const endpoint = localStorage.getItem(PUSH_ENDPOINT_KEY);
    if (endpoint) void unsubscribePush(endpoint).catch(() => { /* best-effort */ });
    localStorage.removeItem(PUSH_ENDPOINT_KEY);
  } catch { /* ignore */ }
}

/** Fully turn push off on this device (server unbind + browser unsubscribe). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint).catch(() => { /* best-effort */ });
      await sub.unsubscribe().catch(() => { /* best-effort */ });
    }
    try { localStorage.removeItem(PUSH_ENDPOINT_KEY); } catch { /* ignore */ }
  } catch { /* best-effort */ }
}
