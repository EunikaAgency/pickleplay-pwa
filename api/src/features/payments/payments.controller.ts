import { z } from 'zod';
import { Payment, OfficialReceipt, ReceiptCounter, Settlement, SettlementLineItem, OwnerPayoutMethod } from './payments.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { isBlocking } from '../bookings/bookingDeadlines.js';
import { expireOverdueBookings } from '../bookings/bookings.controller.js';
import { Venue } from '../venues/venues.model.js';
import { PartnerSubscription } from '../partner-subscriptions/partner-subscriptions.model.js';
import { getPartnerSubscriptionPricing } from '../settings/settings.controller.js';
import { effectiveOwnerId, hasPermission } from '../../shared/lib/permissions.js';
import { sendEmail, isGmailConfigured, hasValidTokens } from '../../shared/lib/gmail.js';
import { paymentReceipt } from '../../shared/lib/email-templates.js';

const canEmail = () => isGmailConfigured() && hasValidTokens();
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtTime2 = (t?: string | null) => { if (!t) return ''; const [h, m] = t!.split(':'); const hr = +h; const a = hr < 12 ? 'AM' : 'PM'; const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr; return `${h12}:${m} ${a}`; };
import { isPaymentTestMode } from '../settings/settings.controller.js';

const createSchema = z.object({
  bookingId: z.string().optional(),
  amount: z.string().or(z.number()),
  currency: z.string().length(3).optional().default('PHP'),
  method: z.string().max(50).optional(),
  provider: z.string().max(50).optional(),
  providerRef: z.string().max(255).optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  method: z.string().max(50).optional(),
  provider: z.string().max(50).optional(),
  providerRef: z.string().max(255).optional(),
  proofUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const verifySchema = z.object({
  status: z.enum(['completed', 'failed', 'refunded']),
  notes: z.string().optional(),
});

// Self-serve checkout. Card fields are accepted so the client form can post
// them, but they are never stored or charged — in test mode the payment is
// completed immediately; live mode just records a pending payment (no gateway
// is wired yet).
const checkoutSchema = z.object({
  bookingId: z.string().optional(),
  amount: z.string().or(z.number()),
  currency: z.string().length(3).optional().default('PHP'),
  method: z.string().max(50).optional(),
  card: z.object({ number: z.string(), expiry: z.string(), cvc: z.string() }).partial().optional(),
});

export async function listPayments(c: any) {
  const user = c.get('user');
  const status = c.req.query('status');
  const filter: Record<string, any> = { userId: user.sub };
  if (status) filter.status = status;
  const rows = await Payment.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function createPayment(c: any) {
  const user = c.get('user');
  const body = createSchema.parse(await c.req.json());
  const result = await Payment.create({
    bookingId: body.bookingId || null, userId: user.sub,
    amount: typeof body.amount === 'number' ? body.amount : parseFloat(body.amount),
    currency: body.currency, method: body.method || null, provider: body.provider || null,
    providerRef: body.providerRef || null, notes: body.notes || null, status: 'pending',
  });
  return c.json({ data: result.toObject() }, 201);
}

export async function getPayment(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await Payment.findOne({ _id: id, userId: user.sub }).lean();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  return c.json({ data: { ...row, id: row._id } });
}

export async function updatePayment(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = updateSchema.parse(await c.req.json());
  const existing = await Payment.findOne({ _id: id, userId: user.sub }).lean();
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
  if (existing.status !== 'pending') return c.json({ error: { code: 'CONFLICT', message: 'Can only update pending payments' } }, 409);
  const result = await Payment.findByIdAndUpdate(id, body, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

export async function checkout(c: any) {
  const user = c.get('user');
  const body = checkoutSchema.parse(await c.req.json());
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount);
  const testMode = await isPaymentTestMode();

  // Demo card gate: in test mode a card whose number isn't the canonical test card
  // is declined, so the form behaves like a real gateway — right card → paid, wrong
  // card → error. Expiry/CVC are not checked (any values pass). A checkout with no
  // card at all (e.g. paying an already-approved booking off its saved card) skips
  // this and follows the normal path.
  if (testMode && body.card?.number) {
    const entered = body.card.number.replace(/\D/g, '');
    if (entered !== '4242424242424242') {
      return c.json({ error: { code: 'CARD_DECLINED', message: 'Card declined. Use the demo test card 4242 4242 4242 4242 (any future expiry, any CVC).' } }, 402);
    }
  }

  // Request-to-book lifecycle guard: an approval-required booking can only be
  // paid once the owner has accepted it, and only before its pay-window lapses.
  // (Instant-book bookings are already 'confirmed', so these checks no-op.)
  if (body.bookingId) {
    const existing = await Booking.findOne({ _id: body.bookingId, userId: user.sub })
      .select('status paymentDueAt approvalDeadline').lean<{ status?: string; paymentDueAt?: Date; approvalDeadline?: Date }>();
    if (existing?.status === 'pending_approval') {
      return c.json({ error: { code: 'AWAITING_APPROVAL', message: 'This booking is awaiting venue approval — you can pay once the owner accepts it.' } }, 409);
    }
    // Expiry is decided by the shared predicate and written by the shared
    // cancel path, so this can't drift from the sweeper the way the inline copy
    // that used to live here did.
    if (existing && !isBlocking(existing, new Date())) {
      await expireOverdueBookings([{ ...existing, _id: body.bookingId }]);
      return c.json({ error: { code: 'PAYMENT_EXPIRED', message: 'The payment window for this booking has expired. Please book again.' } }, 409);
    }
  }

  const payment = await Payment.create({
    bookingId: body.bookingId || null, userId: user.sub, amount, currency: body.currency,
    // Live launch payments are reconciled manually through GCash. Keeping this
    // behind paymentTestMode means a future gateway can feed the same completion
    // path without changing booking/subscription activation.
    method: testMode ? (body.method || 'test_card') : 'gcash',
    provider: testMode ? 'test' : 'manual',
    status: testMode ? 'completed' : 'pending',
  });

  // Instant-book bookings are already 'confirmed' at creation; approval-required
  // ones reach here as 'awaiting_payment' once the owner has accepted. Checkout
  // records the payment either way. In test mode we also stamp the payment method
  // onto the booking; live mode leaves the payment pending until a real gateway
  // lands. Scope the booking to its owner.
  let booking: any = null;
  if (body.bookingId) {
    booking = testMode
      ? await Booking.findOneAndUpdate(
          { _id: body.bookingId, userId: user.sub },
          { status: 'confirmed', paymentMethod: payment.method || undefined },
          { new: true },
        ).lean()
      : await Booking.findOne({ _id: body.bookingId, userId: user.sub }).lean();
  }

  // Send payment receipt email (best-effort, non-blocking).
  if (testMode && canEmail() && booking) {
    void (async () => {
      try {
        const v = await Venue.findById(booking.venueId).select('displayName').lean<{ displayName?: string }>();
        const userEmail = (c.get('user') as any)?.email;
        if (userEmail) {
          const amt = Number(booking.amount || payment.amount);
          const fee = Number(booking.serviceFeeAmount || 0);
          const vatAmt = Math.round(amt * 0.12 * 100) / 100;
          const t = paymentReceipt({
            receipt: `OR-${String(payment._id).slice(-8).toUpperCase()}`,
            bookingRef: String(booking._id).slice(-8).toUpperCase(),
            venue: v?.displayName || 'the venue',
            date: fmtDate(booking.date),
            time: `${fmtTime2(booking.startTime)} – ${fmtTime2(booking.endTime)}`,
            subtotal: `₱${(amt - fee).toFixed(2)}`,
            fee: `₱${fee.toFixed(2)}`,
            vat: `₱${vatAmt.toFixed(2)}`,
            total: `₱${amt.toFixed(2)}`,
            method: payment.method || 'Card',
            paidAt: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          });
          await sendEmail({ to: userEmail, subject: `Payment receipt — ${v?.displayName || 'your booking'}`, body: t.text, html: t.html });
        }
      } catch { /* best-effort */ }
    })();
  }

  return c.json({
    data: {
      payment: { ...payment.toObject(), id: payment._id },
      booking: booking ? { ...booking, id: booking._id } : null,
      testMode,
    },
  }, 201);
}

export async function verifyPayment(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = verifySchema.parse(await c.req.json());
  const payment = await Payment.findById(id).lean();
  if (!payment) return c.json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);

  const isAdmin = hasPermission(user, 'admin.bookings.manage');
  const canManageBookings = hasPermission(user, 'owner.bookings.manage');
  let booking: any = null;
  if (payment.bookingId) {
    booking = await Booking.findById(payment.bookingId).lean();
  }

  // Admins reconcile platform-level charges. Owners/staff may reconcile only a
  // booking at a venue owned by their effective owner — holding the permission
  // alone must never expose another venue's money, and it must never activate a
  // platform partner subscription.
  if (!isAdmin) {
    if (!canManageBookings || !booking) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Payment verification permission required' } }, 403);
    }
    const managesVenue = await Venue.exists({
      _id: booking.venueId,
      ownerUserId: effectiveOwnerId(user),
    });
    if (!managesVenue) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You can only verify payments for your venues' } }, 403);
    }
  }

  if (body.status === 'completed' && booking) {
    if (booking.status === 'awaiting_payment' && !isBlocking(booking, new Date())) {
      await expireOverdueBookings([booking]);
      return c.json({ error: { code: 'PAYMENT_EXPIRED', message: 'The payment window expired and the slot was released.' } }, 409);
    }
    if (!['awaiting_payment', 'confirmed', 'paid'].includes(booking.status)) {
      return c.json({ error: { code: 'BOOKING_NOT_PAYABLE', message: 'This booking can no longer be marked paid.' } }, 409);
    }
  }

  const result = await Payment.findByIdAndUpdate(
    id,
    { status: body.status, notes: body.notes || null },
    { new: true },
  ).lean();

  if (body.status === 'completed' && result!.bookingId) {
    await Booking.findOneAndUpdate(
      { _id: result!.bookingId, status: { $in: ['awaiting_payment', 'confirmed', 'paid'] } },
      { status: 'confirmed', paymentMethod: result!.method || undefined },
    );
    // Auto-generate a draft receipt when a booking is confirmed via payment.
    void generateReceiptForBooking(String(result!.bookingId)).catch(() => {});
  }

  if (body.status === 'completed' && result!.purpose === 'partner_subscription' && result!.subscriptionId) {
    // Only an admin reaches this branch (owners are rejected above). Start the
    // paid term now — never at request time — so manual reconciliation doesn't
    // consume part of the subscription period.
    const pricing = await getPartnerSubscriptionPricing();
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000);
    await PartnerSubscription.findOneAndUpdate(
      { _id: result!.subscriptionId, status: 'pending' },
      { status: 'active', startedAt, expiresAt },
    );
  }
  return c.json({ data: { ...result, id: result!._id } });
}

