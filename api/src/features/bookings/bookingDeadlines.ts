/** Deadlines that decide when a booking stops holding its court.
 *
 *  Two rules live here:
 *
 *  1. `approvalDeadline` — how long a venue owner has to accept a request-to-book
 *     before it auto-cancels and the slot goes back on sale.
 *  2. `paymentDueAt` — how long the player then has to pay (previously computed
 *     inline with no clamp, so it could land *after* the game had been played).
 *
 *  And the predicate that reads them: `blockingFilter` / `isBlocking` decide
 *  whether a booking still occupies its slot. That predicate is the point of this
 *  module — occupancy is settled by comparing a stored deadline against `now` at
 *  query time, NOT by waiting for a sweeper to rewrite `status`. A lapsed request
 *  therefore frees its court immediately and correctly for every other player,
 *  whether or not any background job ever runs.
 *
 *  Kept pure (no Mongoose import) so the band boundaries are cheap to unit-test and
 *  so scripts can reuse it without pulling in route handlers — same reasoning as
 *  `games/gameTime.ts`. `blockingFilter` returns a plain object for the same reason.
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** An owner never gets less than this, however close the game is. */
export const MIN_APPROVAL_WINDOW_MS = 15 * MINUTE;
/** Approval must resolve this far before play, so the player can still show up. */
export const APPROVAL_PLAY_BUFFER_MS = 30 * MINUTE;
/** Payment must resolve this far before play. Tighter — the slot is already theirs. */
export const PAYMENT_PLAY_BUFFER_MS = 15 * MINUTE;

/** Booking `date` + `startTime` → the moment play begins.
 *
 *  Centralises the `new Date(\`${date}T${startTime}:00\`)` convention that was
 *  hand-rolled at several call sites. Returns null when the booking carries no
 *  usable start time (open-play and some owner-entered rows have none) — callers
 *  must treat null as "no play-start constraint", never as midnight, and must never
 *  let an `Invalid Date` escape into a stored field. */
