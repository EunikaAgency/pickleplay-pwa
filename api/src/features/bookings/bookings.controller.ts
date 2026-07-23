import { z } from 'zod';
import { Booking } from './bookings.model.js';
import { Venue, Court, VenueMember, SlotPriceOverride } from '../venues/venues.model.js';
import { Payment } from '../payments/payments.model.js';
import { recordDemand } from '../demand/demand.controller.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { sendEmail, isGmailConfigured, hasValidTokens } from '../../shared/lib/gmail.js';
import { bookingConfirmedReceipt, bookingRequestedReceipt, bookingRequestExpiredReceipt, cancellationReceipt } from '../../shared/lib/email-templates.js';
import { User } from '../auth/auth.model.js';
import { resolveHourlyRate, perPlayerSurcharge, OCCUPANCY_BLOCK_NOTES } from './pricing.js';
import { blockingFilter, computeApprovalDeadline, computePaymentDueAt, deadlineLabel, isBlocking, playStartOf } from './bookingDeadlines.js';

function canEmail() { return isGmailConfigured() && hasValidTokens(); }

function fmtDate(d: string) { return new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function fmtTime(t?: string | null) { if (!t) return ''; const [h, m] = t.split(':'); const hr = Number(h); const am = hr < 12 ? 'AM' : 'PM'; const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr; return `${h12}:${m} ${am}`; }

/* ─── Slot availability — shared by the conflict guard + /availability ─────── */
//
// Single source of truth so the booking guard and the availability endpoint can
// never disagree. Courts are interchangeable, so a venue is a pool of `capacity`
// identical courts. For identical machines, a new time interval fits iff at every
// clock-hour it touches a court is still free (max concurrency < capacity). The
// availability endpoint surfaces the per-hour free counts; the guard checks the
// requested window against them.

/** "HH:MM" → minutes since midnight, or null when missing/unparseable. */
function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Clock-hours a [start,end) window touches: 09:00–11:00 → [9,10]; 09:30–10:30 → [9,10]. */
export function hoursTouched(start?: string | null, end?: string | null): number[] {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null || e == null || e <= s) return [];
  const out: number[] = [];
  for (let h = Math.floor(s / 60); h < Math.ceil(e / 60) && h < 24; h++) out.push(h);
  return out;
}

/** Free-court count for each hour 0–23, given the venue's active bookings + capacity. */
export function freeCourtsByHour(
  bookings: { startTime?: string | null; endTime?: string | null }[],
  capacity: number,
): number[] {
  const free = new Array<number>(24).fill(capacity);
  for (const b of bookings) {
    for (const h of hoursTouched(b.startTime, b.endTime)) free[h] = (free[h] ?? capacity) - 1;
  }
  return free.map((n) => Math.max(0, n));
}

/**
 * Whole start-hours a single court can still take, honoring its turnover buffer.
 * An hour h is free unless a 1-hour slot starting there would overlap an existing
 * booking on that court OR land within `turnoverMinutes` of one — the per-hour
 * mirror of the create-time guard, so the picker greys the same hours it rejects.
 */
export function courtFreeHoursWithTurnover(
  courtBookings: { startTime?: string | null; endTime?: string | null }[],
  turnoverMinutes: number,
): boolean[] {
  const buffer = Math.max(0, turnoverMinutes || 0);
  const free = new Array<boolean>(24).fill(true);
  for (const b of courtBookings) {
    const bs = toMinutes(b.startTime);
    const be = toMinutes(b.endTime);
    if (bs == null || be == null) continue;
    for (let h = 0; h < 24; h++) {
      // Candidate 1-hour slot [h:00, h+1:00) vs the booking's buffered window.
      if (h * 60 < be + buffer && h * 60 + 60 > bs - buffer) free[h] = false;
    }
  }
  return free;
}

/** Court capacity for a venue: real Court docs, else the denormalised count, else 1. */
export async function resolveVenueCapacity(venueId: string): Promise<number> {
  const courtDocs = await Court.countDocuments({ venueId });
  if (courtDocs) return courtDocs;
  const venue = await Venue.findById(venueId).select('courtCount').lean<{ courtCount?: number }>();
  return Math.max(1, venue?.courtCount || 1);
}

/**
 * Effective court capacity accounting for split-court sub-units. Each splittable
 * court contributes its `splitCount` (usually 2-4); non-splittable courts count as
 * 1. Used by the pool-capacity guard so a sub-unit booking doesn't consume the
 * whole court's capacity in the venue-level free-courts check.
 */
export async function resolveEffectiveCapacity(venueId: string): Promise<number> {
  const courts = await Court.find({ venueId, isActive: { $ne: false } })
    .select('isSplittable splitCount').lean<{ isSplittable?: boolean; splitCount?: number }[]>();
  if (!courts.length) {
    const venue = await Venue.findById(venueId).select('courtCount').lean<{ courtCount?: number }>();
    return Math.max(1, venue?.courtCount || 1);
  }
  return courts.reduce((sum, c) => sum + (c.isSplittable && c.splitCount ? c.splitCount : 1), 0);
}

/**
 * Owner-painted 'Maintenance' windows. Unlike every other way a slot goes busy,
 * these have no Booking behind them — the pricing grid writes only a
 * SlotPriceOverride — so nothing stopped a player booking a court that was closed
 * for maintenance. They have to be folded into the occupancy set by hand.
 *
 * 'Reserved' is deliberately NOT here: it is painted alongside a manual
 * reservation, which is a real confirmed Booking. Counting both would decrement
 * the capacity pool twice for one reservation.
 */
export async function maintenanceBlocksForDate(venueId: string, date: string) {
  return SlotPriceOverride.find({ venueId, date, note: { $in: OCCUPANCY_BLOCK_NOTES } })
    .select('startTime endTime courtId')
    .lean<{ startTime: string; endTime: string; courtId?: any }[]>();
}

/**
 * Hours (0–23) the whole venue is shut by a venue-wide maintenance block.
 *
 * A venue-wide block names no court, so it can't be modelled as a pseudo-booking:
 * `freeCourtsByHour` would dock a single court from the pool when the owner meant
 * "every court is closed". Callers zero these hours out instead.
 */
export async function venueWideClosedHours(venueId: string, date: string): Promise<boolean[]> {
  const blocks = await maintenanceBlocksForDate(venueId, date);
  return closedHoursFromBlocks(blocks);
}

/** Shared with the range/batch endpoints, which fetch their overrides in one query. */
export function closedHoursFromBlocks(blocks: { startTime: string; endTime: string; courtId?: any }[]): boolean[] {
  const closed = new Array<boolean>(24).fill(false);
  for (const b of blocks) {
    if (b.courtId != null) continue; // court-scoped: handled as occupancy, not closure
    for (const h of hoursTouched(b.startTime, b.endTime)) closed[h] = true;
  }
  return closed;
}

/** Court-scoped maintenance shaped like bookings, so pool/court math needs no changes. */
export function courtBlocksAsBookings(blocks: { startTime: string; endTime: string; courtId?: any }[]) {
  return blocks
    .filter((b) => b.courtId != null)
    .map((b) => ({ startTime: b.startTime, endTime: b.endTime, courtId: b.courtId, subUnitIndex: null }));
}

/**
 * Every active (non-cancelled) booking for a venue on a date — the occupancy set.
 * Court-scoped maintenance blocks join it (they occupy exactly the court they
 * name); venue-wide ones are a closure, see `venueWideClosedHours`.
 */
export async function activeBookingsForDate(venueId: string, date: string, excludeBookingId?: string | null) {
  const [bookings, blocks] = await Promise.all([
    Booking.find({
      venueId, date,
      ...blockingFilter(new Date()),
      ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
    })
      .select('startTime endTime courtId subUnitIndex')
      .lean<{ startTime?: string | null; endTime?: string | null; courtId?: any; subUnitIndex?: number | null }[]>(),
    maintenanceBlocksForDate(venueId, date),
  ]);
  return [...bookings, ...courtBlocksAsBookings(blocks)];
}

