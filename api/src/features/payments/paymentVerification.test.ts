// Integration coverage for the launch manual-GCash completion primitive.
// These tests drive the real controllers against Mongo so authorization,
// booking activation, and partner-subscription activation stay one contract.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../auth/auth.model.js';
import { Booking } from '../bookings/bookings.model.js';
import {
  PartnerSubscription,
  hasActivePartnerSubscription,
} from '../partner-subscriptions/partner-subscriptions.model.js';
import { subscribe } from '../partner-subscriptions/partner-subscriptions.controller.js';
import { AppSettings } from '../settings/settings.model.js';
import { Venue } from '../venues/venues.model.js';
import { OfficialReceipt, Payment, SettlementLineItem } from './payments.model.js';
import { generateSettlement, getOwnerBalance, verifyPayment } from './payments.controller.js';

let mongod: MongoMemoryServer;

function mkCtx(opts: { user: any; params?: Record<string, string>; body?: any }) {
  const responses: Array<{ payload: any; status: number }> = [];
  return {
    _responses: responses,
    req: {
      param: (name: string) => opts.params?.[name],
      json: async () => opts.body ?? {},
    },
    get: (key: string) => (key === 'user' ? opts.user : undefined),
    json: (payload: any, status = 200) => {
      responses.push({ payload, status });
      return { payload, status };
    },
  } as any;
}

const future = () => new Date(Date.now() + 3_600_000);
const past = () => new Date(Date.now() - 3_600_000);

async function makeUser(email: string) {
  return User.create({
    email,
    displayName: email.split('@')[0],
    roleDefault: 'player',
    address1: '1 Test Street',
    city: 'Manila',
    province: 'Metro Manila',
    zipcode: '1000',
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Venue.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    OfficialReceipt.deleteMany({}),
    SettlementLineItem.deleteMany({}),
    PartnerSubscription.deleteMany({}),
    AppSettings.deleteMany({}),
  ]);
});

