// Integration tests for the four booking endings that previously had no
// closing move — the "Missing booking endings" item:
//
//   1. no-show        — a played-out booking stayed `confirmed` forever and the
//                       venue's configured `noShowFee` was never read
//   2. refund         — a live-mode refund said "processing" with no state
//                       behind it and no way to ever settle it
//   3. reschedule     — `priceDelta` was hardcoded 0, so moving to a pricier
//                       slot cost the player nothing
//   4. walk-in        — a manual reservation with no amount was filed at ₱0
//
// Drives the real controller handlers against real Mongo (mongodb-memory-server)
// with a mock Hono context, so it proves the wired behaviour, not the schema.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Booking, BookingModification } from './bookings.model.js';
import { Venue, SlotPriceOverride } from '../venues/venues.model.js';
import { Payment } from '../payments/payments.model.js';
import { AppSettings } from '../settings/settings.model.js';
import { Notification } from '../interactions/interactions.model.js';
import { markBookingAttendance, createVenueBooking, getVenueAnalytics } from '../venues/venues.controller.js';
import { settleRefund, listPendingRefunds } from '../payments/payments.controller.js';
import { cancelBooking, modifyBooking } from './bookings.controller.js';

let mongod: MongoMemoryServer;

const ownerId = new Types.ObjectId();
const playerId = new Types.ObjectId();
let venueId: Types.ObjectId;

function ymd(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mkCtx(opts: { user?: any; params?: Record<string, string>; query?: Record<string, string>; body?: any }) {
  const responses: Array<{ payload: any; status: number }> = [];
  return {
    _responses: responses,
    req: {
      param: (name: string) => opts.params?.[name],
      query: () => opts.query ?? {},
      json: async () => opts.body ?? {},
    },
    get: (key: string) => (key === 'user' ? opts.user : undefined),
    json: (payload: any, status = 200) => { responses.push({ payload, status }); return { payload, status }; },
  } as any;
}

// Passes requireVenueManager (admin.venues.manage resolves to 'owner').
const ownerUser = { sub: String(ownerId), permissions: ['admin.venues.manage', 'owner.bookings.manage'] };
const adminUser = { sub: String(ownerId), permissions: ['admin.bookings.manage'] };
const playerUser = { sub: String(playerId) };

/** Let the fire-and-forget notification IIFEs land before asserting on them. */
const settle = () => new Promise((r) => setTimeout(r, 60));

async function setTestMode(on: boolean) {
  await AppSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { key: 'global', paymentTestMode: on } },
    { upsert: true },
  );
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const venue = await Venue.create({
    displayName: 'Endings Test Venue', slug: 'endings-test-venue', state: 'active',
    ownerUserId: ownerId, priceFrom: 400, noShowFee: 150, cancellationWindowHours: 24,
  });
  venueId = venue._id as Types.ObjectId;
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    BookingModification.deleteMany({}),
    Payment.deleteMany({}),
    Notification.deleteMany({}),
    SlotPriceOverride.deleteMany({}),
  ]);
  await setTestMode(true);
});

/* ─── 1. No-show ──────────────────────────────────────────────────── */