// A reservation clashes when its court (or, for venue-level bookings, every court
// in the pool) is already taken for an hour it touches. Returns a human message
// to show the player, or null when the slot is free. `turnoverMinutes` is the
// chosen court's optional buffer: the new window also clashes when it falls within
// that gap of an existing booking on the same court (back-to-back too tight).
// `excludeBookingId` omits one booking from the occupancy set — used when
// re-checking a booking against the slot it already holds (approving a pending
// request), so it doesn't collide with itself.
export async function findSlotConflict(body: {
  venueId: string; courtId?: string | null; subUnitIndex?: number | null; date: string; startTime?: string; endTime?: string;
}, userId?: string | null, turnoverMinutes = 0, isSplittable = false, excludeBookingId?: string | null): Promise<string | null> {
  // Can only reason about clashes when the request specifies a time window.
  if (!body.startTime || !body.endTime) return null;
  if (body.endTime <= body.startTime) return 'End time must be after the start time.';
  const wanted = hoursTouched(body.startTime, body.endTime);
  if (!wanted.length) return null;

  // Owner-painted maintenance. A venue-wide block shuts every court outright; a
  // court-scoped one is folded into the clash checks below (and into the pool via
  // activeBookingsForDate), so it can't be booked even while other courts are free.
  const maintenance = await maintenanceBlocksForDate(body.venueId, body.date);
  const closed = closedHoursFromBlocks(maintenance);
  if (wanted.some((h) => closed[h])) {
    return 'This venue is closed for maintenance during that time. Please pick another slot.';
  }

  // A player can't double-book the same court: reject a window that overlaps one
  // this same user already holds on THIS court at this venue/date. Different
  // courts at the same time are allowed (booking for a group across multiple
  // courts). The capacity pool below stops the venue selling more courts than
  // exist; it never stops ONE user stacking overlapping slots on the same court
  // (which is how a 3-court venue let the same player book 7–11 and 8–11). This
  // covers Create Game too: that flow reserves the court via this same path.
  // Time strings are zero-padded "HH:MM", so lexical < / > is chronological
  // (same comparison the court-specific clash query below relies on). Skipped for
  // owner-entered manual/blocked bookings (no single customer to double-book).
  if (userId) {
    const ownClash = await Booking.findOne({
      userId, venueId: body.venueId, courtId: body.courtId, date: body.date,
      ...blockingFilter(new Date()),
      ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
      startTime: { $ne: null, $lt: body.endTime },
      endTime: { $ne: null, $gt: body.startTime },
    }).lean();
    if (ownClash) return 'You already have a booking on this court that overlaps this time. Cancel it first or pick another slot.';
  }

  // A specific court holds one booking per slot: any overlap on that court clashes.
  // With a turnover buffer, each existing booking also blocks the `turnoverMinutes`
  // on either side, so the next reservation can't start (or end) too close to it.
  // Done in minute arithmetic (not a string-range Mongo query) so the buffer applies.
  // Split-court: a sub-unit booking clashes only with same-sub-unit or whole-court
  // bookings on that court; a whole-court booking clashes with ALL bookings on it.
  if (body.courtId) {
    const reqStart = toMinutes(body.startTime)!;
    const reqEnd = toMinutes(body.endTime)!;
    const buffer = Math.max(0, turnoverMinutes || 0);
    const courtClashFilter: Record<string, any> = {
      venueId: body.venueId, date: body.date, courtId: body.courtId,
      ...blockingFilter(new Date()),
      ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
      startTime: { $ne: null }, endTime: { $ne: null },
    };
    // When booking a specific sub-unit, it only clashes with bookings on the same
    // sub-unit OR whole-court bookings (subUnitIndex null/undefined) on that court.
    // A whole-court booking (no subUnitIndex) clashes with EVERYTHING on the court.
    if (body.subUnitIndex != null) {
      courtClashFilter.$or = [
        { subUnitIndex: body.subUnitIndex },
        { subUnitIndex: { $in: [null, undefined] } },
      ];
    }
    const courtBookings = await Booking.find(courtClashFilter)
      .select('startTime endTime').lean<{ startTime?: string | null; endTime?: string | null }[]>();
    for (const b of courtBookings) {
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      if (bs == null || be == null) continue;
      // The existing booking occupies [bs - buffer, be + buffer); overlap with the
      // requested window means a clash. With buffer 0 this is plain interval overlap.
      if (reqStart < be + buffer && reqEnd > bs - buffer) {
        return buffer > 0
          ? `That court needs ${buffer} min between bookings — this slot is too close to another reservation. Please pick another time.`
          : 'That court is already booked for an overlapping time. Please pick another slot.';
      }
    }

    // Maintenance on THIS court. The pool check below won't catch it while other
    // courts are free, so it has to be rejected here. No turnover buffer: a closure
    // is a hard window, not a reservation needing changeover time.
    for (const b of maintenance) {
      if (b.courtId == null || String(b.courtId) !== String(body.courtId)) continue;
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      if (bs == null || be == null) continue;
      if (reqStart < be && reqEnd > bs) {
        return 'That court is closed for maintenance during that time. Please pick another slot.';
      }
    }
  }

  // Pool capacity — enforced for every booking, named court or not. Even a chosen
  // court can't be sold if every physical sub-unit is already taken for an hour it
  // touches. Uses effective capacity so splittable courts contribute their sub-unit
  // count (a 2-way court = 2 slots) rather than 1.
  const capacity = body.subUnitIndex != null
    ? await resolveEffectiveCapacity(body.venueId)
    : await resolveVenueCapacity(body.venueId);
  // Excluding the booking under test matters when re-checking one that already
  // holds this slot (approval): counting it would make it clash with itself and
  // a one-court venue could never approve anything.
  const free = freeCourtsByHour(await activeBookingsForDate(body.venueId, body.date, excludeBookingId), capacity);
  return wanted.some((h) => (free[h] ?? 0) <= 0)
    ? 'All courts at this venue are booked for an overlapping time. Please pick another slot.'
    : null;
}

/** Today as local YYYY-MM-DD + the current hour — for rejecting past-time bookings. */
function localNow(): { today: string; hour: number } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { today: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours() };
}

/**
 * Whether a requested slot is already in the past — a date before today, or today
 * at an hour that has already begun. Deliberately lenient (`startHour < nowHour`,
 * not the client's stricter "next hour") so it never rejects a slot the UI allowed,
 * while still blocking blatant past bookings. Both the standalone booking flow and
 * the create-a-game flow reserve the court through here, so one check covers both.
 */
function isPastSlot(date: string, startTime?: string | null): boolean {
  const { today, hour } = localNow();
  if (date < today) return true;
  if (date === today && startTime) {
    const sh = Number(startTime.split(':')[0]);
    if (Number.isFinite(sh) && sh < hour) return true;
  }
  return false;
}

const createSchema = z.object({
  venueId: z.string(),
  // 'open_play' = a courtless per-session drop-in (V3), priced from the venue's
  // openPlayPrice; anything else is a normal court booking. Free-text to match
  // the model (the game flow tags its booking 'game' separately).
  bookingType: z.string().max(20).optional(),
  courtId: z.string().optional(),
  subUnitIndex: z.number().int().min(0).optional(),
  sessionId: z.string().optional(),
  eventId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  playerCount: z.number().int().min(1).max(50).optional().default(1),
  amount: z.string().or(z.number()),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  // Masked card captured at request time for approval venues (pay-after-approval).
  card: z.object({ brand: z.string().max(20).optional(), last4: z.string().max(4).optional() }).optional(),
  // Equipment rental add-on (V2).
  hasEquipmentRental: z.boolean().optional(),
  equipmentRentalAmount: z.string().or(z.number()).optional(),
  // Payment breakdown (deposit / full / pay-at-venue + 7% service fee). `amount`
  // above stays the venue's price; these split how the player pays it.
  serviceFeeAmount: z.string().or(z.number()).optional(),
  paymentOption: z.enum(['full', 'deposit', 'pay_at_venue']).optional(),
  amountPaid: z.string().or(z.number()).optional(),
  balanceDue: z.string().or(z.number()).optional(),
  customerCategory: z.enum(['none', 'senior']).optional().default('none'),
  discountIdNumber: z.string().trim().max(80).optional(),
  // Recurring booking (step 2): repeat this same slot on these weekdays (0=Sun…6=Sat)
  // for the next `weeks`. The primary booking is paid now; each generated occurrence
  // is held as `awaiting_payment` and paid lazily as its date nears (from My Bookings).
  recurrence: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    weeks: z.number().int().min(1).max(12),
  }).optional(),
});

/** Coerce a "string | number | undefined" money input to a number, or null. */
function num(v: string | number | undefined | null): number | null {
  if (v == null || v === '') return null;
  return typeof v === 'number' ? v : parseFloat(v);
}

const cancelSchema = z.object({ cancellationReason: z.string().optional() });

/**
 * Tell both sides a booking lapsed. The player is the one who needs this most —
 * before it existed, a request that quietly died looked identical to one still
 * being considered. The owner gets it too, because a slot silently going back on
 * sale is something they should know about.
 *
 * Best-effort throughout: `notifyUser` never throws, and the email is fire-and-
 * forget. An expiry must never fail because a mail server was down.
 */