describe('partner subscription payment gating', () => {
  it('live mode creates a pending GCash payment and grants no partner access', async () => {
    const player = await makeUser('pending@example.com');
    await AppSettings.create({ key: 'global', paymentTestMode: false, partnerSubscriptionDays: 30 });

    const c = mkCtx({
      user: { sub: String(player._id) },
      body: { plan: 'coach' },
    });
    await subscribe(c);

    expect(c._responses[0]?.status).toBe(201);
    const sub: any = await PartnerSubscription.findOne({ userId: player._id }).lean();
    const payment: any = await Payment.findOne({ subscriptionId: sub._id }).lean();
    expect(sub.status).toBe('pending');
    expect(sub.startedAt).toBeUndefined();
    expect(sub.expiresAt).toBeUndefined();
    expect(payment).toMatchObject({ status: 'pending', method: 'gcash', provider: 'manual' });
    expect(await hasActivePartnerSubscription(player._id, 'coach')).toBe(false);

    const retry = mkCtx({ user: { sub: String(player._id) }, body: { plan: 'coach' } });
    await subscribe(retry);
    expect(retry._responses[0]).toMatchObject({
      status: 409,
      payload: { error: { code: 'PAYMENT_PENDING' } },
    });
  });

  it('test mode still completes and activates immediately', async () => {
    const player = await makeUser('testmode@example.com');
    await AppSettings.create({ key: 'global', paymentTestMode: true, partnerSubscriptionDays: 30 });

    const c = mkCtx({
      user: { sub: String(player._id) },
      body: { plan: 'organizer', card: { number: '4242 4242 4242 4242' } },
    });
    await subscribe(c);

    const sub: any = await PartnerSubscription.findOne({ userId: player._id }).lean();
    const payment: any = await Payment.findOne({ subscriptionId: sub._id }).lean();
    expect(c._responses[0]?.status).toBe(201);
    expect(sub.status).toBe('active');
    expect(sub.startedAt).toBeTruthy();
    expect(sub.expiresAt).toBeTruthy();
    expect(payment.status).toBe('completed');
    expect(await hasActivePartnerSubscription(player._id, 'organizer')).toBe(true);
  });

  it('only an admin can activate a pending platform subscription', async () => {
    const player = await makeUser('activate@example.com');
    await AppSettings.create({ key: 'global', paymentTestMode: false, partnerSubscriptionDays: 45 });
    const sub = await PartnerSubscription.create({
      userId: player._id,
      plan: 'coach',
      status: 'pending',
      priceAmount: 499,
      currency: 'PHP',
    });
    const payment = await Payment.create({
      userId: player._id,
      purpose: 'partner_subscription',
      subscriptionId: sub._id,
      amount: 499,
      status: 'pending',
      method: 'gcash',
      provider: 'manual',
    });

    const ownerAttempt = mkCtx({
      user: { sub: String(new Types.ObjectId()), permissions: ['owner.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed' },
    });
    await verifyPayment(ownerAttempt);
    expect(ownerAttempt._responses[0]?.status).toBe(403);
    expect((await PartnerSubscription.findById(sub._id).lean())?.status).toBe('pending');

    const adminAttempt = mkCtx({
      user: { sub: String(new Types.ObjectId()), permissions: ['admin.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed' },
    });
    await verifyPayment(adminAttempt);

    const activated: any = await PartnerSubscription.findById(sub._id).lean();
    expect(adminAttempt._responses[0]?.status).toBe(200);
    expect(activated.status).toBe('active');
    expect(activated.startedAt).toBeTruthy();
    expect(activated.expiresAt.getTime() - activated.startedAt.getTime())
      .toBe(45 * 24 * 60 * 60 * 1000);
  });

  it('keeps the selected tier duration when a live GCash payment is confirmed later', async () => {
    const player = await makeUser('tiered@example.com');
    await AppSettings.create({
      key: 'global',
      paymentTestMode: false,
      partnerSubscriptionDays: 30,
      coachPlanTiers: [{ key: 'quarterly', label: 'Quarterly', durationDays: 90, price: 1200, enabled: true }],
    });

    const subscribeAttempt = mkCtx({
      user: { sub: String(player._id) },
      body: { plan: 'coach', tierKey: 'quarterly' },
    });
    await subscribe(subscribeAttempt);

    const pending: any = await PartnerSubscription.findOne({ userId: player._id }).lean();
    const payment: any = await Payment.findOne({ subscriptionId: pending._id }).lean();
    expect(pending).toMatchObject({ status: 'pending', tierKey: 'quarterly', durationDays: 90, priceAmount: 1200 });

    // A later admin edit must not rewrite the term the player already selected.
    await AppSettings.updateOne({ key: 'global' }, { partnerSubscriptionDays: 7, coachPlanTiers: [] });
    const adminAttempt = mkCtx({
      user: { sub: String(new Types.ObjectId()), permissions: ['admin.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed' },
    });
    await verifyPayment(adminAttempt);

    const activated: any = await PartnerSubscription.findById(pending._id).lean();
    expect(adminAttempt._responses[0]?.status).toBe(200);
    expect(activated.status).toBe('active');
    expect(activated.expiresAt.getTime() - activated.startedAt.getTime())
      .toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe('owner booking payment verification', () => {
  async function makeBookingPayment(ownerId: Types.ObjectId, paymentDueAt = future()) {
    const playerId = new Types.ObjectId();
    const venue = await Venue.create({
      displayName: `Venue ${ownerId}`,
      slug: `venue-${ownerId}`,
      state: 'active',
      ownerUserId: ownerId,
    });
    const booking = await Booking.create({
      userId: playerId,
      venueId: venue._id,
      date: '2026-08-01',
      startTime: '10:00',
      endTime: '11:00',
      amount: 400,
      status: 'awaiting_payment',
      paymentDueAt,
    });
    const payment = await Payment.create({
      userId: playerId,
      bookingId: booking._id,
      purpose: 'booking',
      amount: 428,
      status: 'pending',
      method: 'gcash',
      provider: 'manual',
    });
    return { venue, booking, payment };
  }

  it('an owner marks a pending GCash payment paid only for their venue', async () => {
    const ownerId = new Types.ObjectId();
    const { booking, payment } = await makeBookingPayment(ownerId);

    const c = mkCtx({
      user: { sub: String(ownerId), permissions: ['owner.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed', notes: 'GCash received' },
    });
    await verifyPayment(c);

    expect(c._responses[0]?.status).toBe(200);
    expect((await Payment.findById(payment._id).lean())?.status).toBe('completed');
    expect(await Booking.findById(booking._id).lean()).toMatchObject({
      status: 'confirmed',
      paymentMethod: 'gcash',
    });
  });

  it('rejects a different owner and leaves both records pending', async () => {
    const { booking, payment } = await makeBookingPayment(new Types.ObjectId());
    const c = mkCtx({
      user: { sub: String(new Types.ObjectId()), permissions: ['owner.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed' },
    });
    await verifyPayment(c);

    expect(c._responses[0]?.status).toBe(403);
    expect((await Payment.findById(payment._id).lean())?.status).toBe('pending');
    expect((await Booking.findById(booking._id).lean())?.status).toBe('awaiting_payment');
  });

  it('does not resurrect an expired payment hold', async () => {
    const ownerId = new Types.ObjectId();
    const { booking, payment } = await makeBookingPayment(ownerId, past());
    const c = mkCtx({
      user: { sub: String(ownerId), permissions: ['owner.bookings.manage'] },
      params: { id: String(payment._id) },
      body: { status: 'completed' },
    });
    await verifyPayment(c);

    expect(c._responses[0]).toMatchObject({
      status: 409,
      payload: { error: { code: 'PAYMENT_EXPIRED' } },
    });
    expect((await Payment.findById(payment._id).lean())?.status).toBe('pending');
    expect(await Booking.findById(booking._id).lean()).toMatchObject({
      status: 'cancelled',
      cancellationType: 'system_expired',
    });
  });
});

describe('owner unsettled balance', () => {
  it('returns per-venue rows and excludes bookings already in a settlement', async () => {
    const ownerId = new Types.ObjectId();
    const playerId = new Types.ObjectId();
    const [venueA, venueB, otherVenue] = await Venue.create([
      { displayName: 'Alpha Courts', slug: 'alpha-courts', state: 'active', ownerUserId: ownerId },
      { displayName: 'Bravo Courts', slug: 'bravo-courts', state: 'active', ownerUserId: ownerId },
      { displayName: 'Other Courts', slug: 'other-courts', state: 'active', ownerUserId: new Types.ObjectId() },
    ]);
    const base = { userId: playerId, date: '2026-08-01', startTime: '10:00', endTime: '11:00', status: 'confirmed' };
    const [unsettledA, alreadySettled] = await Booking.create([
      { ...base, venueId: venueA!._id, amount: 400, serviceFeeAmount: 28 },
      { ...base, venueId: venueA!._id, amount: 100, serviceFeeAmount: 7, startTime: '11:00', endTime: '12:00' },
      { ...base, venueId: venueB!._id, amount: 300, serviceFeeAmount: 21 },
      { ...base, venueId: otherVenue!._id, amount: 999, serviceFeeAmount: 69.93 },
      { ...base, venueId: venueA!._id, amount: 500, serviceFeeAmount: 35, bookingType: 'manual' },
    ]);
    await SettlementLineItem.create({
      settlementId: new Types.ObjectId(),
      bookingId: alreadySettled!._id,
      amount: 100,
      serviceFee: 7,
    });

    const c = mkCtx({ user: { sub: String(ownerId) } });
    await getOwnerBalance(c);
    const rows = c._responses[0]?.payload.data as any[];
    const byVenue = new Map(rows.map((r) => [r.venueName, r]));

    expect(c._responses[0]?.status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(byVenue.get('Alpha Courts')).toMatchObject({
      unsenttledRevenue: 400,
      unsenttledFees: 28,
      unsenttledNet: 372,
      bookingCount: 1,
    });
    expect(byVenue.get('Bravo Courts')).toMatchObject({
      unsenttledRevenue: 300,
      unsenttledFees: 21,
      unsenttledNet: 279,
      bookingCount: 1,
    });
    expect(unsettledA._id).toBeTruthy();
  });

  it('does not pay a booking that is already attached to another settlement', async () => {
    const ownerId = new Types.ObjectId();
    const playerId = new Types.ObjectId();
    const venue = await Venue.create({
      displayName: 'Settlement Courts',
      slug: 'settlement-courts',
      state: 'active',
      ownerUserId: ownerId,
    });
    const [unsettled, alreadySettled] = await Booking.create([
      {
        userId: playerId,
        venueId: venue._id,
        date: '2026-08-01',
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmed',
        amount: 400,
        serviceFeeAmount: 28,
      },
      {
        userId: playerId,
        venueId: venue._id,
        date: '2026-08-02',
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmed',
        amount: 100,
        serviceFeeAmount: 7,
      },
    ]);
    await SettlementLineItem.create({
      settlementId: new Types.ObjectId(),
      bookingId: alreadySettled!._id,
      amount: 100,
      serviceFee: 7,
    });

    const c = mkCtx({
      user: { sub: String(new Types.ObjectId()), permissions: ['admin.bookings.manage'] },
      body: {
        venueId: String(venue._id),
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      },
    });
    await generateSettlement(c);

    expect(c._responses[0]).toMatchObject({
      status: 201,
      payload: { data: { netPayout: 372, totalBookings: 1 } },
    });
    const createdItems = await SettlementLineItem.find({ bookingId: unsettled!._id }).lean();
    expect(createdItems).toHaveLength(1);
  });
});
