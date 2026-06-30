// In-process realtime bus for the Clubs feed. Mutations (post/reply/delete,
// reaction change, member joined) publish here; the SSE endpoint
// (GET /api/v1/clubs/:id/stream) subscribes per club and forwards each event to
// connected EventSource clients.
//
// This is correct for the current single PM2 process. If the API is ever scaled
// to a cluster, an in-process EventEmitter only reaches clients connected to the
// SAME instance — swap this module for a Redis pub/sub client publishing to /
// subscribing from the same `club:${clubId}` channel, keeping publishClubEvent /
// subscribeClub signatures unchanged so callers don't change.
import { EventEmitter } from 'node:events';

export type ClubStreamEvent = { event: string; data: unknown };

const bus = new EventEmitter();
// One listener per open SSE connection — uncapped so a busy club with many
// viewers doesn't trip the default 10-listener MaxListenersExceededWarning.
bus.setMaxListeners(0);

const channel = (clubId: string) => `club:${clubId}`;

/** Emit an event to every SSE subscriber of a club. */
export function publishClubEvent(clubId: unknown, event: string, data: unknown): void {
  bus.emit(channel(String(clubId)), { event, data } satisfies ClubStreamEvent);
}

/** Subscribe an SSE connection to a club. Returns an unsubscribe fn — call it on
 *  stream abort to avoid leaking a listener per reconnect. */
export function subscribeClub(clubId: string, handler: (e: ClubStreamEvent) => void): () => void {
  const ch = channel(clubId);
  bus.on(ch, handler);
  return () => bus.off(ch, handler);
}