async function notifyBookingExpired(booking: any, reason: string): Promise<void> {
  // Which of the two expiries this was: the owner never answered, or the player
  // never paid. Only the first is the owner's fault, and only it warrants email.
  const unanswered = reason === EXPIRY_REASON.pending_approval;
  try {
    const venue = await Venue.findById(booking.venueId).select('displayName ownerUserId').lean<{ displayName?: string; ownerUserId?: any }>();
    const venueName = venue?.displayName || 'The venue';

    await notifyUser(booking.userId, {
      type: 'booking_request_expired',
      title: unanswered ? 'Booking request expired' : 'Booking released',
      body: unanswered
        ? `${venueName} didn't respond in time, so your request for ${fmtDate(booking.date)} was cancelled. You haven't been charged.`
        : `Your unpaid booking at ${venueName} for ${fmtDate(booking.date)} was released.`,
      icon: 'calendar',
      linkUrl: '/my-bookings',
      tag: String(booking._id),
    });

    // Only worth telling the owner about the case they caused.
    if (unanswered && venue?.ownerUserId) {
      await notifyUser(venue.ownerUserId, {
        type: 'booking_request_expired',
        title: 'Request expired unanswered',
        body: `A booking request for ${fmtDate(booking.date)} expired before you responded. The slot is back on sale.`,
        icon: 'calendar',
        linkUrl: '/owner/bookings',
        tag: String(booking._id),
      });
    }

    if (unanswered && canEmail()) {
      const u = await User.findById(booking.userId).select('email').lean<{ email?: string }>();
      if (u?.email) {
        const t = bookingRequestExpiredReceipt({
          receipt: String(booking._id).slice(-8).toUpperCase(),
          venue: venueName,
          date: fmtDate(booking.date),
          start: fmtTime(booking.startTime), end: fmtTime(booking.endTime),
          browseUrl: 'https://pickleballer-pwa.eunika.xyz/nearby',
        });
        await sendEmail({ to: u.email, subject: `Booking request expired — ${venueName}`, body: t.text, html: t.html });
      }
    }
  } catch { /* notifications are best-effort; the cancellation already stands */ }
}

/** Why a booking expired — distinct strings so reports can tell an unanswered
 *  request apart from an unpaid one. */
const EXPIRY_REASON: Record<string, string> = {
  pending_approval: 'Owner did not respond in time',
  awaiting_payment: 'Payment window expired',
};

/**
 * Cancel bookings whose deadline has passed, and notify both sides.
 *
 * This does NOT decide whether a slot is free — `blockingFilter` already does
 * that at query time, so a lapsed booking has stopped holding its court before
 * this ever runs. What this adds is the durable record and the notifications.
 *
 * Every row is claimed with a status-guarded `findOneAndUpdate`: the guard IS
 * the lock. Whichever caller gets there first — a player's My Bookings read, the
 * sweeper on instance A, the sweeper on instance B — exactly one sees a non-null
 * result, so exactly one set of notifications goes out. No jobs collection, no
 * lease, no state to lose across a restart.
 */
async function cancelExpired(rows: any[]): Promise<number> {
  let cancelled = 0;
  for (const r of rows) {
    const reason = EXPIRY_REASON[r.status as string];
    if (!reason) continue;
    const claimed = await Booking.findOneAndUpdate(
      { _id: r._id, status: r.status },
      { status: 'cancelled', cancellationReason: reason, cancelledAt: new Date(), cancellationType: 'system_expired' },
      { new: true },
    ).lean();
    if (!claimed) continue;   // someone else got here first
    cancelled++;
    // Mutate the caller's copy so a list read reflects the change it triggered.
    r.status = 'cancelled';
    r.cancellationReason = reason;
    r.cancellationType = 'system_expired';
    void notifyBookingExpired(claimed, reason);
  }
  return cancelled;
}

/**
 * Lazily expire overdue bookings among rows we happen to have just read.
 *
 * Kept because it makes a list reflect reality in the same request that surfaced
 * it, not because correctness depends on it — the sweeper below is the reliable
 * path, and the occupancy queries don't need either.
 */
export async function expireOverdueBookings(rows: any[]): Promise<void> {
  const now = new Date();
  const overdue = rows.filter((r) => !isBlocking(r, now) && r.status !== 'cancelled');
  if (overdue.length) await cancelExpired(overdue);
}

/**
 * Scheduled sweep: cancel every booking whose deadline has passed, anywhere in
 * the collection — not just rows someone happened to load. Registered from
 * `index.ts` via `everyMinutes`.
 */
export async function sweepExpiredBookings(): Promise<string | void> {
  const now = new Date();
  const overdue = await Booking.find({
    $or: [
      { status: 'pending_approval', approvalDeadline: { $ne: null, $lt: now } },
      { status: 'awaiting_payment', paymentDueAt: { $ne: null, $lt: now } },
    ],
  }).limit(200).lean();   // bound a pathological run; real batches are single digits
  const n = overdue.length ? await cancelExpired(overdue) : 0;
  const reminded = await sendApprovalReminders(now);
  const parts = [n && `expired ${n}`, reminded && `nudged ${reminded}`].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * Nudge owners at 50% and 80% of a request's window.
 *
 * Thresholds are computed in memory from `createdAt` rather than stored as two
 * more date fields: the outstanding-request set is an inbox, so it stays small,
 * and two extra indexed fields would buy nothing at this size.
 *
 * Each reminder is claimed with `$addToSet` before it is sent, the same idiom
 * `cancelExpired` uses. That is what makes this safe across restarts and across
 * multiple API instances — the claim, not the send, is the thing that races.
 */
async function sendApprovalReminders(now: Date): Promise<number> {
  const pending = await Booking.find({
    status: 'pending_approval',
    approvalDeadline: { $ne: null, $gt: now },
  }).limit(200).lean();
  if (!pending.length) return 0;

  let sent = 0;
  for (const b of pending) {
    const start = new Date((b as any).createdAt).getTime();
    const end = new Date((b as any).approvalDeadline).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const elapsed = (now.getTime() - start) / (end - start);
    const mark = elapsed >= 0.8 ? '80' : elapsed >= 0.5 ? '50' : null;
    if (!mark) continue;

    const claimed = await Booking.findOneAndUpdate(
      { _id: (b as any)._id, status: 'pending_approval', remindersSent: { $ne: mark } },
      { $addToSet: { remindersSent: mark } },
      { new: true },
    ).lean();
    if (!claimed) continue;

    const venue = await Venue.findById((b as any).venueId).select('displayName ownerUserId').lean<{ displayName?: string; ownerUserId?: any }>();
    if (!venue?.ownerUserId) continue;
    const deadline = new Date((b as any).approvalDeadline);
    await notifyUser(venue.ownerUserId, {
      type: 'booking_request_reminder',
      title: mark === '80' ? 'Final reminder — booking request' : 'Booking request waiting',
      body: `A request for ${fmtDate((b as any).date)} expires at ${deadlineLabel(deadline, now)}. Approve or decline it before then.`,
      icon: 'calendar',
      linkUrl: '/owner/bookings?status=pending_approval',
      // Same tag as the request itself, so the 80% push REPLACES the 50% one on
      // the lock screen rather than stacking a second nag beside it.
      tag: String((b as any)._id),
    });
    sent++;
  }
  return sent;
}

export async function listBookings(c: any) {
  const user = c.get('user');
  const status = c.req.query('status');
  // A game's court reservation surfaces as a game, not a standalone booking; an
  // owner-entered manual/blocked booking is set to the staff's userId only to
  // satisfy the schema — neither belongs in the player's "My bookings".
  const filter: Record<string, any> = { userId: user.sub, bookingType: { $nin: ['game', 'manual', 'blocked'] } };
  if (status) filter.status = status;
  // Sort by _id (true insertion order), not createdAt — seeded demo bookings set
  // createdAt to the play-date, so a real new booking would otherwise sort below
  // them. The ObjectId's leading bytes are the real creation time. (Same reason
  // as getVenueBookings in the owner inbox.)
  const rows = await Booking.find(filter).populate('venueId', 'displayName slug').sort({ _id: -1 }).limit(50).lean();
  await expireOverdueBookings(rows);
  const refunds = await refundStateFor(rows.map((r: any) => String(r._id)));
  // Keep `venueId` the ObjectId string (the populate replaces it with the venue
  // doc); name/slug are split out. Consumers (e.g. createGame) expect a string id.
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueId: r.venueId ? String(r.venueId._id ?? r.venueId) : null, venueName: r.venueId?.displayName, venueSlug: r.venueId?.slug, refund: refunds.get(String(r._id)) ?? null })) });
}

/**
 * Refund state per booking id, so a cancelled booking can say whether the money
 * is on its way or already back. One batched query for the whole page — the
 * alternative (a Payment lookup per row) is what usually turns a list read into
 * an N+1.
 */
