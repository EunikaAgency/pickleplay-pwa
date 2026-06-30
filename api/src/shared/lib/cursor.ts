// Compound keyset cursor for createdAt-DESC + _id-DESC pagination.
//
// The single-key cursor used by listVenues (base64url of one sort-field value,
// $gt ascending) is unsafe for a createdAt-DESC feed: it has no tiebreak, so
// posts sharing a millisecond timestamp (common under realtime bursts) get
// skipped or duplicated across pages, and the direction is wrong for DESC. This
// encodes (createdAt, _id) together and pages strictly "older than" the cursor.
import { Types } from 'mongoose';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Encode the last item of a page into an opaque cursor token. */
export function encodeCursor(createdAt: Date | string, id: unknown): string {
  const iso = new Date(createdAt).toISOString();
  return Buffer.from(`${iso}|${String(id)}`, 'utf8').toString('base64url');
}

/** Decode a cursor back to its {ts, id}, or null if malformed. */
export function decodeCursor(cursor?: string | null): { ts: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const idx = raw.lastIndexOf('|');
    if (idx === -1) return null;
    const ts = new Date(raw.slice(0, idx));
    const id = raw.slice(idx + 1);
    if (Number.isNaN(ts.getTime()) || !OBJECT_ID.test(id)) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

/**
 * The Mongo filter fragment that selects items strictly older than the cursor,
 * for a `sort({ createdAt: -1, _id: -1 })` query. Returns `{}` when there's no
 * (valid) cursor. Compose with other conditions via `$and` — never spread it
 * into a filter that already has its own `$or` (it would clobber it).
 */
export function keysetCondition(cursor?: string | null): Record<string, unknown> {
  const dec = decodeCursor(cursor);
  if (!dec) return {};
  return {
    $or: [
      { createdAt: { $lt: dec.ts } },
      { createdAt: dec.ts, _id: { $lt: new Types.ObjectId(dec.id) } },
    ],
  };
}

/** AND-merge a base filter with the keyset condition (if any). */
export function withCursor(base: Record<string, unknown>, cursor?: string | null): Record<string, unknown> {
  const keyset = keysetCondition(cursor);
  return keyset.$or ? { $and: [base, keyset] } : base;
}

/** Next-page cursor for a page, or undefined when there are no more rows. */
export function nextCursor(rows: Array<{ createdAt: Date | string; _id: unknown }>, hasMore: boolean): string | undefined {
  if (!hasMore || !rows.length) return undefined;
  const last = rows[rows.length - 1];
  if (!last) return undefined;
  return encodeCursor(last.createdAt, last._id);
}

export const SORT_NEWEST = { createdAt: -1, _id: -1 } as const;