export function playStartOf(date?: string | null, startTime?: string | null): Date | null {
  if (!date || !startTime) return null;
  // Shape-check before parsing: V8 is lenient enough that `new Date('junkTjunk:00')`
  // yields a *valid* Date in the year 2000 rather than Invalid Date, which would
  // silently store a nonsense play start instead of admitting we don't know one.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) return null;
  const d = new Date(`${date}T${startTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The owner's slice of the runway, by how far off the game is.
 *
 *  The owner's window is a share of the player's remaining time, and it shrinks
 *  fast as the game approaches: a player booking 10 hours out learns within the
 *  hour and still has 9 hours to find another court, while a booking two weeks out
 *  has no urgency and the venue window (24h) governs instead.
 *
 *  Both boundaries sit in the LOWER band: exactly 48h scores 0.25, exactly 12h
 *  scores 0.25. */
export function approvalShare(leadMs: number): number {
  if (leadMs > 48 * HOUR) return 0.5;
  if (leadMs >= 12 * HOUR) return 0.25;
  return 0.1;
}

/** When a request-to-book auto-cancels if the owner hasn't answered.
 *
 *  The tightest of: the venue's own window, the owner's share of the runway, and
 *  30 minutes before play. Floored at 15 minutes so a last-minute request is still
 *  answerable, then clamped to play start — without that final clamp the floor can
 *  push the deadline *past* the moment the game begins (book 20 min ahead and
 *  `playStart − 30min` is already in the past), leaving the court blocked beyond
 *  its own start time. */
export function computeApprovalDeadline(opts: {
  now: Date;
  playStart: Date | null;
  approvalWindowHours: number;
}): Date {
  const nowMs = opts.now.getTime();
  const playMs = opts.playStart ? opts.playStart.getTime() : null;

  const caps = [nowMs + Math.max(1, opts.approvalWindowHours) * HOUR];

  // The share caps only mean anything when we know when play starts.
  if (playMs != null && playMs > nowMs) {
    const lead = playMs - nowMs;
    caps.push(nowMs + lead * approvalShare(lead));
    caps.push(playMs - APPROVAL_PLAY_BUFFER_MS);
  }

  let deadline = Math.min(...caps);
  deadline = Math.max(deadline, nowMs + MIN_APPROVAL_WINDOW_MS);
  // Never after the game has started.
  if (playMs != null && playMs > nowMs) deadline = Math.min(deadline, playMs);

  return new Date(deadline);
}

/** When an approved-but-unpaid booking releases its slot.
 *
 *  Clamped to just before play start. Previously this was a bare
 *  `now + payWindowHours`, so approving at 5pm today for a 9am slot tomorrow gave
 *  the player a payment deadline eight hours after the court time had passed. */
export function computePaymentDueAt(opts: {
  now: Date;
  playStart: Date | null;
  payWindowHours: number;
}): Date {
  const nowMs = opts.now.getTime();
  const playMs = opts.playStart ? opts.playStart.getTime() : null;

  let due = nowMs + Math.max(1, opts.payWindowHours) * HOUR;
  if (playMs != null && playMs > nowMs) due = Math.min(due, playMs - PAYMENT_PLAY_BUFFER_MS);
  // A window shorter than the floor is still better than one that has already passed.
  return new Date(Math.max(due, nowMs + MIN_APPROVAL_WINDOW_MS));
}

/** A deadline as something a human will act on: "6:00 PM today", "9:30 AM tomorrow",
 *  "Sat 6:00 PM". Used in owner notifications and player emails — a generic "within
 *  24 hours" is forgettable in a way that a real clock time is not.
 *
 *  Rendered in the server's local timezone, which is the venue's for a
 *  single-region product. Revisit if venues ever span timezones. */
export function deadlineLabel(deadline: Date, now: Date = new Date()): string {
  const time = deadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayDiff = Math.round(
    (new Date(deadline).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (dayDiff === 0) return `${time} today`;
  if (dayDiff === 1) return `${time} tomorrow`;
  return `${deadline.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
}

type BlockingRow = {
  status?: string | null;
  approvalDeadline?: Date | string | null;
  paymentDueAt?: Date | string | null;
};

const past = (v: Date | string | null | undefined, now: Date): boolean => {
  if (!v) return false;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return !Number.isNaN(t) && t < now.getTime();
};

/** Does this booking still occupy its slot? The in-memory twin of `blockingFilter`.
 *
 *  The two MUST agree — they are defined together here so they can't drift apart.
 *  Rows predating this feature carry no deadline at all, and a missing deadline
 *  means "no expiry", so they keep blocking exactly as before. */
export function isBlocking(row: BlockingRow, now: Date): boolean {
  if (row.status === 'cancelled') return false;
  if (row.status === 'pending_approval' && past(row.approvalDeadline, now)) return false;
  if (row.status === 'awaiting_payment' && past(row.paymentDueAt, now)) return false;
  return true;
}

/** The Mongo fragment for "bookings that still hold their slot".
 *
 *  Spread into an occupancy query in place of `status: { $ne: 'cancelled' }`.
 *
 *  `$nor` is the right operator: the two fields inside each clause are an implicit
 *  AND, and `$nor` gives NOT(expired-request) AND NOT(expired-payment).
 *
 *  The `$ne: null` guards are strictly redundant — Mongo's `$lt` won't match a
 *  missing or null field anyway, because null and Date are different type brackets
 *  — but they state the intent for a reader who doesn't know that rule, and they
 *  match the house style already used elsewhere in `findSlotConflict`. Legacy rows
 *  with no deadline are covered either way; there is a test pinning that, because
 *  this whole design rests on it. */
export function blockingFilter(now: Date): Record<string, any> {
  return {
    status: { $ne: 'cancelled' },
    $nor: [
      { status: 'pending_approval', approvalDeadline: { $ne: null, $lt: now } },
      { status: 'awaiting_payment', paymentDueAt: { $ne: null, $lt: now } },
    ],
  };
}