async function refundStateFor(bookingIds: string[]): Promise<Map<string, { state: RefundState; amount: number; feeDeducted: number; requestedAt: Date | null; settledAt: Date | null; reference: string | null }>> {
  const out = new Map<string, any>();
  if (!bookingIds.length) return out;
  const payments = await Payment.find({
    bookingId: { $in: bookingIds },
    status: { $in: ['refund_pending', 'refunded'] },
  }).select('bookingId status refundAmount refundFeeAmount refundRequestedAt refundedAt refundReference').lean<any[]>();
  for (const p of payments) {
    out.set(String(p.bookingId), {
      state: p.status === 'refunded' ? 'completed' : 'pending',
      amount: Number(p.refundAmount || 0),
      feeDeducted: Number(p.refundFeeAmount || 0),
      requestedAt: p.refundRequestedAt ?? null,
      settledAt: p.refundedAt ?? null,
      reference: p.refundReference ?? null,
    });
  }
  return out;
}

/** Fan out the future occurrences of a recurring court booking. Each lands as an
 *  `awaiting_payment` hold — it reserves its slot and is paid lazily from My Bookings
 *  as its date nears (the decision's "one booking + 7% per occurrence, deferred") —
 *  linked to the primary via `recurrenceGroupId`. A week whose slot is already taken
 *  is skipped so one clash never blocks the rest. Capped at 60. Returns the count. */
async function generateRecurringOccurrences(
  primary: any,
  body: any,
  serviceFeeAmount: number,
  turnoverMinutes: number,
  isSplittable: boolean,
  userSub: string,
): Promise<number> {
  const days = new Set(body.recurrence.daysOfWeek as number[]);
  const start = new Date(`${body.date}T00:00:00`);
  const horizonDays = body.recurrence.weeks * 7;
  const MAX = 60;
  let created = 0;
  for (let offset = 1; offset <= horizonDays && created < MAX; offset++) {
    const d = new Date(start.getTime() + offset * 86_400_000);
    if (!days.has(d.getDay())) continue;
    const occDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const conflict = await findSlotConflict(
      { venueId: body.venueId, courtId: body.courtId || null, subUnitIndex: body.subUnitIndex ?? null, date: occDate, startTime: body.startTime, endTime: body.endTime },
      userSub, turnoverMinutes, isSplittable,
    );
    if (conflict) continue; // slot taken that week — skip, don't block the series
    await Booking.create({
      userId: userSub, venueId: body.venueId, courtId: body.courtId || null, subUnitIndex: body.subUnitIndex ?? null,
      date: occDate, startTime: body.startTime || null, endTime: body.endTime || null, playerCount: body.playerCount,
      amount: primary.amount, paymentMethod: body.paymentMethod || null,
      status: 'awaiting_payment', paymentDueAt: new Date(`${occDate}T${body.startTime}:00`),
      savedCard: body.card ? { brand: body.card.brand, last4: body.card.last4 } : undefined,
      serviceFeeAmount, recurrenceGroupId: primary._id, bookingType: body.bookingType || undefined,
      rateSource: primary.rateSource ?? null, overrideId: primary.overrideId ?? null,
      baseRate: primary.baseRate ?? null, memberDiscountPercent: primary.memberDiscountPercent ?? null,
    });
    created++;
  }
  return created;
}

/* ─── Slot quoting ─────────────────────────────────────────────────────────
 *
 * What a given court-slot costs, resolved server-side. Extracted so `createBooking`
 * (which validates the client's number against it) and `modifyBooking` (which
 * needs the NEW slot's price to work out the reschedule delta) can never disagree
 * — a reschedule that priced the new slot by its own ladder would hand the player
 * a different number for the same court-hour they'd have paid at checkout.
 */
export interface SlotQuoteParams {
  venueId: string;
  courtId?: string | null;
  subUnitIndex?: number | null;
  date: string;
  startTime: string;
  endTime: string;
  playerCount?: number;
  customerCategory?: 'none' | 'senior' | 'pwd';
  /** Checked for an active venue membership (member pricing). Skipped when null. */
  userId?: string | null;
  /** Equipment rental add-on, carried through unchanged. */
  equipmentAmount?: number;
  /** Preloaded venue doc, when the caller already has one. */
  venue?: any;
}

export interface SlotQuote {
  /** Payable court total: rate × hours + equipment + per-player surcharge, post-discount. */
  total: number;
  /** The same total before any statutory (senior/PWD) discount. */
  preDiscountSubtotal: number;
  discountAmount: number;
  discountPercent: number;
  pricing: Awaited<ReturnType<typeof resolveHourlyRate>> | null;
}