describe('ending 1 — no-show', () => {
  it('marks a played-out booking as a no-show, snapshots the venue fee, and tells the player', async () => {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(-1), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'confirmed',
    });
    const c = mkCtx({
      user: ownerUser,
      params: { id: String(venueId), bookingId: String(b._id) },
      body: { attendance: 'no_show' },
    });
    await markBookingAttendance(c);
    expect(c._responses[0].status).toBe(200);

    const row: any = await Booking.findById(b._id).lean();
    expect(row.attendance).toBe('no_show');
    expect(row.attendanceMarkedAt).toBeTruthy();
    // Snapshotted from the venue policy, not read live at display time.
    expect(row.noShowFeeAmount).toBe(150);
    // The booking is NOT cancelled — the venue keeps the money and the slot was consumed.
    expect(row.status).toBe('confirmed');

    await settle();
    const notif: any = await Notification.findOne({ userId: playerId, type: 'booking_no_show' }).lean();
    expect(notif).toBeTruthy();
    expect(notif.body).toMatch(/150\.00/);
  });

  it('a no-show still counts as revenue, and shows up as its own analytics KPI', async () => {
    await Booking.create({
      userId: playerId, venueId, date: ymd(-1), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'confirmed', attendance: 'no_show',
    });
    const c = mkCtx({ user: ownerUser, params: { id: String(venueId) }, query: {} });
    await getVenueAnalytics(c);
    const { kpis } = c._responses[0].payload.data;
    expect(kpis.bookings.noShows).toBe(1);
    // The money stayed with the venue, so it must not vanish from revenue.
    expect(kpis.revenue.month).toBe(400);
  });

  it("refuses to mark a booking that hasn't started yet", async () => {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(2), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'confirmed',
    });
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId), bookingId: String(b._id) },
      body: { attendance: 'no_show' },
    });
    await markBookingAttendance(c);
    expect(c._responses[0].status).toBe(409);
    expect(c._responses[0].payload.error.code).toBe('TOO_EARLY');
  });

  it('correcting a no-show back to attended drops the fee and notifies', async () => {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(-1), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'confirmed', attendance: 'no_show', noShowFeeAmount: 150,
    });
    await markBookingAttendance(mkCtx({
      user: ownerUser, params: { id: String(venueId), bookingId: String(b._id) },
      body: { attendance: 'attended' },
    }));
    const row: any = await Booking.findById(b._id).lean();
    expect(row.attendance).toBe('attended');
    expect(row.noShowFeeAmount ?? null).toBeNull();
    await settle();
    expect(await Notification.countDocuments({ type: 'booking_no_show_cleared' })).toBe(1);
  });

  it('a cancelled booking has no attendance to record', async () => {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(-1), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'cancelled',
    });
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId), bookingId: String(b._id) },
      body: { attendance: 'no_show' },
    });
    await markBookingAttendance(c);
    expect(c._responses[0].status).toBe(409);
  });
});

/* ─── 2. Refund ───────────────────────────────────────────────────── */

describe('ending 2 — refund', () => {
  async function paidBooking() {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(10), startTime: '10:00', endTime: '11:00',
      amount: 400, serviceFeeAmount: 28, status: 'confirmed',
    });
    await Payment.create({
      bookingId: b._id, userId: playerId, amount: 428, status: 'completed', method: 'gcash',
    });
    return b;
  }

  it('live mode: cancelling parks the money in refund_pending instead of a dead "processing" string', async () => {
    await setTestMode(false);
    const b = await paidBooking();
    const c = mkCtx({ user: playerUser, params: { id: String(b._id) }, body: {} });
    await cancelBooking(c);

    const { refund } = c._responses[0].payload.data;
    expect(refund.state).toBe('pending');
    expect(refund.amount).toBe(428);

    const p: any = await Payment.findOne({ bookingId: b._id }).lean();
    expect(p.status).toBe('refund_pending');
    expect(p.refundAmount).toBe(428);
    expect(p.refundRequestedAt).toBeTruthy();
    expect(p.refundedAt ?? null).toBeNull();

    await settle();
    // The player is told it's on the way — not that it's already done. Scoped to
    // this booking's refund tag so a late IIFE from another test can't skew it.
    const tag = `refund-${String(b._id)}`;
    expect(await Notification.countDocuments({ tag, type: 'booking_refund_pending' })).toBe(1);
    expect(await Notification.countDocuments({ tag, type: 'booking_refunded' })).toBe(0);
  });

  it('the pending refund is visible in the queue, and settling it completes the money', async () => {
    await setTestMode(false);
    const b = await paidBooking();
    await cancelBooking(mkCtx({ user: playerUser, params: { id: String(b._id) }, body: {} }));

    const q = mkCtx({ user: adminUser, params: {}, query: {} });
    await listPendingRefunds(q);
    const queue = q._responses[0].payload.data;
    expect(queue).toHaveLength(1);
    expect(queue[0].refundAmount).toBe(428);
    expect(queue[0].venueName).toBe('Endings Test Venue');

    const paymentId = queue[0].id;
    const s = mkCtx({ user: adminUser, params: { id: paymentId }, body: { outcome: 'refunded', reference: 'GC-12345' } });
    await settleRefund(s);
    expect(s._responses[0].status).toBe(200);

    const p: any = await Payment.findById(paymentId).lean();
    expect(p.status).toBe('refunded');
    expect(p.refundedAt).toBeTruthy();
    expect(p.refundReference).toBe('GC-12345');

    await settle();
    const done: any = await Notification.findOne({ userId: playerId, type: 'booking_refunded' }).lean();
    expect(done).toBeTruthy();
    expect(done.title).toMatch(/completed/i);

    // Queue is empty once settled — that is what "no longer stuck" means.
    const q2 = mkCtx({ user: adminUser, params: {}, query: {} });
    await listPendingRefunds(q2);
    expect(q2._responses[0].payload.data).toHaveLength(0);
  });

  it('a failed payout returns the refund to the queue rather than swallowing it', async () => {
    await setTestMode(false);
    const b = await paidBooking();
    await cancelBooking(mkCtx({ user: playerUser, params: { id: String(b._id) }, body: {} }));
    const p: any = await Payment.findOne({ bookingId: b._id }).lean();

    const s = mkCtx({ user: adminUser, params: { id: String(p._id) }, body: { outcome: 'failed' } });
    await settleRefund(s);
    const after: any = await Payment.findById(p._id).lean();
    // Back to 'completed' — the charge stands, the refund is still owed and retryable.
    expect(after.status).toBe('completed');
    expect(after.refundedAt ?? null).toBeNull();
    expect(after.notes).toMatch(/FAILED/);
  });

  it('test mode still refunds instantly, and settling twice is rejected', async () => {
    const b = await paidBooking();
    const c = mkCtx({ user: playerUser, params: { id: String(b._id) }, body: {} });
    await cancelBooking(c);
    expect(c._responses[0].payload.data.refund.state).toBe('completed');

    const p: any = await Payment.findOne({ bookingId: b._id }).lean();
    expect(p.status).toBe('refunded');

    const s = mkCtx({ user: adminUser, params: { id: String(p._id) }, body: {} });
    await settleRefund(s);
    expect(s._responses[0].status).toBe(409);
    expect(s._responses[0].payload.error.code).toBe('NO_REFUND_PENDING');
    // Drain this test's own fire-and-forget notifications, or they land after the
    // next test's beforeEach cleanup and pollute its counts.
    await settle();
  });

  it('a booking with no payment behind it reports not_required, not a phantom refund', async () => {
    const b = await Booking.create({
      userId: playerId, venueId, date: ymd(10), startTime: '10:00', endTime: '11:00',
      amount: 400, status: 'pending_approval',
    });
    const c = mkCtx({ user: playerUser, params: { id: String(b._id) }, body: {} });
    await cancelBooking(c);
    expect(c._responses[0].payload.data.refund.state).toBe('not_required');
    await settle();
    // Scoped to THIS booking's refund tag — a bare type count would pick up a
    // late-landing notification from an earlier test's fire-and-forget IIFE.
    expect(await Notification.countDocuments({ tag: `refund-${String(b._id)}` })).toBe(0);
  });
});

