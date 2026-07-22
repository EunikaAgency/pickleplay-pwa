// Integration coverage for the launch Senior Citizen/PWD pricing contract.
// The controllers run against real Mongo so client-tampering, booking audit
// fields, checkout amount, and the VAT-exempt receipt stay one server contract.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createBooking } from './bookings.controller.js';
import { Booking } from './bookings.model.js';
import { checkout, generateReceiptForBooking, generateSettlement } from '../payments/payments.controller.js';
import { OfficialReceipt, Payment, ReceiptCounter, Settlement, SettlementLineItem } from '../payments/payments.model.js';
import { AppSettings } from '../settings/settings.model.js';
import { Venue, VenueHour, SlotPriceOverride } from '../venues/venues.model.js';
import { createVenueBooking } from '../venues/venues.controller.js';

let mongod: MongoMemoryServer;

function ctx(opts: { user: any; body?: any; params?: Record<string, string> }) {
  const responses: Array<{ payload: any; status: number }> = [];
  return {
    _responses: responses,
    req: {
      json: async () => opts.body ?? {},
      param: (name: string) => opts.params?.[name],
    },
    get: (key: string) => (key === 'user' ? opts.user : undefined),
    json: (payload: any, status = 200) => {
      responses.push({ payload, status });
      return { payload, status };
    },
  } as any;
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
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    OfficialReceipt.deleteMany({}),
    ReceiptCounter.deleteMany({}),
    Settlement.deleteMany({}),
    SettlementLineItem.deleteMany({}),
    Venue.deleteMany({}),
    VenueHour.deleteMany({}),
    SlotPriceOverride.deleteMany({}),
    AppSettings.deleteMany({}),
  ]);
  await AppSettings.create({ key: 'global', paymentTestMode: true, serviceFeePercent: 7 });
});

async function makeVenue(overrides: Record<string, unknown> = {}) {
  return Venue.create({
    displayName: 'Statutory Courts',
    slug: `statutory-courts-${new Types.ObjectId()}`,
    state: 'active',
    priceFrom: 500,
    ...overrides,
  });
}