export async function quoteSlotTotal(p: SlotQuoteParams): Promise<SlotQuote | null> {
  const startH = Number(p.startTime.split(':')[0]);
  const endH = Number(p.endTime.split(':')[0]);
  // A non-finite hour count makes the total NaN, and `NaN > 1` is false — which
  // would silently pass any client-chosen amount through the mismatch check.
  if (!Number.isFinite(startH) || !Number.isFinite(endH)) return null;
  const hours = Math.max(1, endH - startH);
  const customerCategory = p.customerCategory ?? 'none';

  const venue = p.venue ?? await Venue.findById(p.venueId)
    .select('memberDiscountPercent perPlayerFee perPlayerFeeThreshold').lean<any>();

  // Pricing mode: 'start' (default) = start-time rate × hours; 'blend' = resolve
  // per clock hour so bookings crossing override boundaries price correctly
  // (e.g. 8–10am early bird + 10am–noon regular).
  const { getSingleton } = await import('../settings/settings.controller.js');
  const appSettings = await getSingleton();
  const blendMode = appSettings?.pricingMode === 'blend';

  let pricing: Awaited<ReturnType<typeof resolveHourlyRate>> | null = null;
  let expectedAmount = 0;
  let preDiscountCourtAmount = 0;
  if (blendMode) {
    for (let h = startH; h < endH; h++) {
      const hr = await resolveHourlyRate({
        venueId: p.venueId, courtId: p.courtId || null, subUnitIndex: p.subUnitIndex ?? null,
        date: p.date, startTime: `${String(h).padStart(2, '0')}:00`, isMember: false, customerCategory,
      });
      expectedAmount += hr.rate;
      preDiscountCourtAmount += hr.baseRate;
      if (!pricing) pricing = hr;
    }
  } else {
    pricing = await resolveHourlyRate({
      venueId: p.venueId, courtId: p.courtId || null, subUnitIndex: p.subUnitIndex ?? null,
      date: p.date, startTime: p.startTime, isMember: false, customerCategory,
    });
    expectedAmount = pricing.rate * hours;
    preDiscountCourtAmount = pricing.baseRate * hours;
  }

  // Venue membership discount — mutually exclusive with the statutory one, which
  // is why it is only consulted when no senior/PWD category was claimed.
  if (customerCategory === 'none' && p.userId && pricing) {
    const membership = await VenueMember.findOne({
      venueId: p.venueId, userId: p.userId, status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
    if (membership) {
      pricing.memberApplied = true;
      pricing.memberDiscountPercent = Math.max(0, Math.min(100, Number(venue?.memberDiscountPercent) || 0));
      const memberRate = (base: number) => Math.round(base * (1 - pricing!.memberDiscountPercent / 100) * 100) / 100;
      if (blendMode) {
        expectedAmount = 0;
        for (let h = startH; h < endH; h++) {
          const hr = await resolveHourlyRate({
            venueId: p.venueId, courtId: p.courtId || null, subUnitIndex: p.subUnitIndex ?? null,
            date: p.date, startTime: `${String(h).padStart(2, '0')}:00`, isMember: false,
          });
          expectedAmount += memberRate(hr.baseRate);
        }
      } else {
        expectedAmount = memberRate(pricing.baseRate) * hours;
      }
      pricing.rate = memberRate(pricing.baseRate);
    }
  }

  const equipAmount = Number(p.equipmentAmount || 0);
  const surcharge = perPlayerSurcharge(venue, p.playerCount ?? 1);
  const total = Math.round((expectedAmount + equipAmount + surcharge) * 100) / 100;
  const preDiscountSubtotal = customerCategory === 'none'
    ? total
    : Math.round((preDiscountCourtAmount + equipAmount + surcharge) * 100) / 100;

  return {
    total,
    preDiscountSubtotal,
    discountAmount: Math.round((preDiscountSubtotal - total) * 100) / 100,
    discountPercent: pricing?.statutoryDiscountPercent ?? 0,
    pricing,
  };
}

export async function createBooking(c: any) {
  const user = c.get('user');
  const body = createSchema.parse(await c.req.json());

  // Statutory IDs belong to the player's profile, not the checkout form. New
  // clients send the saved value for compatibility, while the server resolves
  // it authoritatively from the signed-in account. The body fallback keeps older
  // app builds usable during rollout.
  let resolvedDiscountIdNumber = body.discountIdNumber?.trim() || null;
  if (body.customerCategory !== 'none') {
    const profile = await User.findById(user.sub)
      .select('+seniorCitizenIdNumber')
      .lean<{ seniorCitizenIdNumber?: string }>();
    const savedId = profile?.seniorCitizenIdNumber;
    resolvedDiscountIdNumber = savedId?.trim() || resolvedDiscountIdNumber;
    if (!resolvedDiscountIdNumber) {
      return c.json({
        error: {
          code: 'PROFILE_DISCOUNT_ID_REQUIRED',
          message: 'Add your Senior Citizen ID number in Edit Profile before booking.',
        },
      }, 400);
    }
  }

  // Reject past-time bookings (covers the create-a-game flow too — it books here).
  if (isPastSlot(body.date, body.startTime)) {
    return c.json({ error: { code: 'PAST_SLOT', message: 'That time has already passed. Please pick a future slot.' } }, 409);
  }

  // V3 — open play: a courtless per-session drop-in. It doesn't reserve a court,
  // so it skips court validation, the clash guard, and the approval flow — the
  // player just pays the venue's per-session fee and is confirmed. Guard that the
  // venue actually offers open play before taking money.
  if (body.bookingType === 'open_play') {
    const v = await Venue.findById(body.venueId).select('openPlayPrice bookingPayWindowHours').lean<{ openPlayPrice?: number; bookingPayWindowHours?: number }>();
    if (!v) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
    if (!(Number(v.openPlayPrice) > 0)) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'This venue does not offer open play.' } }, 400);
    }
    const testMode = await (await import('../settings/settings.controller.js')).isPaymentTestMode();
    const awaitsManualPayment = !testMode && body.paymentMethod !== 'pay_at_venue';
    const openPlay = await Booking.create({
      userId: user.sub, venueId: body.venueId, courtId: null, subUnitIndex: null,
      sessionId: body.sessionId || null, eventId: body.eventId || null, date: body.date,
      startTime: body.startTime || null, endTime: body.endTime || null, playerCount: body.playerCount,
      amount: typeof body.amount === 'number' ? body.amount : parseFloat(body.amount),
      paymentMethod: body.paymentMethod || null,
      bookingType: 'open_play',
      status: awaitsManualPayment ? 'awaiting_payment' : 'confirmed',
      paymentDueAt: awaitsManualPayment
        ? computePaymentDueAt({
          now: new Date(),
          playStart: playStartOf(body.date, body.startTime),
          payWindowHours: v.bookingPayWindowHours ?? 24,
        })
        : null,
    });
    return c.json({ data: { ...openPlay.toObject(), id: openPlay._id } }, 201);
  }

  // If a specific court was chosen, it must actually belong to this venue (and be
  // active) — guards against a stale/foreign courtId pinning a booking to nothing.
  // We also read its per-court booking policy (approval override + turnover buffer)
  // and split-court config here so a single lookup covers validation, the clash
  // guard, and approval.
  let court: { approvalMode?: string; turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number } | null = null;
  if (body.courtId) {
    court = await Court.findOne({ _id: body.courtId, venueId: body.venueId, isActive: { $ne: false } })
      .select('approvalMode turnoverMinutes isSplittable splitCount').lean<{ approvalMode?: string; turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number }>();
    if (!court) return c.json({ error: { code: 'BAD_REQUEST', message: 'That court does not belong to this venue.' } }, 400);
    // Validate subUnitIndex is within the court's splitCount when set.
    if (body.subUnitIndex != null) {
      if (!court.isSplittable) return c.json({ error: { code: 'BAD_REQUEST', message: 'This court is not splittable — subUnitIndex is not valid.' } }, 400);
      const max = court.splitCount ?? 2;
      if (body.subUnitIndex < 0 || body.subUnitIndex >= max) return c.json({ error: { code: 'BAD_REQUEST', message: `subUnitIndex must be 0–${max - 1} for this court.` } }, 400);
    }
  }

  // Reject double-bookings before reserving (and before the player pays at
  // checkout). Honors the court's turnover buffer. Note: this is a check-then-
  // insert, so two near-simultaneous requests for the last open court could still
  // both pass — a unique index or a transaction would close that small window;
  // acceptable at this stage.
  const conflictMessage = await findSlotConflict(body, user.sub, court?.turnoverMinutes ?? 0, court?.isSplittable ?? false);
  if (conflictMessage) {
    // Unmet demand — a player wanted this slot but it was full. Capture it.
    void recordDemand({ type: 'empty_slot', venueId: body.venueId, courtId: body.courtId, userId: user.sub, date: body.date, startHour: body.startTime ? Number(body.startTime.split(':')[0]) : null });
    return c.json({ error: { code: 'SLOT_CONFLICT', message: conflictMessage } }, 409);
  }

  // Venue drives pricing, member discount, per-player surcharge, owner
  // notification — and the approval decision below, so it must be loaded first.
  const venue = await Venue.findById(body.venueId)
    .select('displayName ownerUserId priceFrom weekendPrice holidayPrice holidayDates memberDiscountPercent statutoryDiscounts perPlayerFee perPlayerFeeThreshold requireBookingApproval approvalWindowHours bookingPayWindowHours depositPercent')
    .lean<any>();

  // Per-court approval, with the venue default behind it. 'manual' always requires
  // approval and 'auto' never does; 'inherit' (the court default) follows the
  // venue's `requireBookingApproval` — which is what that flag has always been
  // documented to mean, but was never actually read here.
  const requiresApproval = court?.approvalMode === 'manual'
    || (court?.approvalMode !== 'auto' && !!venue?.requireBookingApproval);

  // How long the owner has to answer before the request auto-cancels and the slot
  // goes back on sale. Stamped now, not derived on read: the occupancy queries must
  // be able to settle "does this still hold the court?" from the booking row alone,
  // without joining the venue on the hottest read path in the app.
  const approvalDeadline = requiresApproval
    ? computeApprovalDeadline({
      now: new Date(),
      playStart: playStartOf(body.date, body.startTime),
      approvalWindowHours: venue?.approvalWindowHours ?? 24,
    })
    : null;

  // Test mode behaves like an instant gateway. Launch live mode is manual GCash:
  // an instant-book court is held as awaiting_payment until the venue confirms
  // the transfer. Pay-at-venue is intentionally different — that venue policy
  // reserves immediately and collects on arrival.
  const testMode = await (await import('../settings/settings.controller.js')).isPaymentTestMode();
  const awaitsManualPayment = !requiresApproval
    && body.paymentMethod !== 'pay_at_venue'
    && !testMode;
  const paymentDueAt = awaitsManualPayment
    ? computePaymentDueAt({
      now: new Date(),
      playStart: playStartOf(body.date, body.startTime),
      payWindowHours: venue?.bookingPayWindowHours ?? 24,
    })
    : null;

  // ── Pricing validation (hard) — skip for blocked slots and open-play ──
  let pricing: Awaited<ReturnType<typeof resolveHourlyRate>> | null = null;
  let authoritativeAmount: number | null = null;
  let preDiscountSubtotal: number | null = null;
  let discountAmount = 0;
  let discountPercent = 0;
  if (body.bookingType !== 'blocked' && body.bookingType !== 'open_play' && body.startTime && body.endTime) {
    const quote = await quoteSlotTotal({
      venueId: body.venueId,
      courtId: body.courtId || null,
      subUnitIndex: body.subUnitIndex ?? null,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      playerCount: body.playerCount ?? 1,
      customerCategory: body.customerCategory,
      userId: user?.sub ?? null,
      equipmentAmount: body.hasEquipmentRental && body.equipmentRentalAmount != null
        ? (typeof body.equipmentRentalAmount === 'number' ? body.equipmentRentalAmount : parseFloat(String(body.equipmentRentalAmount)))
        : 0,
      venue,
    });
    // Null means the time window didn't parse — a NaN total would make the
    // mismatch check below vacuously true and pass any client-chosen amount.
    if (!quote) {
      return c.json({ error: { code: 'INVALID_TIME', message: 'Invalid start or end time.' } }, 400);
    }
    ({ pricing, preDiscountSubtotal, discountAmount, discountPercent } = quote);
    authoritativeAmount = quote.total;
    const clientAmount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));

    // 1 PHP tolerance for rounding differences between client and server.
    if (Math.abs(clientAmount - quote.total) > 1) {
      return c.json({
        error: {
          code: 'PRICE_MISMATCH',
          message: `Amount mismatch. Expected ₱${quote.total.toFixed(2)}, got ₱${clientAmount.toFixed(2)}. The rate may have changed — please refresh and try again.`,
        },
      }, 409);
    }
  }

  // Service fee is server-authoritative — recompute it from the (already
  // amount-validated) stored total × the platform fee %, ignoring whatever the
  // client sent, so a crafted client can't under-report the platform's fee.
  const storedAmount = authoritativeAmount ?? (typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount)));
  preDiscountSubtotal ??= storedAmount;
  const { getServiceFeePercent } = await import('../settings/settings.controller.js');
  const serviceFeePercent = await getServiceFeePercent();
  const serviceFeeAmount = Math.round((preDiscountSubtotal || 0) * (serviceFeePercent / 100) * 100) / 100;
  const paymentOption = body.paymentOption || 'full';
  const payableTotal = Math.round((storedAmount + serviceFeeAmount) * 100) / 100;
  const depositPercent = Math.max(0, Math.min(100, Number(venue?.depositPercent) || 50));
  const amountPaid = paymentOption === 'pay_at_venue' ? 0
    : paymentOption === 'deposit' ? Math.round(payableTotal * depositPercent / 100 * 100) / 100
    : payableTotal;
  const balanceDue = Math.round((payableTotal - amountPaid) * 100) / 100;

  const result = await Booking.create({
    userId: user.sub, venueId: body.venueId, courtId: body.courtId || null,
    subUnitIndex: body.subUnitIndex ?? null,
    sessionId: body.sessionId || null, eventId: body.eventId || null, date: body.date,
    startTime: body.startTime || null, endTime: body.endTime || null, playerCount: body.playerCount,
    amount: storedAmount,
    paymentMethod: body.paymentMethod || null,
    status: requiresApproval ? 'pending_approval' : awaitsManualPayment ? 'awaiting_payment' : 'confirmed',
    approvalDeadline,
    paymentDueAt,
    // Capture the card on the request so paying after approval is one tap.
    savedCard: requiresApproval && body.card ? { brand: body.card.brand, last4: body.card.last4 } : undefined,
    // Equipment rental add-on (V2).
    hasEquipmentRental: body.hasEquipmentRental ?? false,
    equipmentRentalAmount: body.equipmentRentalAmount != null
      ? (typeof body.equipmentRentalAmount === 'number' ? body.equipmentRentalAmount : parseFloat(body.equipmentRentalAmount))
      : null,
    // Payment breakdown (service fee + deposit/full/pay-at-venue). The service fee
    // is recomputed server-side above (not trusted from the client).
    notes: body.notes || null,
    serviceFeeAmount,
    paymentOption,
    amountPaid,
    balanceDue,
    // Pricing audit trail.
    rateSource: pricing?.source ?? null,
    overrideId: pricing?.overrideId ?? null,
    baseRate: pricing?.baseRate ?? null,
    memberDiscountPercent: pricing?.memberDiscountPercent ?? null,
    customerCategory: body.customerCategory,
    discountPercent,
    discountAmount,
    discountIdNumber: body.customerCategory === 'none' ? null : resolvedDiscountIdNumber,
    preDiscountSubtotal,
  });

  // Notify the venue owner when a booking requires their approval. The deadline
  // goes in the body: "respond soon" is ignorable, an actual time is not.
  if (requiresApproval && venue?.ownerUserId) {
    const bookerName = (user as any).name || (user as any).email || 'A player';
    void notifyUser(venue.ownerUserId, {
      type: 'booking_pending_approval',
      title: 'New booking request',
      body: `${bookerName} requested to book at ${venue.displayName || 'your venue'}.`
        + (approvalDeadline ? ` Respond by ${deadlineLabel(approvalDeadline)} or it cancels automatically.` : ''),
      icon: 'calendar',
      linkUrl: '/owner/bookings?status=pending_approval',
      tag: String(result._id),
    });
  }

  // Demand: a realised court-booking intent (drives the owner demand report).
  void recordDemand({ type: 'booking_completed', venueId: body.venueId, courtId: body.courtId, userId: user.sub, date: body.date, startHour: body.startTime ? Number(body.startTime.split(':')[0]) : null });

  // Send booking email (best-effort, non-blocking).
  if (canEmail()) {
    const userEmail = (c.get('user') as any)?.email;
    if (userEmail) {
      const vn = venue?.displayName || 'the venue';
      const cn = court ? `Court ${(court as any).courtNumber || ''}` : undefined;
      const hrs = body.startTime && body.endTime
        ? Math.max(1, Math.round(((toMinutes(body.endTime)! - toMinutes(body.startTime)!) / 60) * 10) / 10)
        : 1;
      const rate = `₱${Number(result.amount || 0) / hrs || 0}`;
      const subtotal = `₱${Number(result.amount || 0).toFixed(2)}`;

      if (requiresApproval) {
        const t = bookingRequestedReceipt({
          receipt: String(result._id).slice(-8).toUpperCase(),
          venue: vn, court: cn,
          date: fmtDate(body.date), start: fmtTime(body.startTime), end: fmtTime(body.endTime), hours: hrs,
          rate, estimatedTotal: subtotal,
        });
        void sendEmail({ to: userEmail, subject: `Booking request sent — ${vn}`, body: t.text, html: t.html }).catch(() => {});
      } else {
        const t = bookingConfirmedReceipt({
          receipt: `OR-${String(result._id).slice(-8).toUpperCase()}`,
          venue: vn, court: cn,
          date: fmtDate(body.date), start: fmtTime(body.startTime), end: fmtTime(body.endTime), hours: hrs,
          rate, subtotal, fee: `₱${Number(result.serviceFeeAmount || 0).toFixed(2)}`,
          total: `₱${Number(result.amount || 0).toFixed(2)}`,
          method: body.paymentMethod || undefined,
        });
        void sendEmail({ to: userEmail, subject: `Booking confirmed — ${vn}`, body: t.text, html: t.html }).catch(() => {});
      }
    }
  }

  // Notify the player their instant-confirm booking went through. Approval-required
  // bookings notify on owner approval instead (see updateBookingStatus in venues).
  if (!requiresApproval && body.bookingType !== 'open_play' && body.bookingType !== 'blocked') {
    void notifyUser(user.sub, {
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: `Your booking at ${venue?.displayName || 'the venue'} on ${fmtDate(body.date)}${body.startTime ? ` at ${fmtTime(body.startTime)}` : ''} is confirmed.`,
      icon: 'calendar',
      linkUrl: '/my-bookings',
      tag: String(result._id),
    });
  }

  // Recurring: fan out the future occurrences. Only an instantly-confirmed court
  // booking with a real time window recurs — approval venues and courtless open-play
  // skip it (the primary here is already 'confirmed' + paid at checkout).
  let recurrenceCount = 0;
  if (body.recurrence && !requiresApproval && body.startTime && body.endTime
      && body.bookingType !== 'open_play' && body.bookingType !== 'blocked') {
    recurrenceCount = await generateRecurringOccurrences(
      result, body, serviceFeeAmount, court?.turnoverMinutes ?? 0, court?.isSplittable ?? false, user.sub,
    );
  }

  return c.json({ data: { ...result.toObject(), id: result._id, recurrenceCount } }, 201);
}