/* ─── Official receipts ────────────────────────────────────────── */

async function generateDraftReceipt(bookingId: string): Promise<void> {
  const booking = await Booking.findById(bookingId).select('userId venueId amount serviceFeeAmount date startTime').lean();
  if (!booking) return;
  const venueId = String((booking as any).venueId);

  // Atomic increment for sequential OR number per venue.
  const counter = await ReceiptCounter.findOneAndUpdate(
    { venueId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const venue = await Venue.findById(venueId).select('displayName').lean();
  const venueCode = ((venue as any)?.displayName || 'VEN').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
  const year = new Date().getFullYear().toString().slice(2);
  const seq = String(counter!.seq).padStart(5, '0');
  const receiptNumber = `OR-${venueCode}-${year}-${seq}`;

  const gross = (booking as any).amount + ((booking as any).serviceFeeAmount || 0);
  const vatRate = 12;
  const vatAmount = Math.round(gross * vatRate / (100 + vatRate) * 100) / 100;
  const netAmount = Math.round((gross - vatAmount) * 100) / 100;

  await OfficialReceipt.create({
    receiptNumber,
    bookingId,
    userId: (booking as any).userId,
    venueId,
    amount: gross,
    vatAmount,
    vatRate,
    netAmount,
    description: `Court booking at ${(venue as any)?.displayName || 'venue'} on ${(booking as any).date || 'a date'}`,
    status: 'draft',
  });
}

// Auto-generate receipt helper, exported so bookings controller can call it.
export async function generateReceiptForBooking(bookingId: string): Promise<void> {
  const exists = await OfficialReceipt.findOne({ bookingId });
  if (exists) return;
  await generateDraftReceipt(bookingId);
}

// GET /receipts/mine — player's receipts.
export async function listMyReceipts(c: any) {
  const user = c.get('user');
  const rows = await OfficialReceipt.find({ userId: user.sub }).sort({ createdAt: -1 }).populate('venueId', 'displayName').lean();
  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      receiptNumber: r.receiptNumber,
      bookingId: String(r.bookingId),
      venueName: r.venueId?.displayName ?? null,
      amount: r.amount,
      vatAmount: r.vatAmount,
      netAmount: r.netAmount,
      vatRate: r.vatRate,
      description: r.description,
      status: r.status,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
    })),
  });
}

