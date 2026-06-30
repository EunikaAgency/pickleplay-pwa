import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
  subscribeFcm,
  unsubscribeFcm,
} from './push.controller.js';

const pushRoutes = new Hono();

// VAPID public key is needed before a user can subscribe, so it's open.
pushRoutes.get('/public-key', getPushPublicKey);
pushRoutes.post('/subscribe', requireAuth, subscribePush);
pushRoutes.post('/unsubscribe', requireAuth, unsubscribePush);

// FCM token registration (Google push, better Android delivery).
pushRoutes.post('/fcm-subscribe', requireAuth, subscribeFcm);
pushRoutes.post('/fcm-unsubscribe', requireAuth, unsubscribeFcm);

export default pushRoutes;
