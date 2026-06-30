// In-process realtime bus for per-USER events (new notifications + incoming
// direct messages). `notify.ts` and the messages controller publish here; the
// SSE endpoint (GET /api/v1/me/stream) subscribes per user and forwards each
// event to that user's connected EventSource. This mirrors the Clubs feed bus
// (clubs.events.ts), but keyed by user instead of by club.
//
// Correct for the current single PM2 process. If the API is ever scaled to a
// cluster, an in-process EventEmitter only reaches clients on the SAME
// instance — swap this module for a Redis pub/sub client publishing to /
// subscribing from the same `user:${userId}` channel, keeping
// publishUserEvent / subscribeUser signatures unchanged so callers don't change.
import { EventEmitter } from 'node:events';

export type UserStreamEvent = { event: string; data: unknown };

const bus = new EventEmitter();
// One listener per open SSE connection — uncapped so a user with several open
// tabs/devices doesn't trip the default 10-listener warning.
bus.setMaxListeners(0);

const channel = (userId: string) => `user:${userId}`;

/** Emit an event to every SSE subscriber of a user. Best-effort, never throws. */
export function publishUserEvent(userId: unknown, event: string, data: unknown): void {
  if (!userId) return;
  bus.emit(channel(String(userId)), { event, data } satisfies UserStreamEvent);
}

/** Subscribe an SSE connection to a user. Returns an unsubscribe fn — call it on
 *  stream abort to avoid leaking a listener per reconnect. */
export function subscribeUser(userId: string, handler: (e: UserStreamEvent) => void): () => void {
  const ch = channel(userId);
  bus.on(ch, handler);
  return () => bus.off(ch, handler);
}
