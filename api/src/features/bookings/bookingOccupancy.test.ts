// Integration tests for the deadline-aware occupancy query, against real Mongo.
//
// This is the one piece of PB-04 that unit tests can't prove. `blockingFilter`
// returns a plain object, so a unit test can only assert its *shape* — whether
// Mongo actually treats a missing `approvalDeadline` as "not less than now" is a
// property of Mongo's type-bracketing rules, not of our code. The whole design
// rests on that behaviour (it's what stops legacy rows silently losing their
// slots), so it gets asserted against a real server.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Booking } from './bookings.model.js';
import { blockingFilter } from './bookingDeadlines.js';

let mongod: MongoMemoryServer;

const venueId = new Types.ObjectId();
const courtId = new Types.ObjectId();
const userId = new Types.ObjectId();

const HOUR = 3_600_000;
const past = () => new Date(Date.now() - HOUR);
const future = () => new Date(Date.now() + HOUR);

/** A booking with only the fields occupancy cares about. */
const make = (over: Record<string, any> = {}) => ({
  userId, venueId, courtId, date: '2026-08-01',
  startTime: '10:00', endTime: '11:00', amount: 400,
  ...over,
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
});

/** The occupancy set for the shared slot, as the conflict checks compute it. */
const blocking = () => Booking.find({ venueId, date: '2026-08-01', ...blockingFilter(new Date()) }).lean();

describe('blockingFilter against real Mongo', () => {
  it('a live request still holds its slot', async () => {
    await Booking.create(make({ status: 'pending_approval', approvalDeadline: future() }));
    expect(await blocking()).toHaveLength(1);
  });

  it('a lapsed request releases its slot with no sweeper run', async () => {
    await Booking.create(make({ status: 'pending_approval', approvalDeadline: past() }));
    // Nothing has rewritten `status` — the row is still 'pending_approval' —
    // and the slot is already free. That is the entire point of PB-04's design.
    expect(await blocking()).toHaveLength(0);
    const row = await Booking.findOne({ venueId }).lean();
    expect(row?.status).toBe('pending_approval');
  });

  // The regression that would quietly destroy real bookings: rows created before
  // approvalDeadline existed have no such field, and must keep blocking.
  it('a legacy row with no approvalDeadline keeps blocking', async () => {
    await Booking.collection.insertOne({
      userId, venueId, courtId, date: '2026-08-01',
      startTime: '10:00', endTime: '11:00', amount: 400,
      status: 'pending_approval',
    } as any);
    expect(await blocking()).toHaveLength(1);
  });

  it('an explicitly null deadline also keeps blocking', async () => {
    await Booking.create(make({ status: 'pending_approval', approvalDeadline: null }));
    expect(await blocking()).toHaveLength(1);
  });

  it('an overdue awaiting_payment hold releases its slot', async () => {
    await Booking.create(make({ status: 'awaiting_payment', paymentDueAt: past() }));
    expect(await blocking()).toHaveLength(0);
  });

  it('an in-window awaiting_payment hold still blocks', async () => {
    await Booking.create(make({ status: 'awaiting_payment', paymentDueAt: future() }));
    expect(await blocking()).toHaveLength(1);
  });

  it('a cancelled booking never blocks', async () => {
    await Booking.create(make({ status: 'cancelled', approvalDeadline: future() }));
    expect(await blocking()).toHaveLength(0);
  });

  it('a confirmed booking blocks regardless of any stale deadline', async () => {
    await Booking.create(make({ status: 'confirmed', approvalDeadline: past() }));
    expect(await blocking()).toHaveLength(1);
  });

  it('separates live from lapsed in one mixed query', async () => {
    await Booking.create([
      make({ status: 'pending_approval', approvalDeadline: future(), startTime: '08:00', endTime: '09:00' }),
      make({ status: 'pending_approval', approvalDeadline: past(), startTime: '09:00', endTime: '10:00' }),
      make({ status: 'confirmed', startTime: '11:00', endTime: '12:00' }),
      make({ status: 'cancelled', startTime: '12:00', endTime: '13:00' }),
      make({ status: 'awaiting_payment', paymentDueAt: past(), startTime: '13:00', endTime: '14:00' }),
    ]);
    const rows = await blocking();
    expect(rows.map((r: any) => r.startTime).sort()).toEqual(['08:00', '11:00']);
  });
});

describe('the claim-before-notify idiom', () => {
  // How cancelExpired and the reminder pass stay exactly-once across a lazy read,
  // a sweeper tick, and a second API instance all racing the same row.
  it('lets exactly one concurrent claimant win', async () => {
    const b = await Booking.create(make({ status: 'pending_approval', approvalDeadline: past() }));

    const claim = () => Booking.findOneAndUpdate(
      { _id: b._id, status: 'pending_approval' },
      { status: 'cancelled', cancellationReason: 'Owner did not respond in time', cancelledAt: new Date() },
      { new: true },
    ).lean();

    const results = await Promise.all([claim(), claim(), claim(), claim()]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('sends each reminder threshold at most once', async () => {
    const b = await Booking.create(make({ status: 'pending_approval', approvalDeadline: future() }));

    const claim = (mark: string) => Booking.findOneAndUpdate(
      { _id: b._id, status: 'pending_approval', remindersSent: { $ne: mark } },
      { $addToSet: { remindersSent: mark } },
      { new: true },
    ).lean();

    expect((await Promise.all([claim('50'), claim('50'), claim('50')])).filter(Boolean)).toHaveLength(1);
    // A different threshold is a separate claim and still gets through.
    expect(await claim('80')).toBeTruthy();
    expect(await claim('80')).toBeNull();

    const row = await Booking.findById(b._id).lean();
    expect((row as any).remindersSent.sort()).toEqual(['50', '80']);
  });
});