// GET /receipts/:id — single receipt.
export async function getReceipt(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const r = await OfficialReceipt.findById(id).populate('venueId', 'displayName').lean();
  if (!r) return c.json({ error: { code: 'NOT_FOUND', message: 'Receipt not found' } }, 404);
  const isOwner = String((r as any).userId) === user.sub;
  const canManage = hasPermission(user, 'owner.bookings.manage');
  if (!isOwner && !canManage) return c.json({ error: { code: 'FORBIDDEN', message: 'Not your receipt' } }, 403);
  return c.json({ data: { ...r, id: String((r as any)._id), venueName: (r as any).venueId?.displayName ?? null } });
}

// PATCH /receipts/:id — update payor info or void.
const updateReceiptSchema = z.object({
  payorName: z.string().max(200).optional(),
  payorTIN: z.string().max(20).optional().nullable(),
  payorAddress: z.string().max(300).optional().nullable(),
  status: z.enum(['issued', 'voided']).optional(),
  voidReason: z.string().max(300).optional(),
});

export async function updateReceipt(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const r = await OfficialReceipt.findById(id);
  if (!r) return c.json({ error: { code: 'NOT_FOUND', message: 'Receipt not found' } }, 404);
  const isOwner = String((r as any).userId) === user.sub;
  const canManage = hasPermission(user, 'owner.bookings.manage');
  if (!isOwner && !canManage) return c.json({ error: { code: 'FORBIDDEN', message: 'Not your receipt' } }, 403);
  const body = updateReceiptSchema.parse(await c.req.json());
  if (body.payorName !== undefined) (r as any).payorName = body.payorName;
  if (body.payorTIN !== undefined) (r as any).payorTIN = body.payorTIN;
  if (body.payorAddress !== undefined) (r as any).payorAddress = body.payorAddress;
  if (body.status === 'issued' && (r as any).status === 'draft') {
    (r as any).status = 'issued';
    (r as any).issuedAt = new Date();
  }
  if (body.status === 'voided') {
    (r as any).status = 'voided';
    (r as any).voidedAt = new Date();
    if (body.voidReason) (r as any).voidReason = body.voidReason;
  }
  await (r as any).save();
  return c.json({ data: { id: String((r as any)._id), status: (r as any).status } });
}

