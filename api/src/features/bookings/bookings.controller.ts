import { z } from 'zod';
import { Booking } from './bookings.model.js';
import { Venue, Court, VenueMember } from '../venues/venues.model.js';
import { Payment } from '../payments/payments.model.js';
import { recordDemand } from '../demand/demand.controller.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { sendEmail, isGmailConfigured, hasValidTokens } from '../../shared/lib/gmail.js';
import { bookingConfirmedReceipt, bookingRequestedReceipt, cancellationReceipt } from '../../shared/lib/email-templates.js';
import { resolveHourlyRate, perPlayerSurcharge } from './pricing.js';

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

/** Every active (non-cancelled) booking for a venue on a date — the occupancy set. */
export async function activeBookingsForDate(venueId: string, date: string) {
  return Booking.find({ venueId, date, status: { $ne: 'cancelled' } })
    .select('startTime endTime courtId subUnitIndex')
    .lean<{ startTime?: string | null; endTime?: string | null; courtId?: any; subUnitIndex?: number | null }[]>();
}

// A reservation clashes when its court (or, for venue-level bookings, every court
// in the pool) is already taken for an hour it touches. Returns a human message
// to show the player, or null when the slot is free. `turnoverMinutes` is the
// chosen court's optional buffer: the new window also clashes when it falls within
// that gap of an existing booking on the same court (back-to-back too tight).
export async function findSlotConflict(body: {
  venueId: string; courtId?: string | null; subUnitIndex?: number | null; date: string; startTime?: string; endTime?: string;
}, userId?: string | null, turnoverMinutes = 0, isSplittable = false): Promise<string | null> {
  // Can only reason about clashes when the request specifies a time window.
  if (!body.startTime || !body.endTime) return null;
  if (body.endTime <= body.startTime) return 'End time must be after the start time.';
  const wanted = hoursTouched(body.startTime, body.endTime);
  if (!wanted.length) return null;

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
      status: { $ne: 'cancelled' },
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
      status: { $ne: 'cancelled' }, startTime: { $ne: null }, endTime: { $ne: null },
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
  }

  // Pool capacity — enforced for every booking, named court or not. Even a chosen
  // court can't be sold if every physical sub-unit is already taken for an hour it
  // touches. Uses effective capacity so splittable courts contribute their sub-unit
  // count (a 2-way court = 2 slots) rather than 1.
  const capacity = body.subUnitIndex != null
    ? await resolveEffectiveCapacity(body.venueId)
    : await resolveVenueCapacity(body.venueId);
  const free = freeCourtsByHour(await activeBookingsForDate(body.venueId, body.date), capacity);
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
  startTime: z.string().optional(),
  endTime: z.string().optional(),
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
});

/** Coerce a "string | number | undefined" money input to a number, or null. */
function num(v: string | number | undefined | null): number | null {
  if (v == null || v === '') return null;
  return typeof v === 'number' ? v : parseFloat(v);
}

const cancelSchema = z.object({ cancellationReason: z.string().optional() });

/**
 * Lazily expire approved bookings whose pay-window has lapsed: flip them to
 * 'cancelled' (freeing the slot) and reflect that in the rows being returned.
 * Run on read so an unpaid request doesn't linger as a hold forever — there's no
 * scheduler, so "expiry" happens the next time anyone lists those bookings.
 */
export async function expireOverdueBookings(rows: any[]): Promise<void> {
  const now = Date.now();
  const overdue = rows.filter((r) => r.status === 'awaiting_payment' && r.paymentDueAt && new Date(r.paymentDueAt).getTime() < now);
  if (!overdue.length) return;
  await Booking.updateMany(
    { _id: { $in: overdue.map((r) => r._id) } },
    { status: 'cancelled', cancellationReason: 'Payment window expired', cancelledAt: new Date() },
  );
  for (const r of overdue) { r.status = 'cancelled'; r.cancellationReason = 'Payment window expired'; }
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
  // Keep `venueId` the ObjectId string (the populate replaces it with the venue
  // doc); name/slug are split out. Consumers (e.g. createGame) expect a string id.
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueId: r.venueId ? String(r.venueId._id ?? r.venueId) : null, venueName: r.venueId?.displayName, venueSlug: r.venueId?.slug })) });
}