export async function getBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await Booking.findOne({ _id: id, userId: user.sub }).populate('venueId', 'displayName slug').lean();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  await expireOverdueBookings([row]);
  const refunds = await refundStateFor([String(row._id)]);
  // Keep `venueId` the ObjectId string (the populate replaces it with the venue
  // doc); name/slug are split out. Consumers (e.g. createGame) expect a string id.
  return c.json({ data: { ...row, id: row._id, venueId: row.venueId ? String((row.venueId as any)._id ?? row.venueId) : null, venueName: (row.venueId as any)?.displayName, venueSlug: (row.venueId as any)?.slug, refund: refunds.get(String(row._id)) ?? null } });
}

export async function updateBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  if (body.playerCount) allowed.playerCount = body.playerCount;
  if (body.paymentMethod) allowed.paymentMethod = body.paymentMethod;
  if (body.paymentProofUrl) allowed.paymentProofUrl = body.paymentProofUrl;
  if (!Object.keys(allowed).length) return c.json({ error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } }, 400);
  const result = await Booking.findOneAndUpdate({ _id: id, userId: user.sub }, allowed, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

/** Refund policy (item-4 decision): a booking cancelled MORE than 3 days before its
 *  play date is refunded whole; inside that 3-day window the player-canceller bears
 *  the gateway transaction fee, deducted from the refund. `transactionFeePercent` is
 *  admin-set (0 until PayMongo is wired), so today's refund is whole either way — but
 *  the math is here for when a fee is configured. Returns the real figures the app
 *  MUST show before the player confirms (no surprise deductions after the fact). */
async function computeRefundQuote(booking: any) {
  const { getTransactionFeePercent } = await import('../settings/settings.controller.js');
  const feePercent = await getTransactionFeePercent();
  const paid = Number(booking.amount || 0) + Number(booking.serviceFeeAmount || 0);
  const play = new Date(`${booking.date}T${booking.startTime || '00:00'}:00`);
  const daysUntil = (play.getTime() - Date.now()) / 86_400_000;
  const withinWindow = daysUntil <= 3;
  const feeDeducted = withinWindow ? Math.round(paid * (feePercent / 100) * 100) / 100 : 0;
  const refund = Math.round((paid - feeDeducted) * 100) / 100;
  return { paid, refund, feeDeducted, feePercent, withinWindow, daysUntil: Math.floor(daysUntil), freeWindowDays: 3 };
}

/**
 * Actually put the refund somewhere it can be finished.
 *
 * The old code set a local `refundStatus` string inside a fire-and-forget IIFE
 * and left the Payment row `completed`. Two things were broken by that: the
 * notification and the email raced the assignment (both slept 500ms and hoped),
 * and — worse — a live-mode refund had no record at all. "Processing — 5–10
 * business days" was a sentence, not a state: nothing tracked it, and there was
 * no way for anyone to ever mark it done. That is the "stuck processing" bug.
 *
 * Now the money lands in one of three settled outcomes, awaited before anything
 * is said to the player:
 *   not_required — no completed payment behind the booking, or nothing owed back
 *   completed    — test mode (or a zero-fee instant reversal): money is back
 *   pending      — live mode: recorded as `refund_pending` on the Payment, which
 *                  is the queue `listRefunds`/`settleRefund` work from
 */
export type RefundState = 'not_required' | 'pending' | 'completed';

export interface RefundOutcome {
  state: RefundState;
  amount: number;
  feeDeducted: number;
  paymentId: string | null;
  /** Human line for the receipt email + the cancellation response. */
  label: string;
}

export async function recordRefundForBooking(
  bookingId: string,
  quote: { refund: number; feeDeducted: number },
  reason: string,
): Promise<RefundOutcome> {
  const base = { amount: quote.refund, feeDeducted: quote.feeDeducted, paymentId: null as string | null };
  try {
    const payment = await Payment.findOne({ bookingId, status: 'completed' });
    if (!payment) return { ...base, state: 'not_required', label: 'No payment to refund' };
    if (!(quote.refund > 0)) {
      return { ...base, state: 'not_required', paymentId: String(payment._id), label: 'No refund due' };
    }

    const { isPaymentTestMode } = await import('../settings/settings.controller.js');
    const testMode = await isPaymentTestMode();
    const now = new Date();
    const feeNote = quote.feeDeducted > 0 ? `, ₱${quote.feeDeducted.toFixed(2)} transaction fee kept` : '';

    (payment as any).refundAmount = quote.refund;
    (payment as any).refundFeeAmount = quote.feeDeducted;
    (payment as any).refundRequestedAt = now;

    if (testMode) {
      // Test mode stands in for an instant gateway reversal.
      payment.status = 'refunded';
      (payment as any).refundedAt = now;
      payment.notes = `Auto-refunded ₱${quote.refund.toFixed(2)} — ${reason} (test mode)${feeNote} — ${now.toISOString()}`;
      await payment.save();
      return { ...base, state: 'completed', paymentId: String(payment._id), label: 'Refunded (test mode)' };
    }

    // Live mode: no gateway is wired yet, so the refund is a real obligation the
    // venue/admin settles by hand. Parking it in `refund_pending` is what makes
    // it findable and finishable instead of silently forgotten.
    payment.status = 'refund_pending';
    payment.notes = `Refund of ₱${quote.refund.toFixed(2)} owed — ${reason}${feeNote} — requested ${now.toISOString()}`;
    await payment.save();
    return { ...base, state: 'pending', paymentId: String(payment._id), label: 'Processing — 5–10 business days' };
  } catch {
    // The cancellation itself already stands; report the refund as unsettled
    // rather than claiming money moved.
    return { ...base, state: 'not_required', label: 'Refund could not be recorded — contact the venue' };
  }
}

/** Read-only: what the player would get back if they cancel this booking now. The
 *  refund screen calls this and shows the exact numbers before the confirm button. */
export async function getRefundQuote(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const booking = await Booking.findOne({ _id: id, userId: user.sub }).lean();
  if (!booking) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  const quote = await computeRefundQuote(booking);
  return c.json({ data: quote });
}

export async function cancelBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = cancelSchema.parse(await c.req.json());
  const result = await Booking.findOneAndUpdate(
    { _id: id, userId: user.sub },
    { status: 'cancelled', cancellationReason: body.cancellationReason || null, cancelledAt: new Date(), cancellationType: 'player_cancelled' },
    { new: true },
  ).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  // What the player gets back under the 3-day-window policy (whole refund unless
  // inside the window with a configured transaction fee). Drives the receipt + the
  // response, so the app can confirm the same figure it warned the player about.
  const refundQuote = await computeRefundQuote(result);
  // Demand: a cancelled booking is demand lost — capture it for the owner report.
  void recordDemand({ type: 'booking_cancelled', venueId: String((result as any).venueId), courtId: (result as any).courtId ? String((result as any).courtId) : null, userId: user.sub, date: (result as any).date, startHour: (result as any).startTime ? Number(String((result as any).startTime).split(':')[0]) : null });
  // Promote the next waitlisted player for this slot (best-effort).
  void (async () => {
    try {
      const { promoteWaitlistForSlot } = await import('../waitlist/waitlist.controller.js');
      await promoteWaitlistForSlot(String((result as any).venueId), (result as any).date, (result as any).startTime);
    } catch { /* promotion is best-effort */ }
  })();

  // Settle the refund BEFORE anything is said about it. This used to be a
  // fire-and-forget IIFE whose local string the notification and the email each
  // raced with a 500ms sleep — so the player could be told "no payment to refund"
  // for a booking that had just been refunded. It is cheap and it is the money:
  // await it.
  const refund = await recordRefundForBooking(id, refundQuote, 'booking cancelled by player');
  const refundStatus = refund.label;

  // Notify the player, the owner, and refund status (best-effort, fire-and-forget).
  // Runs independently of email — push + in-app notifications always fire.
  void (async () => {
    try {
      const v = await Venue.findById((result as any).venueId).select('displayName ownerUserId').lean<{ displayName?: string; ownerUserId?: any }>();
      const venueName = v?.displayName || 'the venue';
      const when = `${fmtDate((result as any).date)}${(result as any).startTime ? ` at ${fmtTime((result as any).startTime)}` : ''}`;

      void notifyUser((result as any).userId, {
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: `Your booking at ${venueName} on ${when} was cancelled.${refund.state !== 'not_required' ? ` ₱${refund.amount.toFixed(2)} will be refunded.` : ''}`,
        icon: 'calendar',
        linkUrl: '/my-bookings',
        tag: String((result as any)._id),
      });

      if (v?.ownerUserId) {
        void notifyUser(v.ownerUserId, {
          type: 'booking_cancelled',
          title: 'Booking cancelled by player',
          body: `A booking at ${venueName} on ${when} was cancelled by the player. The slot is back on sale.`,
          icon: 'calendar',
          linkUrl: '/owner/bookings',
          tag: String((result as any)._id),
        });
      }

      // Say what actually happened. "Refund processed" was sent even when nothing
      // had been processed — the live-mode path had only written a string.
      if (refund.state === 'completed') {
        void notifyUser((result as any).userId, {
          type: 'booking_refunded',
          title: 'Refund processed',
          body: `₱${refund.amount.toFixed(2)} has been refunded for your cancelled booking at ${venueName}.`
            + (refund.feeDeducted > 0 ? ` A ₱${refund.feeDeducted.toFixed(2)} transaction fee was kept.` : ''),
          icon: 'payments',
          linkUrl: '/my-bookings',
          tag: `refund-${String((result as any)._id)}`,
        });
      } else if (refund.state === 'pending') {
        void notifyUser((result as any).userId, {
          type: 'booking_refund_pending',
          title: 'Refund on the way',
          body: `₱${refund.amount.toFixed(2)} is being refunded for your cancelled booking at ${venueName}.`
            + (refund.feeDeducted > 0 ? ` A ₱${refund.feeDeducted.toFixed(2)} transaction fee is kept.` : '')
            + ' It may take 5–10 business days to appear.',
          icon: 'payments',
          linkUrl: '/my-bookings',
          tag: `refund-${String((result as any)._id)}`,
        });
      }
    } catch { /* notifications are best-effort */ }
  })();

  // Send cancellation email (best-effort).
  if (canEmail()) {
    const ue = (c.get('user') as any)?.email;
    if (ue) {
      void (async () => {
        try {
          const v = await Venue.findById((result as any).venueId).select('displayName').lean<{ displayName?: string }>();
          const venueName = v?.displayName || 'the venue';
          const t = cancellationReceipt({
            receipt: String((result as any)._id).slice(-8).toUpperCase(),
            venue: venueName,
            date: fmtDate((result as any).date),
            time: `${fmtTime((result as any).startTime)} – ${fmtTime((result as any).endTime)}`,
            refund: `₱${refund.amount.toFixed(2)}`,
            refundStatus,
            cancelledAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          });
          await sendEmail({ to: ue, subject: `Booking cancelled — ${v?.displayName || 'your booking'}`, body: t.text, html: t.html });
        } catch { /* best-effort */ }
      })();
    }
  }

  // `refund` is the settled outcome (what the Payment row now says); `refundQuote`
  // stays for the existing callers that show the policy breakdown.
  return c.json({ data: { ...result, id: result._id, refundQuote, refund } });
}