// GET /owner/venues/:id/receipts — owner venue receipts.
export async function listVenueReceipts(c: any) {
  const user = c.get('user');
  const venueId = c.req.param('id');
  const venue = await Venue.findById(venueId).select('ownerUserId').lean<{ ownerUserId?: any }>();
  if (!venue || String(venue.ownerUserId) !== user.sub) {
    if (!hasPermission(user, 'owner.bookings.manage')) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Not your venue' } }, 403);
    }
  }
  const rows = await OfficialReceipt.find({ venueId }).sort({ createdAt: -1 }).populate('userId', 'displayName').lean();
  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      receiptNumber: r.receiptNumber,
      bookingId: String(r.bookingId),
      payorName: r.payorName || r.userId?.displayName || 'Player',
      amount: r.amount,
      vatAmount: r.vatAmount,
      netAmount: r.netAmount,
      status: r.status,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
    })),
  });
}

/* ─── Settlement / payout ledger ────────────────────────────────── */

const generateSettlementSchema = z.object({
  venueId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

let settlementSeq = 0;

// POST /admin/settlements/generate — admin generates a settlement for a venue + period.
export async function generateSettlement(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.bookings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin booking/payment permission required' } }, 403);
  }
  const body = generateSettlementSchema.parse(await c.req.json());
  const venue = await Venue.findById(body.venueId).select('ownerUserId').lean<{ ownerUserId?: any }>();
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const periodBookings = await Booking.find({
    venueId: body.venueId,
    status: 'confirmed',
    date: { $gte: body.periodStart, $lte: body.periodEnd },
    bookingType: { $nin: ['blocked', 'manual'] },
  }).lean();
  const existingLineItems = periodBookings.length
    ? await SettlementLineItem.find({ bookingId: { $in: periodBookings.map((b) => b._id) } }).select('bookingId').lean()
    : [];
  const settledBookingIds = new Set((existingLineItems as any[]).map((item) => String(item.bookingId)));
  const bookings = periodBookings.filter((booking) => !settledBookingIds.has(String(booking._id)));

  const grossRevenue = bookings.reduce((sum, b: any) => sum + (b.amount || 0), 0);
  const platformFees = bookings.reduce((sum, b: any) => sum + (b.serviceFeeAmount || 0), 0);
  const netPayout = Math.round((grossRevenue - platformFees) * 100) / 100;

  settlementSeq += 1;
  const year = new Date().getFullYear();
  const settlementRef = `SET-${year}-${String(settlementSeq).padStart(4, '0')}`;

  const settlement = await Settlement.create({
    settlementRef,
    venueId: body.venueId,
    ownerUserId: venue.ownerUserId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    totalBookings: bookings.length,
    grossRevenue,
    platformFees,
    netPayout,
  });

  // Create line items.
  if (bookings.length) {
    const items = bookings.map((b: any) => ({
      settlementId: settlement._id,
      bookingId: b._id,
      amount: b.amount || 0,
      serviceFee: b.serviceFeeAmount || 0,
    }));
    await SettlementLineItem.insertMany(items);
  }

  return c.json({ data: { id: String(settlement._id), settlementRef, netPayout, totalBookings: bookings.length } }, 201);
}

// GET /admin/settlements — admin lists settlements.
export async function listSettlements(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.bookings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin booking/payment permission required' } }, 403);
  }
  const rows = await Settlement.find().sort({ createdAt: -1 }).populate('venueId', 'displayName').lean();
  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      settlementRef: r.settlementRef,
      venueName: r.venueId?.displayName ?? null,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      totalBookings: r.totalBookings,
      grossRevenue: r.grossRevenue,
      platformFees: r.platformFees,
      netPayout: r.netPayout,
      status: r.status,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    })),
  });
}

