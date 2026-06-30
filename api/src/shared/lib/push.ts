// Push send helper. Fans a payload out to every device a user has registered.
// Two channels, tried in parallel:
// 1. FCM (Firebase Cloud Messaging) — Google's push infrastructure, better
//    Android delivery (uses Play Services).
// 2. VAPID (Web Push) — browser-native fallback.
//
// Dead subscriptions (404/410/expired FCM tokens) are pruned automatically.
// Entirely best-effort: push is a courtesy layer on top of persisted in-app
// notifications.

import webpush from 'web-push';
import { PushSubscription } from '../../features/push/push.model.js';
import { sendFcmToUser } from './firebase.js';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notify@pickleballer.eunika.xyz';

export const pushEnabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY as string, PRIVATE_KEY as string);
}

/** The VAPID public key clients need to subscribe (safe to expose). */
export function vapidPublicKey(): string | null {
  return PUBLIC_KEY ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the SW opens on click (e.g. "/games/<id>"). */
  url?: string;
  /** Collapses repeat notifications for the same subject. */
  tag?: string;
}

/**
 * Send a push to every device the user has registered — FCM tokens AND VAPID
 * subscriptions. Dead endpoints are pruned. Never throws.
 */
export async function sendPushToUser(userId: unknown, payload: PushPayload): Promise<void> {
  if (!userId) return;

  // FCM first (better Android delivery, free topic routing).
  // Runs in parallel with VAPID below — they're independent.
  const fcmPromise = sendFcmToUser(userId, payload).catch(() => {});

  // VAPID Web Push (browser-native fallback).
  const vapidPromise = (async () => {
    if (!pushEnabled) return;
    let subs: any[];
    try {
      subs = await PushSubscription.find({ userId }).lean();
    } catch {
      return;
    }
    if (!subs.length) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
        } catch (err: any) {
          // The subscription expired or was revoked — drop it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
          }
        }
      }),
    );
  })();

  await Promise.allSettled([fcmPromise, vapidPromise]);
}
