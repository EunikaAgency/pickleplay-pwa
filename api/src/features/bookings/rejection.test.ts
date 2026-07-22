// Integration tests for the rejection-vs-cancellation discriminator
// (`Booking.cancellationType`), against real Mongo (mongodb-memory-server).
//
// Drives the actual controller handlers with a mock Hono context, so it proves
// the wired behaviour — not just the model shape:
//   1. owner declines a pending_approval request  → cancelled + owner_rejected + booking_rejected notification + slot freed
//   2. owner cancels a confirmed booking           → cancelled + owner_removed
//   3. player self-cancels                          → cancelled + player_cancelled
//   4. getVenueAnalytics splits declined vs cancelled
//   5. a declined booking no longer occupies its slot (blockingFilter)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Booking } from './bookings.model.js';
import { blockingFilter } from './bookingDeadlines.js';
import { Venue } from '../venues/venues.model.js';
import { Notification } from '../interactions/interactions.model.js';
import { updateBookingStatus, getVenueAnalytics } from '../venues/venues.controller.js';
import { cancelBooking } from './bookings.controller.js';

let mongod: MongoMemoryServer;

const ownerId = new Types.ObjectId();
const playerId = new Types.ObjectId();
let venueId: Types.ObjectId;

// Local YYYY-MM-DD (matches how bookings store their date + the analytics window).
function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A mock Hono context: enough surface for these handlers (param/query/json/get).
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

// An owner user that passes requireVenueManager (admin.venues.manage → 'owner').
const ownerUser = { sub: String(ownerId), permissions: ['admin.venues.manage'] };

async function makeBooking(over: Record<string, any> = {}) {
  return Booking.create({
    userId: playerId, venueId, date: todayYMD(), startTime: '10:00', endTime: '11:00',
    amount: 400, status: 'pending_approval', ...over,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const venue = await Venue.create({
    displayName: 'Test Venue', slug: 'test-venue', state: 'active',
    ownerUserId: ownerId, bookingPayWindowHours: 24,
  });
  venueId = venue._id as Types.ObjectId;
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await Notification.deleteMany({});
});

describe('booking rejection vs cancellation', () => {
  it('owner declining a pending request → cancelled + owner_rejected + notifies the player', async () => {
    const b = await makeBooking({ startTime: '10:00', endTime: '11:00' });
    const c = mkCtx({
      user: ownerUser,
      params: { id: String(venueId), bookingId: String(b._id) },
      body: { status: 'cancelled', cancellationReason: 'Fully booked' },
    });
    await updateBookingStatus(c);

    const row: any = await Booking.findById(b._id).lean();
    expect(row.status).toBe('cancelled');
    expect(row.cancellationType).toBe('owner_rejected');
    expect(row.cancelledAt).toBeTruthy();

    // The player was told (this is the "players are never told" half).
    const notif: any = await Notification.findOne({ userId: playerId, type: 'booking_rejected' }).lean();
    expect(notif).toBeTruthy();
    expect(notif.title).toMatch(/declined/i);
  });

  it('a declined booking no longer occupies its slot', async () => {
    const b = await makeBooking({ startTime: '14:00', endTime: '15:00' });
    // Occupied while pending.
    expect(await Booking.countDocuments({ _id: b._id, ...blockingFilter() })).toBe(1);
    await updateBookingStatus(mkCtx({
      user: ownerUser, params: { id: String(venueId), bookingId: String(b._id) },
      body: { status: 'cancelled', cancellationReason: 'no' },
    }));
    // Freed after the decline.
    expect(await Booking.countDocuments({ _id: b._id, ...blockingFilter() })).toBe(0);
  });

  it('owner cancelling an already-confirmed booking → owner_removed (not a rejection)', async () => {
    const b = await makeBooking({ status: 'confirmed', startTime: '16:00', endTime: '17:00' });
    await updateBookingStatus(mkCtx({
      user: ownerUser, params: { id: String(venueId), bookingId: String(b._id) },
      body: { status: 'cancelled' },
    }));
    const row: any = await Booking.findById(b._id).lean();
    expect(row.status).toBe('cancelled');
    expect(row.cancellationType).toBe('owner_removed');
    // A confirmed cancel is NOT a rejection → no booking_rejected notification.
    expect(await Notification.countDocuments({ type: 'booking_rejected' })).toBe(0);
  });

  it('player self-cancel → player_cancelled', async () => {
    const b = await makeBooking({ status: 'confirmed', startTime: '18:00', endTime: '19:00' });
    await cancelBooking(mkCtx({
      user: { sub: String(playerId) },
      params: { id: String(b._id) },
      body: { cancellationReason: 'Changed my mind' },
    }));
    const row: any = await Booking.findById(b._id).lean();
    expect(row.status).toBe('cancelled');
    expect(row.cancellationType).toBe('player_cancelled');
  });

  it('analytics reports declined apart from cancelled', async () => {
    // 2 owner rejections + 1 player cancellation, all today (in the analytics window).
    await makeBooking({ status: 'cancelled', cancellationType: 'owner_rejected', startTime: '08:00', endTime: '09:00' });
    await makeBooking({ status: 'cancelled', cancellationType: 'owner_rejected', startTime: '09:00', endTime: '10:00' });
    await makeBooking({ status: 'cancelled', cancellationType: 'player_cancelled', startTime: '10:00', endTime: '11:00' });

    const c = mkCtx({ user: ownerUser, params: { id: String(venueId) }, query: {} });
    await getVenueAnalytics(c);
    const { payload } = c._responses[0];
    expect(payload.data.kpis.bookings.declined).toBe(2);
    expect(payload.data.kpis.bookings.cancelled).toBe(1);
    // The daily series also carries the split.
    const todayRow = payload.data.bookingsDaily.find((r: any) => r.date === todayYMD());
    expect(todayRow.declined).toBe(2);
    expect(todayRow.cancelled).toBe(1);
  });
});