// PATCH /admin/settlements/:id — update settlement status/payout ref.
const updateSettlementSchema = z.object({
  status: z.enum(['pending', 'processing', 'paid', 'disputed']).optional(),
  payoutMethod: z.string().max(50).optional(),
  payoutRef: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export async function updateSettlement(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.bookings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin booking/payment permission required' } }, 403);
  }
  const s = await Settlement.findById(c.req.param('id'));
  if (!s) return c.json({ error: { code: 'NOT_FOUND', message: 'Settlement not found' } }, 404);
  const body = updateSettlementSchema.parse(await c.req.json());
  if (body.status) (s as any).status = body.status;
  if (body.status === 'paid') (s as any).paidAt = new Date();
  if (body.payoutMethod) (s as any).payoutMethod = body.payoutMethod;
  if (body.payoutRef) (s as any).payoutRef = body.payoutRef;
  if (body.notes !== undefined) (s as any).notes = body.notes;
  await (s as any).save();
  return c.json({ data: { id: String((s as any)._id), status: (s as any).status } });
}

// GET /owner/settlements — owner's settlements.
export async function listOwnerSettlements(c: any) {
  const user = c.get('user');
  const rows = await Settlement.find({ ownerUserId: user.sub }).sort({ createdAt: -1 }).populate('venueId', 'displayName').lean();
  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      settlementRef: r.settlementRef,
      venueName: r.venueId?.displayName ?? null,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      totalBookings: r.totalBookings,
      grossRevenue: r.grossRevenue,
      platformFees: r.platformFees,
      netPayout: r.netPayout,
      status: r.status,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    })),
  });
}

