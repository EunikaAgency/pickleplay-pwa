// Firebase Admin — server-side push sender via FCM (Firebase Cloud Messaging).
// Lazily initialised: if no service account JSON is configured, FCM is silently
// skipped and the existing VAPID path handles all push delivery.
//
// Setup:
//   1. In Firebase Console → Project Settings → Service accounts, generate a
//      new private key (JSON).
//   2. Either set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON string, or set
//      GOOGLE_APPLICATION_CREDENTIALS to the path of the downloaded file.

import type { App } from 'firebase-admin/app';

let _app: App | null = null;
let _fcmEnabled = false;

function loadServiceAccount(): Record<string, any> | null {
  // Full JSON blob (env-var style, works without a file on disk).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  // Let the SDK fall back to GOOGLE_APPLICATION_CREDENTIALS env var.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined as any;
  return null;
}

export function isFcmEnabled(): boolean {
  return _fcmEnabled;
}

async function getApp(): Promise<App | null> {
  if (_app) return _app;
  const creds = loadServiceAccount();
  if (creds === null) return null;  // not configured

  try {
    const { initializeApp, cert } = await import('firebase-admin/app');
    _app = creds
      ? initializeApp({ credential: cert(creds) })
      : initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
    _fcmEnabled = true;
    console.log('[fcm] Firebase Admin initialised');
    return _app;
  } catch (err) {
    console.warn('[fcm] Firebase Admin init failed, FCM disabled:', (err as Error).message);
    return null;
  }
}

export interface FcmPayload {
  title: string;
  body: string;
  /** In-app path the SW opens on click. */
  url?: string;
  /** Collapses repeat notifications for the same subject. */
  tag?: string;
}

/**
 * Send a push to a single FCM device token. Never throws.
 * Returns true if the send succeeded, false otherwise (including expired tokens).
 */
export async function sendFcm(token: string, payload: FcmPayload): Promise<boolean> {
  const app = await getApp();
  if (!app) return false;

  try {
    const { getMessaging } = await import('firebase-admin/messaging');
    await getMessaging().send({
      token,
      data: {
        // FCM data messages deliver a JSON payload the SW parses and shows.
        // Using data-only (no notification object) so our firebase-messaging-sw.js
        // handles the display consistently with the VAPID push-sw.js path.
        payload: JSON.stringify(payload),
      },
      android: {
        priority: 'high',
      },
    });
    return true;
  } catch (err: any) {
    // The token is no longer valid — caller should clean it up.
    if (
      err?.code === 'messaging/invalid-registration-token' ||
      err?.code === 'messaging/registration-token-not-registered'
    ) {
      return false; // caller prunes
    }
    // Transient error — token is still valid, just couldn't deliver right now.
    return true; // don't prune
  }
}

/**
 * Send a push to all of a user's FCM-registered devices. Dead tokens are pruned.
 * Never throws.
 */
export async function sendFcmToUser(userId: unknown, payload: FcmPayload): Promise<void> {
  const app = await getApp();
  if (!app || !userId) return;

  let tokens: any[];
  try {
    const { FcmToken } = await import('../../features/push/push.model.js');
    tokens = await FcmToken.find({ userId }).lean();
  } catch {
    return;
  }
  if (!tokens.length) return;

  await Promise.all(
    tokens.map(async (t) => {
      const ok = await sendFcm(t.token, payload);
      if (!ok) {
        // Dead token — remove it so we stop trying.
        const { FcmToken } = await import('../../features/push/push.model.js');
        await FcmToken.deleteOne({ _id: t._id }).catch(() => {});
      }
    }),
  );
}