/* ─── Booking modification (reschedule / change court) ───────────────── */

const modifySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  courtId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
});

const MAX_MODIFICATIONS = 3;

// PATCH /bookings/:id/modify — reschedule a booking (date, time, court).
// Player-scoped: only the booking owner can modify their own booking.
// Owner/staff can modify via the existing PATCH /venues/:id/bookings/:bookingId.
// Re-checks slot availability on the new slot.
export async function modifyBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const booking = await Booking.findOne({ _id: id, userId: user.sub });
  if (!booking) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);

  if ((booking as any).status === 'cancelled') {
    return c.json({ error: { code: 'CONFLICT', message: 'This booking has been cancelled' } }, 409);
  }
  if (isPastSlot((booking as any).date, (booking as any).startTime)) {
    return c.json({ error: { code: 'CONFLICT', message: 'This booking has already started' } }, 409);
  }

  const { BookingModification } = await import('./bookings.model.js');
  const modCount = await BookingModification.countDocuments({ bookingId: id });
  if (modCount >= MAX_MODIFICATIONS) {
    return c.json({ error: { code: 'CONFLICT', message: `Maximum ${MAX_MODIFICATIONS} modifications per booking` } }, 409);
  }

  const body = modifySchema.parse(await c.req.json());
  const changes: Record<string, [string | undefined, string | undefined]> = {};
  const newDate = body.date ?? (booking as any).date;
  const newStart = body.startTime ?? (booking as any).startTime;
  const newEnd = body.endTime ?? (booking as any).endTime;
  const newCourtId = body.courtId !== undefined ? body.courtId : (booking as any).courtId?.toString() ?? null;

  if (body.date && body.date !== (booking as any).date) changes.date = [(booking as any).date, body.date];
  if (body.startTime && body.startTime !== (booking as any).startTime) changes.startTime = [(booking as any).startTime, body.startTime];
  if (body.endTime && body.endTime !== (booking as any).endTime) changes.endTime = [(booking as any).endTime, body.endTime];
  if (body.courtId !== undefined && String(body.courtId ?? '') !== String((booking as any).courtId ?? '')) {
    changes.courtId = [(booking as any).courtId?.toString(), body.courtId || undefined];
  }

  if (Object.keys(changes).length === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No changes requested' } }, 400);
  }

  // Re-check slot availability for the new slot.
  if (body.date || body.startTime || body.endTime || body.courtId !== undefined) {
    const conflictMessage = await findSlotConflict({
      venueId: String((booking as any).venueId),
      courtId: newCourtId,
      subUnitIndex: (booking as any).subUnitIndex,
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
    },
    String((booking as any).userId), 0, false,
    // Exclude the booking being moved from the occupancy set. Without this a
    // same-court, same-day time change clashes with ITSELF — both the
    // "you already have a booking that overlaps" check and the capacity pool
    // count the row we're about to vacate, so a one-court venue could never
    // reschedule anything.
    String((booking as any)._id),
    );
    if (conflictMessage) {
      return c.json({ error: { code: 'SLOT_CONFLICT', message: conflictMessage } }, 409);
    }
  }

  // ── Re-price the new slot ────────────────────────────────────────────────
  //
  // The reschedule branch used to end here with a hardcoded `priceDelta: 0`, so
  // moving a booking from an off-peak Tuesday morning to a Saturday-evening surge
  // slot cost the player nothing and the venue lost the difference (and the
  // reverse silently kept the player's money). The new slot is priced through the
  // SAME ladder checkout uses, and the difference lands on the booking.
  const oldAmount = Number((booking as any).amount || 0);
  const quote = (booking as any).bookingType === 'blocked' || (booking as any).bookingType === 'open_play'
    ? null
    : await quoteSlotTotal({
      venueId: String((booking as any).venueId),
      courtId: newCourtId,
      subUnitIndex: (booking as any).subUnitIndex ?? null,
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      playerCount: (booking as any).playerCount ?? 1,
      customerCategory: (booking as any).customerCategory ?? 'none',
      userId: String((booking as any).userId),
      equipmentAmount: (booking as any).hasEquipmentRental ? Number((booking as any).equipmentRentalAmount || 0) : 0,
    });

  // Apply changes.
  if (body.date) (booking as any).date = body.date;
  if (body.startTime) (booking as any).startTime = body.startTime;
  if (body.endTime) (booking as any).endTime = body.endTime;
  if (body.courtId !== undefined) (booking as any).courtId = body.courtId || null;

  let priceDelta = 0;
  if (quote) {
    const { getServiceFeePercent } = await import('../settings/settings.controller.js');
    const serviceFeePercent = await getServiceFeePercent();
    const serviceFeeAmount = Math.round((quote.preDiscountSubtotal || 0) * (serviceFeePercent / 100) * 100) / 100;
    priceDelta = Math.round((quote.total - oldAmount) * 100) / 100;

    (booking as any).amount = quote.total;
    (booking as any).preDiscountSubtotal = quote.preDiscountSubtotal;
    (booking as any).discountAmount = quote.discountAmount;
    (booking as any).discountPercent = quote.discountPercent;
    (booking as any).serviceFeeAmount = serviceFeeAmount;
    (booking as any).rateSource = quote.pricing?.source ?? null;
    (booking as any).overrideId = quote.pricing?.overrideId ?? null;
    (booking as any).baseRate = quote.pricing?.baseRate ?? null;
    (booking as any).memberDiscountPercent = quote.pricing?.memberDiscountPercent ?? null;

    // What's already been collected doesn't change; what's outstanding does. A
    // NEGATIVE balance is the venue owing the player back after a move to a
    // cheaper slot — no gateway is wired to push that automatically, so it is
    // carried here and settled at the venue rather than quietly kept.
    const payableTotal = Math.round((quote.total + serviceFeeAmount) * 100) / 100;
    const alreadyPaid = Number((booking as any).amountPaid || 0);
    (booking as any).balanceDue = Math.round((payableTotal - alreadyPaid) * 100) / 100;
  }

  await (booking as any).save();

  await BookingModification.create({
    bookingId: id,
    userId: user.sub,
    changes,
    priceDelta,
  });

  // Tell the player what the move cost or saved them — a reschedule that silently
  // changes what they owe is the same bug in a different place.
  if (priceDelta !== 0) {
    void (async () => {
      try {
        const v = await Venue.findById((booking as any).venueId).select('displayName').lean<{ displayName?: string }>();
        const when = `${fmtDate((booking as any).date)}${(booking as any).startTime ? ` at ${fmtTime((booking as any).startTime)}` : ''}`;
        const owes = priceDelta > 0;
        await notifyUser((booking as any).userId, {
          type: owes ? 'booking_reschedule_due' : 'booking_reschedule_credit',
          title: owes ? 'Reschedule — extra due' : 'Reschedule — credit due',
          body: owes
            ? `Your new slot at ${v?.displayName || 'the venue'} (${when}) costs ₱${priceDelta.toFixed(2)} more. Settle the difference with the venue.`
            : `Your new slot at ${v?.displayName || 'the venue'} (${when}) costs ₱${Math.abs(priceDelta).toFixed(2)} less. The venue will credit the difference back.`,
          icon: 'payments',
          linkUrl: '/my-bookings',
          tag: `reschedule-${String((booking as any)._id)}`,
        });
      } catch { /* notifications are best-effort; the reschedule already stands */ }
    })();
  }

  return c.json({
    data: {
      id: String((booking as any)._id),
      changes,
      modificationCount: modCount + 1,
      priceDelta,
      amount: (booking as any).amount,
      serviceFeeAmount: (booking as any).serviceFeeAmount,
      balanceDue: (booking as any).balanceDue,
    },
  });
}