export async function createBooking(c: any) {
  const user = c.get('user');
  const body = createSchema.parse(await c.req.json());

  // Reject past-time bookings (covers the create-a-game flow too — it books here).
  if (isPastSlot(body.date, body.startTime)) {
    return c.json({ error: { code: 'PAST_SLOT', message: 'That time has already passed. Please pick a future slot.' } }, 409);
  }

  // V3 — open play: a courtless per-session drop-in. It doesn't reserve a court,
  // so it skips court validation, the clash guard, and the approval flow — the
  // player just pays the venue's per-session fee and is confirmed. Guard that the
  // venue actually offers open play before taking money.
  if (body.bookingType === 'open_play') {
    const v = await Venue.findById(body.venueId).select('openPlayPrice').lean<{ openPlayPrice?: number }>();
    if (!v) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
    if (!(Number(v.openPlayPrice) > 0)) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'This venue does not offer open play.' } }, 400);
    }
    const openPlay = await Booking.create({
      userId: user.sub, venueId: body.venueId, courtId: null, subUnitIndex: null,
      sessionId: body.sessionId || null, eventId: body.eventId || null, date: body.date,
      startTime: body.startTime || null, endTime: body.endTime || null, playerCount: body.playerCount,
      amount: typeof body.amount === 'number' ? body.amount : parseFloat(body.amount),
      paymentMethod: body.paymentMethod || null,
      bookingType: 'open_play',
      status: 'confirmed',
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

  // Per-court approval — a court set to 'manual' requires owner approval before
  // the player pays; anything else (including 'auto' and 'inherit') confirms instantly.
  const requiresApproval = court?.approvalMode === 'manual';

  // Venue still needed for pricing, member discount, per-player surcharge,
  // and owner notification — just no longer for the approval decision.
  const venue = await Venue.findById(body.venueId).select('displayName ownerUserId priceFrom weekendPrice holidayPrice holidayDates memberDiscountPercent perPlayerFee perPlayerFeeThreshold').lean<{ displayName?: string; ownerUserId?: any; priceFrom?: number; weekendPrice?: number; holidayPrice?: number; holidayDates?: string[]; memberDiscountPercent?: number; perPlayerFee?: number; perPlayerFeeThreshold?: number }>();

  // ── Pricing validation (hard) — skip for blocked slots and open-play ──
  let pricing: { rate: number; baseRate: number; source: string; memberApplied: boolean; memberDiscountPercent: number; overrideId?: string } | null = null;
  if (body.bookingType !== 'blocked' && body.bookingType !== 'open_play' && body.startTime && body.endTime) {
    const startH = Number(body.startTime.split(':')[0]);
    const endH = Number(body.endTime.split(':')[0]);
    const hours = Math.max(1, endH - startH);

    // Read pricing mode from settings: 'start' (default) = start-time rate × hours;
    // 'blend' = resolve per clock hour so bookings crossing override boundaries
    // validate correctly (e.g. 8–10am early bird + 10am–noon regular).
    const { getSingleton } = await import('../settings/settings.controller.js');
    const appSettings = await getSingleton();
    const blendMode = appSettings?.pricingMode === 'blend';

    let expectedAmount = 0;
    if (blendMode) {
      for (let h = startH; h < endH; h++) {
        const hourStart = `${String(h).padStart(2, '0')}:00`;
        const hr = await resolveHourlyRate({
          venueId: body.venueId,
          courtId: body.courtId || null,
          subUnitIndex: body.subUnitIndex ?? null,
          date: body.date,
          startTime: hourStart,
          isMember: false,
        });
        expectedAmount += hr.rate;
        if (!pricing) pricing = hr;
      }
    } else {
      // Start mode: resolve once at start time, multiply by hours.
      pricing = await resolveHourlyRate({
        venueId: body.venueId,
        courtId: body.courtId || null,
        subUnitIndex: body.subUnitIndex ?? null,
        date: body.date,
        startTime: body.startTime,
        isMember: false,
      });
      expectedAmount = pricing.rate * hours;
    }

    // Check if the player is a venue member (for member discount).
    if (user?.sub && pricing) {
      const membership = await VenueMember.findOne({
        venueId: body.venueId, userId: user.sub, status: 'active',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).lean();
      if (membership) {
        pricing.memberApplied = true;
        pricing.memberDiscountPercent = Math.max(0, Math.min(100, Number(venue?.memberDiscountPercent) || 0));
        if (blendMode) {
          expectedAmount = 0;
          for (let h = startH; h < endH; h++) {
            const hourStart = `${String(h).padStart(2, '0')}:00`;
            const hr = await resolveHourlyRate({
              venueId: body.venueId,
              courtId: body.courtId || null,
              subUnitIndex: body.subUnitIndex ?? null,
              date: body.date,
              startTime: hourStart,
              isMember: false,
            });
            expectedAmount += Math.round(hr.baseRate * (1 - pricing.memberDiscountPercent / 100) * 100) / 100;
          }
        } else {
          expectedAmount = Math.round(pricing.baseRate * (1 - pricing.memberDiscountPercent / 100) * 100) / 100 * hours;
        }
        pricing.rate = Math.round(pricing.baseRate * (1 - pricing.memberDiscountPercent / 100) * 100) / 100;
      }
    }

    // Compute expected amount: total + equipment + per-player surcharge.
    const equipAmount = body.hasEquipmentRental && body.equipmentRentalAmount != null
      ? (typeof body.equipmentRentalAmount === 'number' ? body.equipmentRentalAmount : parseFloat(String(body.equipmentRentalAmount)))
      : 0;
    const surcharge = perPlayerSurcharge(venue, body.playerCount ?? 1);
    const expectedTotal = Math.round((expectedAmount + Number(equipAmount) + surcharge) * 100) / 100;
    const clientAmount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));

    // 1 PHP tolerance for rounding differences between client and server.
    if (Math.abs(clientAmount - expectedTotal) > 1) {
      return c.json({
        error: {
          code: 'PRICE_MISMATCH',
          message: `Amount mismatch. Expected ₱${expectedTotal.toFixed(2)}, got ₱${clientAmount.toFixed(2)}. The rate may have changed — please refresh and try again.`,
        },
      }, 409);
    }
  }

  // Service fee is server-authoritative — recompute it from the (already
  // amount-validated) stored total × the platform fee %, ignoring whatever the
  // client sent, so a crafted client can't under-report the platform's fee.
  const storedAmount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));
  const { getServiceFeePercent } = await import('../settings/settings.controller.js');
  const serviceFeePercent = await getServiceFeePercent();
  const serviceFeeAmount = Math.round((storedAmount || 0) * (serviceFeePercent / 100) * 100) / 100;

  const result = await Booking.create({
    userId: user.sub, venueId: body.venueId, courtId: body.courtId || null,
    subUnitIndex: body.subUnitIndex ?? null,
    sessionId: body.sessionId || null, eventId: body.eventId || null, date: body.date,
    startTime: body.startTime || null, endTime: body.endTime || null, playerCount: body.playerCount,
    amount: typeof body.amount === 'number' ? body.amount : parseFloat(body.amount),
    paymentMethod: body.paymentMethod || null,
    status: requiresApproval ? 'pending_approval' : 'confirmed',
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
    paymentOption: body.paymentOption || null,
    amountPaid: num(body.amountPaid),
    balanceDue: num(body.balanceDue),
    // Pricing audit trail.
    rateSource: pricing?.source ?? null,
    overrideId: pricing?.overrideId ?? null,
    baseRate: pricing?.baseRate ?? null,
    memberDiscountPercent: pricing?.memberDiscountPercent ?? null,
  });

  // Notify the venue owner when a booking requires their approval.
  if (requiresApproval && venue?.ownerUserId) {
    const bookerName = (user as any).name || (user as any).email || 'A player';
    void notifyUser(venue.ownerUserId, {
      type: 'booking_pending_approval',
      title: 'New booking request',
      body: `${bookerName} requested to book at ${venue.displayName || 'your venue'}.`,
      icon: 'calendar',
      linkUrl: '/owner/bookings?status=pending_approval',
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

  return c.json({ data: { ...result.toObject(), id: result._id } }, 201);
}

export async function getBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await Booking.findOne({ _id: id, userId: user.sub }).populate('venueId', 'displayName slug').lean();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  await expireOverdueBookings([row]);
  // Keep `venueId` the ObjectId string (the populate replaces it with the venue
  // doc); name/slug are split out. Consumers (e.g. createGame) expect a string id.
  return c.json({ data: { ...row, id: row._id, venueId: row.venueId ? String((row.venueId as any)._id ?? row.venueId) : null, venueName: (row.venueId as any)?.displayName, venueSlug: (row.venueId as any)?.slug } });
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

export async function cancelBooking(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = cancelSchema.parse(await c.req.json());
  const result = await Booking.findOneAndUpdate(
    { _id: id, userId: user.sub },
    { status: 'cancelled', cancellationReason: body.cancellationReason || null, cancelledAt: new Date() },
    { new: true },
  ).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
  // Demand: a cancelled booking is demand lost — capture it for the owner report.
  void recordDemand({ type: 'booking_cancelled', venueId: String((result as any).venueId), courtId: (result as any).courtId ? String((result as any).courtId) : null, userId: user.sub, date: (result as any).date, startHour: (result as any).startTime ? Number(String((result as any).startTime).split(':')[0]) : null });
  // Promote the next waitlisted player for this slot (best-effort).
  void (async () => {
    try {
      const { promoteWaitlistForSlot } = await import('../waitlist/waitlist.controller.js');
      await promoteWaitlistForSlot(String((result as any).venueId), (result as any).date, (result as any).startTime);
    } catch { /* promotion is best-effort */ }
  })();

  // Auto-process refund in test mode — find the associated payment and mark it refunded.
  let refundStatus = 'No payment to refund';
  void (async () => {
    try {
      const payment = await Payment.findOne({ bookingId: id, status: 'completed' });
      if (payment) {
        const { isPaymentTestMode } = await import('../settings/settings.controller.js');
        const testMode = await isPaymentTestMode();
        if (testMode) {
          payment.status = 'refunded';
          payment.notes = `Auto-refunded on cancellation (test mode) — ${new Date().toISOString()}`;
          await payment.save();
          refundStatus = 'Refunded (test mode)';
        } else {
          refundStatus = 'Processing — 5–10 business days';
        }
      }
    } catch { /* best-effort */ }
  })();

  // Send cancellation email (best-effort).
  if (canEmail()) {
    const ue = (c.get('user') as any)?.email;
    if (ue) {
      void (async () => {
        try {
          // Wait a tick for refund to process
          await new Promise(r => setTimeout(r, 500));
          const v = await Venue.findById((result as any).venueId).select('displayName').lean<{ displayName?: string }>();
          const t = cancellationReceipt({
            receipt: String((result as any)._id).slice(-8).toUpperCase(),
            venue: v?.displayName || 'the venue',
            date: fmtDate((result as any).date),
            time: `${fmtTime((result as any).startTime)} – ${fmtTime((result as any).endTime)}`,
            refund: `₱${Number((result as any).amount || 0).toFixed(2)}`,
            refundStatus,
            cancelledAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          });
          await sendEmail({ to: ue, subject: `Booking cancelled — ${v?.displayName || 'your booking'}`, body: t.text, html: t.html });
        } catch { /* best-effort */ }
      })();
    }
  }

  return c.json({ data: { ...result, id: result._id } });
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
      bookingType: (booking as any).bookingType,
    }, String((booking as any).userId), 0, false);
    if (conflictMessage) {
      return c.json({ error: { code: 'SLOT_CONFLICT', message: conflictMessage } }, 409);
    }
  }

  // Apply changes.
  if (body.date) (booking as any).date = body.date;
  if (body.startTime) (booking as any).startTime = body.startTime;
  if (body.endTime) (booking as any).endTime = body.endTime;
  if (body.courtId !== undefined) (booking as any).courtId = body.courtId || null;
  await (booking as any).save();

  await BookingModification.create({
    bookingId: id,
    userId: user.sub,
    changes,
    priceDelta: 0,
  });

  return c.json({ data: { id: String((booking as any)._id), changes, modificationCount: modCount + 1 } });
}