/* ─── 3. Reschedule price delta ───────────────────────────────────── */

describe('ending 3 — reschedule price delta', () => {
  async function futureBooking(over: Record<string, any> = {}) {
    return Booking.create({
      userId: playerId, venueId, date: ymd(3), startTime: '08:00', endTime: '09:00',
      amount: 400, serviceFeeAmount: 28, amountPaid: 428, balanceDue: 0,
      status: 'confirmed', ...over,
    });
  }

  it('moving into a pricier slot charges the difference instead of silently absorbing it', async () => {
    const b = await futureBooking();
    // The venue surges 14:00–15:00 on the target day.
    await SlotPriceOverride.create({
      venueId, date: ymd(3), startTime: '14:00', endTime: '15:00', price: 700,
    });

    const c = mkCtx({
      user: playerUser, params: { id: String(b._id) },
      body: { startTime: '14:00', endTime: '15:00' },
    });
    await modifyBooking(c);
    expect(c._responses[0].status).toBe(200);

    const { priceDelta, amount, balanceDue } = c._responses[0].payload.data;
    expect(priceDelta).toBe(300);
    expect(amount).toBe(700);
    // 700 + 7% fee (49) = 749 payable, 428 already paid → 321 still owed.
    expect(balanceDue).toBe(321);

    const row: any = await Booking.findById(b._id).lean();
    expect(row.amount).toBe(700);
    expect(row.startTime).toBe('14:00');
    expect(row.rateSource).toBe('surge');

    // The audit log records the real delta — it used to always write 0.
    const mod: any = await BookingModification.findOne({ bookingId: String(b._id) }).lean();
    expect(mod.priceDelta).toBe(300);

    await settle();
    const notif: any = await Notification.findOne({ type: 'booking_reschedule_due' }).lean();
    expect(notif).toBeTruthy();
    expect(notif.body).toMatch(/300\.00 more/);
  });

  it('moving into a cheaper slot credits the difference back', async () => {
    // Start on a surged slot, move off it to the venue's base rate.
    await SlotPriceOverride.create({
      venueId, date: ymd(3), startTime: '08:00', endTime: '09:00', price: 700,
    });
    const b = await futureBooking({ amount: 700, serviceFeeAmount: 49, amountPaid: 749 });

    const c = mkCtx({
      user: playerUser, params: { id: String(b._id) },
      body: { startTime: '16:00', endTime: '17:00' },
    });
    await modifyBooking(c);

    const { priceDelta, amount, balanceDue } = c._responses[0].payload.data;
    expect(priceDelta).toBe(-300);
    expect(amount).toBe(400);
    // A negative balance is the venue owing the player back.
    expect(balanceDue).toBe(-321);

    const mod: any = await BookingModification.findOne({ bookingId: String(b._id) }).lean();
    expect(mod.priceDelta).toBe(-300);

    await settle();
    expect(await Notification.countDocuments({ type: 'booking_reschedule_credit' })).toBe(1);
  });

  it('a same-price move records a zero delta and says nothing about money', async () => {
    const b = await futureBooking();
    const c = mkCtx({
      user: playerUser, params: { id: String(b._id) },
      body: { startTime: '16:00', endTime: '17:00' },
    });
    await modifyBooking(c);
    expect(c._responses[0].payload.data.priceDelta).toBe(0);
    await settle();
    expect(await Notification.countDocuments({ type: /reschedule/ as any })).toBe(0);
  });

  it('a same-court time change no longer collides with itself', async () => {
    // Regression: findSlotConflict counted the very booking being moved, so on a
    // one-court venue every reschedule 409'd on its own occupancy.
    const b = await futureBooking();
    const c = mkCtx({
      user: playerUser, params: { id: String(b._id) },
      body: { startTime: '09:00', endTime: '10:00' },
    });
    await modifyBooking(c);
    expect(c._responses[0].status).toBe(200);
    const row: any = await Booking.findById(b._id).lean();
    expect(row.startTime).toBe('09:00');
  });
});

