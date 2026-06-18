// Tiny in-app pub/sub for realtime events arriving over the SSE stream
// (see shared/hooks/useRealtimeStream.ts). The stream hook is the single
// publisher; screens subscribe to the events they care about:
//   - 'message'      → { conversationId, message }  (an incoming direct message)
//   - 'notification' → { id, type, title, body, ... } (any new notification)
// Decouples the one EventSource connection from the many screens that react to
// it, so we don't thread the stream through props or context.

type Handler = (data: any) => void;

const handlers: Record<string, Set<Handler>> = {};

/** Subscribe to a realtime event. Returns an unsubscribe fn. */
export function onRealtime(event: string, handler: Handler): () => void {
  (handlers[event] ??= new Set()).add(handler);
  return () => { handlers[event]?.delete(handler); };
}

/** Dispatch a realtime event to all current subscribers (best-effort). */
export function emitRealtime(event: string, data: any): void {
  handlers[event]?.forEach((h) => {
    try { h(data); } catch { /* a bad subscriber must not break the others */ }
  });
}
