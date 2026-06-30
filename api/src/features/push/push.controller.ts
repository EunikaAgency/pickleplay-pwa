import { z } from 'zod';
import { PushSubscription, FcmToken } from './push.model.js';
import { vapidPublicKey } from '../../shared/lib/push.js';

const vapidSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(300).optional(),
});

const vapidUnsubscribeSchema = z.object({ endpoint: z.string().url() });

const fcmSubscribeSchema = z.object({
  token: z.string().min(1),
  userAgent: z.string().max(300).optional(),
});

const fcmUnsubscribeSchema = z.object({ token: z.string().min(1) });

/* ─── VAPID Web Push ────────────────────────────────────────────── */

/** Public: the VAPID public key the browser needs to create a subscription. */
export async function getPushPublicKey(c: any) {
  return c.json({ data: { publicKey: vapidPublicKey() } });
}

/** Register (or refresh) the caller's VAPID Web Push subscription. */
export async function subscribePush(c: any) {
  const user = c.get('user');
  const body = vapidSubscribeSchema.parse(await c.req.json());
  const sub = await PushSubscription.findOneAndUpdate(
    { endpoint: body.endpoint },
    { userId: user.sub, endpoint: body.endpoint, keys: body.keys, userAgent: body.userAgent },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return c.json({ data: { id: String((sub as any)._id), subscribed: true } }, 201);
}

/** Remove a VAPID subscription (logout / turn-off). */
export async function unsubscribePush(c: any) {
  const user = c.get('user');
  const { endpoint } = vapidUnsubscribeSchema.parse(await c.req.json());
  await PushSubscription.deleteOne({ endpoint, userId: user.sub });
  return c.json({ data: { unsubscribed: true } });
}

/* ─── FCM device tokens ─────────────────────────────────────────── */

/** Register (or refresh) the caller's FCM device token. */
export async function subscribeFcm(c: any) {
  const user = c.get('user');
  const body = fcmSubscribeSchema.parse(await c.req.json());
  const doc = await FcmToken.findOneAndUpdate(
    { token: body.token },
    { userId: user.sub, token: body.token, userAgent: body.userAgent },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return c.json({ data: { id: String((doc as any)._id), subscribed: true } }, 201);
}

/** Remove an FCM token (logout / turn-off). */
export async function unsubscribeFcm(c: any) {
  const user = c.get('user');
  const { token } = fcmUnsubscribeSchema.parse(await c.req.json());
  await FcmToken.deleteOne({ token, userId: user.sub });
  return c.json({ data: { unsubscribed: true } });
}