// GET /owner/settlements/balance — current pending payout balance.
export async function getOwnerBalance(c: any) {
  const user = c.get('user');
  // Return one row per owned venue — this is the contract the owner app renders.
  // Scope at the query (not after loading every platform booking), and exclude
  // bookings already attached to any settlement line item so "unsettled" does
  // not grow forever after payouts are generated.
  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id displayName').lean();
  if (!venues.length) return c.json({ data: [] });
  const venueIds = venues.map((v) => v._id);
  const confirmed = await Booking.find({
    venueId: { $in: venueIds },
    status: 'confirmed',
    bookingType: { $nin: ['blocked', 'manual'] },
  }).select('_id venueId amount serviceFeeAmount').lean();
  const settled = confirmed.length
    ? await SettlementLineItem.find({ bookingId: { $in: confirmed.map((b) => b._id) } }).select('bookingId').lean()
    : [];
  const settledIds = new Set((settled as any[]).map((r) => String(r.bookingId)));

  const byVenue = new Map<string, { gross: number; fees: number; count: number }>();
  for (const b of confirmed as any[]) {
    if (settledIds.has(String(b._id))) continue;
    const key = String(b.venueId);
    const row = byVenue.get(key) ?? { gross: 0, fees: 0, count: 0 };
    row.gross += Number(b.amount) || 0;
    row.fees += Number(b.serviceFeeAmount) || 0;
    row.count += 1;
    byVenue.set(key, row);
  }

  return c.json({
    data: venues.map((venue: any) => {
      const totals = byVenue.get(String(venue._id)) ?? { gross: 0, fees: 0, count: 0 };
      return {
        venueId: String(venue._id),
        venueName: venue.displayName ?? null,
        unsenttledRevenue: Math.round(totals.gross * 100) / 100,
        unsenttledFees: Math.round(totals.fees * 100) / 100,
        unsenttledNet: Math.round((totals.gross - totals.fees) * 100) / 100,
        bookingCount: totals.count,
      };
    }),
  });
}

// GET /owner/payout-methods — owner's saved payout methods.
export async function listPayoutMethods(c: any) {
  const user = c.get('user');
  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id').lean();
  const venueIds = venues.map((v) => String(v._id));
  if (!venueIds.length) return c.json({ data: [] });
  const methods = await OwnerPayoutMethod.find({ venueId: { $in: venueIds } }).sort({ isDefault: -1, createdAt: -1 }).lean();
  return c.json({ data: methods.map((m: any) => ({ ...m, id: String(m._id) })) });
}

// POST /owner/payout-methods — add a payout method.
export async function createPayoutMethod(c: any) {
  const user = c.get('user');
  const body = z.object({
    venueId: z.string().min(1),
    method: z.enum(['bank_transfer', 'gcash', 'maya', 'other']),
    accountName: z.string().min(1).max(200),
    accountNumber: z.string().min(1).max(100),
    bankName: z.string().max(200).optional(),
  }).parse(await c.req.json());
  const venue = await Venue.findById(body.venueId).select('ownerUserId').lean<{ ownerUserId?: any }>();
  if (!venue || String(venue.ownerUserId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your venue' } }, 403);
  }
  const method = await OwnerPayoutMethod.create({ ...body });
  return c.json({ data: { ...(method as any).toObject?.() ?? method, id: String(method._id) } }, 201);
}

// DELETE /owner/payout-methods/:id
export async function deletePayoutMethod(c: any) {
  const user = c.get('user');
  const method = await OwnerPayoutMethod.findById(c.req.param('id'));
  if (!method) return c.json({ error: { code: 'NOT_FOUND', message: 'Payout method not found' } }, 404);
  const venue = await Venue.findById((method as any).venueId).select('ownerUserId').lean<{ ownerUserId?: any }>();
  if (!venue || String(venue.ownerUserId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your venue' } }, 403);
  }
  await (method as any).deleteOne();
  return c.json({ data: { ok: true } });
}
