// One place that records an in-app notification AND fires an OS push for the same
// event, so a notify-worthy thing reaches the user whether the app is open
// (in-app inbox) or closed (Web Push). Everything here is best-effort: a failed
// insert or push never throws to the caller — the underlying action already
// succeeded and notifications are a courtesy layer.

import { Notification } from '../../features/interactions/interactions.model.js';
import { sendPushToUser } from './push.js';
import { publishUserEvent } from './userEvents.js';

/** Realtime payload pushed to a user's open SSE stream when a notification lands. */
function notificationEvent(id: string | null, p: NotifyPayload) {
  return { id, type: p.type, title: p.title, body: p.body, icon: p.icon ?? null, linkUrl: p.linkUrl ?? null };
}

export interface NotifyPayload {
  /** Short category string stored on the in-app notification (e.g. 'game_join'). */
  type: string;
  title: string;
  body: string;
  /** Material Symbols icon name for the in-app row (push uses the app icon). */
  icon?: string;
  /** In-app path opened on click, for both the inbox row and the push. */
  linkUrl?: string;
  /** Push collapse tag (repeat pushes for the same subject replace). Defaults to `type`. */
  tag?: string;
}

/** Notify a single user: persist the in-app notification + best-effort OS push. */
export async function notifyUser(userId: unknown, p: NotifyPayload): Promise<void> {
  if (!userId) return;
  let createdId: string | null = null;
  try {
    const doc = await Notification.create({ userId: userId as any, type: p.type, title: p.title, body: p.body, icon: p.icon, linkUrl: p.linkUrl });
    createdId = String((doc as any)._id);
  } catch {
    /* in-app notification is best-effort */
  }
  // Live-push to the user's open app (realtime badge + inbox) — best-effort.
  publishUserEvent(userId, 'notification.created', notificationEvent(createdId, p));
  await sendPushToUser(userId, { title: p.title, body: p.body, url: p.linkUrl, tag: p.tag ?? p.type });
}

/**
 * Notify many users at once (deduped, falsy ids dropped). Persists all in-app
 * rows in one insert, then pushes each device set. The caller is responsible for
 * excluding the actor when a self-notification isn't wanted.
 */
export async function notifyUsers(userIds: Array<unknown>, p: NotifyPayload): Promise<void> {
  const ids = [...new Set(userIds.map((u) => (u ? String(u) : null)).filter(Boolean))] as string[];
  if (!ids.length) return;
  let docs: any[] = [];
  try {
    docs = await Notification.insertMany(
      ids.map((userId) => ({ userId, type: p.type, title: p.title, body: p.body, icon: p.icon, linkUrl: p.linkUrl })),
    );
  } catch {
    /* in-app notifications are best-effort */
  }
  // Live-push to each user's open app (realtime badge + inbox) — best-effort.
  // insertMany preserves input order, so docs[i] lines up with ids[i].
  ids.forEach((id, i) => publishUserEvent(id, 'notification.created', notificationEvent(docs[i] ? String(docs[i]._id) : null, p)));
  await Promise.all(
    ids.map((id) => sendPushToUser(id, { title: p.title, body: p.body, url: p.linkUrl, tag: p.tag ?? p.type })),
  );
}
