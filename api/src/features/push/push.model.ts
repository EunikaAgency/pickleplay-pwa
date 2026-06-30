import { Schema, model } from 'mongoose';

// ── VAPID Web Push subscriptions (browser-native) ──────────────────
// One row per device/browser. The `endpoint` is the push service URL and is
// globally unique, so we upsert on it; `keys` holds the client's ECDH public
// key + auth secret used to encrypt payloads.

const pushSubscriptionSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint:  { type: String, required: true, unique: true },
  keys:      {
    p256dh:  { type: String, required: true },
    auth:    { type: String, required: true },
  },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: true });

pushSubscriptionSchema.index({ userId: 1 });

export const PushSubscription = model('PushSubscription', pushSubscriptionSchema);

// ── FCM device tokens (Firebase Cloud Messaging) ──────────────────
// One row per device. The FCM token is globally unique (Google generates it),
// so we upsert on it. The same device may have both an FCM token AND a VAPID
// subscription — the backend fans out to both.

const fcmTokenSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true, unique: true },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: true });

fcmTokenSchema.index({ userId: 1 });

export const FcmToken = model('FcmToken', fcmTokenSchema);