describe('server-authoritative statutory discount', () => {
  it('uses the locked 20% fallback for an existing venue and fees the original subtotal', async () => {
    const venue = await makeVenue();
    // Simulate an old document where the new config field truly does not exist.
    await Venue.collection.updateOne({ _id: venue._id }, { $unset: { statutoryDiscounts: '' } });
    const playerId = new Types.ObjectId();
    const c = ctx({
      user: { sub: String(playerId), email: null },
      body: {
        venueId: String(venue._id),
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '11:00',
        amount: 400,
        customerCategory: 'senior',
        discountIdNumber: 'SC-12345',
        paymentOption: 'full',
        // Tampered values must be ignored.
        serviceFeeAmount: 0,
        amountPaid: 1,
        balanceDue: 999,
      },
    });

    await createBooking(c);
    expect(c._responses[0]?.status).toBe(201);
    const booking = await Booking.findById(c._responses[0]?.payload.data.id).lean<any>();
    expect(booking).toMatchObject({
      amount: 400,
      preDiscountSubtotal: 500,
      discountPercent: 20,
      discountAmount: 100,
      customerCategory: 'senior',
      discountIdNumber: 'SC-12345',
      serviceFeeAmount: 35,
      amountPaid: 435,
      balanceDue: 0,
    });

    const paymentCtx = ctx({
      user: { sub: String(playerId) },
      body: { bookingId: String(booking._id), amount: 1, currency: 'PHP', method: 'test_card' },
    });
    await checkout(paymentCtx);
    const payment = await Payment.findOne({ bookingId: booking._id }).lean<any>();
    expect(payment?.amount).toBe(435);

    await generateReceiptForBooking(String(booking._id));
    const receipt = await OfficialReceipt.findOne({ bookingId: booking._id }).lean<any>();
    expect(receipt).toMatchObject({
      amount: 435,
      discountAmount: 100,
      discountCategory: 'senior',
      discountIdNumber: 'SC-12345',
      vatExempt: true,
      vatRate: 0,
      vatAmount: 0,
      netAmount: 435,
    });
  });

  it('honours a configured PWD rate', async () => {
    const venue = await makeVenue({
      statutoryDiscounts: [
        { category: 'senior', percent: 20 },
        { category: 'pwd', percent: 25 },
      ],
    });
    const c = ctx({
      user: { sub: String(new Types.ObjectId()), email: null },
      body: {
        venueId: String(venue._id),
        date: '2026-12-02',
        startTime: '10:00',
        endTime: '11:00',
        amount: 375,
        customerCategory: 'pwd',
        discountIdNumber: 'PWD-9876',
        paymentOption: 'full',
      },
    });

    await createBooking(c);
    const booking = await Booking.findById(c._responses[0]?.payload.data.id).lean<any>();
    expect(booking).toMatchObject({
      amount: 375,
      preDiscountSubtotal: 500,
      discountPercent: 25,
      discountAmount: 125,
      serviceFeeAmount: 35,
      amountPaid: 410,
    });
  });

  it('requires the statutory ID number', async () => {
    const venue = await makeVenue();
    const c = ctx({
      user: { sub: String(new Types.ObjectId()) },
      body: {
        venueId: String(venue._id),
        date: '2026-12-03',
        startTime: '10:00',
        endTime: '11:00',
        amount: 400,
        customerCategory: 'senior',
      },
    });

    await expect(createBooking(c)).rejects.toThrow(/ID number is required/i);
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('does not accept checkout without a server-priced booking', async () => {
    const c = ctx({
      user: { sub: String(new Types.ObjectId()) },
      body: { amount: 1, currency: 'PHP', method: 'test_card' },
    });
    await expect(checkout(c)).rejects.toThrow();
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('records a discounted VAT-exempt receipt for a staff walk-in', async () => {
    const ownerId = new Types.ObjectId();
    const venue = await makeVenue({ ownerUserId: ownerId });
    const c = ctx({
      user: { sub: String(ownerId), permissions: ['owner.venues.manage'] },
      params: { id: String(venue._id) },
      body: {
        bookingType: 'manual',
        date: '2026-12-04',
        startTime: '10:00',
        endTime: '11:00',
        customerName: 'Maria Santos',
        amount: 500,
        customerCategory: 'pwd',
        discountIdNumber: 'PWD-WALKIN-1',
        paymentMethod: 'cash',
      },
    });

    await createVenueBooking(c);
    expect(c._responses[0]?.status).toBe(201);
    const booking = await Booking.findById(c._responses[0]?.payload.data.id).lean<any>();
    expect(booking).toMatchObject({
      bookingType: 'manual',
      amount: 400,
      preDiscountSubtotal: 500,
      discountAmount: 100,
      customerCategory: 'pwd',
      discountIdNumber: 'PWD-WALKIN-1',
    });
    const receipt = await OfficialReceipt.findOne({ bookingId: booking._id }).lean<any>();
    expect(receipt).toMatchObject({
      payorName: 'Maria Santos',
      amount: 400,
      discountAmount: 100,
      discountCategory: 'pwd',
      discountIdNumber: 'PWD-WALKIN-1',
      vatExempt: true,
      vatAmount: 0,
    });
  });

  it('settles discounted revenue with the fee from the original subtotal', async () => {
    const ownerId = new Types.ObjectId();
    const venue = await makeVenue({ ownerUserId: ownerId });
    const booking = await Booking.create({
      userId: new Types.ObjectId(),
      venueId: venue._id,
      date: '2026-12-05',
      startTime: '10:00',
      endTime: '11:00',
      status: 'confirmed',
      amount: 400,
      preDiscountSubtotal: 500,
      serviceFeeAmount: 35,
      customerCategory: 'senior',
      discountPercent: 20,
      discountAmount: 100,
      discountIdNumber: 'SC-SETTLE-1',
    });
    const c = ctx({
      user: { sub: String(new Types.ObjectId()), permissions: ['admin.bookings.manage'] },
      body: {
        venueId: String(venue._id),
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
      },
    });

    await generateSettlement(c);
    expect(c._responses[0]).toMatchObject({
      status: 201,
      payload: { data: { totalBookings: 1, netPayout: 365 } },
    });
    expect(await SettlementLineItem.findOne({ bookingId: booking._id }).lean()).toMatchObject({
      amount: 400,
      serviceFee: 35,
      discountAmount: 100,
    });
  });
});