/* ─── 4. Walk-in ──────────────────────────────────────────────────── */

describe('ending 4 — walk-in', () => {
  it('refuses to file a manual booking at ₱0', async () => {
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId) },
      body: {
        bookingType: 'manual', date: ymd(1), startTime: '10:00', endTime: '11:00',
        customerName: 'Walk-in Wilma', bookingSource: 'walk_in', amount: 0,
      },
    });
    await createVenueBooking(c);
    expect(c._responses[0].status).toBe(400);
    expect(c._responses[0].payload.error.code).toBe('AMOUNT_REQUIRED');
    expect(await Booking.countDocuments({ bookingType: 'manual' })).toBe(0);
  });

  it('files a walk-in at the amount actually collected', async () => {
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId) },
      body: {
        bookingType: 'manual', date: ymd(1), startTime: '10:00', endTime: '11:00',
        customerName: 'Walk-in Wilma', bookingSource: 'walk_in', amount: 500,
      },
    });
    await createVenueBooking(c);
    expect(c._responses[0].status).toBe(201);
    const row: any = await Booking.findOne({ bookingType: 'manual' }).lean();
    expect(row.amount).toBe(500);
    expect(row.bookingSource).toBe('walk_in');
  });

  it('falls back to the venue rate when the front desk leaves the amount blank', async () => {
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId) },
      body: {
        bookingType: 'manual', date: ymd(1), startTime: '12:00', endTime: '13:00',
        customerName: 'Phone Pat', bookingSource: 'phone',
      },
    });
    await createVenueBooking(c);
    expect(c._responses[0].status).toBe(201);
    // The venue's priceFrom (400) resolved it — never ₱0.
    const row: any = await Booking.findOne({ customerName: 'Phone Pat' }).lean();
    expect(row.amount).toBe(400);
  });

  it('still allows a blocked slot to be ₱0 — that is what blocking is for', async () => {
    const c = mkCtx({
      user: ownerUser, params: { id: String(venueId) },
      body: {
        bookingType: 'blocked', date: ymd(1), startTime: '14:00', endTime: '15:00',
        blockReason: 'Maintenance',
      },
    });
    await createVenueBooking(c);
    expect(c._responses[0].status).toBe(201);
    const row: any = await Booking.findOne({ bookingType: 'blocked' }).lean();
    expect(row.amount).toBe(0);
  });
});
