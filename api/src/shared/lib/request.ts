// Shared request helpers — safe body parsing + ObjectId validation.
// Both classes of failure (malformed JSON, invalid ObjectId) are ALSO caught by
// the central error handler; these helpers let a controller handle them inline
// with a specific message when it wants to.

import { isValidObjectId } from 'mongoose';

/** Parse a JSON body, returning `{}` on empty/malformed input instead of throwing. */
export async function readJson<T = any>(c: any): Promise<T> {
  return c.req.json().catch(() => ({} as T));
}

/** Return the id if it's a valid ObjectId, else null (so callers can 404/400 cleanly). */
export function asObjectId(id: unknown): string | null {
  return typeof id === 'string' && isValidObjectId(id) ? id : null;
}
