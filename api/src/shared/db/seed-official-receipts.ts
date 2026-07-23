// Seed BIR official receipts for bookings that already have money against them.
//
// WHY
// `generateReceiptForBooking()` only fires from checkout and the staff walk-in
// path, so every booking that predates it — 130-odd confirmed/completed rows,
// 140 payments — carries no `OfficialReceipt`. The owner Finance & Receipts
// screen therefore renders its empty state on a database that is full of paid
// bookings. This backfills the missing receipts so the screen has real data.
//
// CONNECTED, NOT FABRICATED
// Nothing here invents a transaction. Every receipt is minted from a booking
// that ALREADY exists and ALREADY has a Payment row, and it reuses the exact
// figures and formulas the server generator uses:
//   - amount   = booking.amount + booking.serviceFeeAmount (what the player paid)
//   - VAT      = 12% extracted VAT-inclusive, or 0 for a senior/PWD booking
//   - number   = OR-{venueCode}-{yy}-{seq}, from the same per-venue ReceiptCounter
//   - payor    = booking.customerName, else the booking's own user
//   - venue    = booking.venueId, so it lands under that venue's real owner
//   - status   = paid / pending / refunded comes from the linked Payment, not
//                from this script — the mix on screen is the mix in the data
// The only invented values are the handful of VAT-exempt bookings and voids
// described below, both of which exist to exercise UI states the current data
// has none of, and both of which `--revert` puts back exactly.
//
// WHAT IT ADDS ON TOP
//   - EXEMPT_N bookings are marked senior/PWD (with a plausible ID number) so
//     the VAT-exempt path renders. Their prior values are recorded for revert.
//   - VOID_N receipts are voided with a real-sounding reason, so the Voided
//     chip and the "excluded from totals" rule are visible.
//
// REVERSIBILITY
// Records every receipt id it creates, every booking field it overwrites, and
// every ReceiptCounter it touches. `--revert` undoes exactly those and nothing
// else — it never deletes a receipt this script did not create.
//
// Usage: npx tsx src/shared/db/seed-official-receipts.ts            (dry run)
//        npx tsx src/shared/db/seed-official-receipts.ts --apply
//        EXEMPT_N=10 VOID_N=6 npx tsx src/shared/db/seed-official-receipts.ts --apply
//        npx tsx src/shared/db/seed-official-receipts.ts --revert

import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import { Payment, OfficialReceipt, ReceiptCounter } from '../../features/payments/payments.model.js';
import { venueReceiptCode } from '../../features/payments/payments.controller.js';
import { Venue } from '../../features/venues/venues.model.js';

const BACKUP_URL = new URL('./seed-official-receipts.backup.json', import.meta.url);
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const EXEMPT_N = Number(process.env.EXEMPT_N ?? 8);
const VOID_N = Number(process.env.VOID_N ?? 5);

// A booking is receiptable once money has been recorded against it — that is
// what an OR documents. So the gate is "has a Payment row", not "is confirmed":
//   confirmed / completed + a settled payment  -> an issued, PAID receipt
//   cancelled + a refunded payment             -> the OR was issued, then refunded
//   pending_approval / awaiting_payment        -> a DRAFT receipt, still pending
// ₱0 court blocks are excluded outright: nothing was ever collected for them.
const RECEIPTABLE_STATUSES = ['confirmed', 'completed', 'cancelled', 'pending_approval', 'awaiting_payment'];

interface Backup {
  createdAt: string;
  receiptIds: string[];
  /** Bookings whose customerCategory/discountIdNumber this script overwrote. */
  bookingEdits: { id: string; customerCategory: string | null; discountIdNumber: string | null }[];
  /** Per-venue counter values BEFORE the run, so revert restores the sequence. */
  counters: { venueId: string; seq: number | null }[];
}

const rng = () => Math.random();
const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
const round2 = (n: number) => Math.round(n * 100) / 100;

const VOID_REASONS = [
  'Duplicate receipt issued for the same booking',
  'Wrong payor name — reissued',
  'Customer cancelled at the counter before play',
  'Amount keyed incorrectly at the front desk',
  'Booking moved to another date — receipt reissued',
];

/** A plausible PH senior-citizen / PWD ID number. Format only — not a real ID. */
function idNumber(kind: 'senior' | 'pwd'): string {
  const n = (len: number) => Array.from({ length: len }, () => Math.floor(rng() * 10)).join('');
  return kind === 'senior' ? `SC-${n(2)}-${n(5)}` : `PWD-${n(4)}-${n(4)}`;
}

async function revert() {
  if (!existsSync(BACKUP_URL)) {
    console.log('No backup file — nothing to revert.');
    return;
  }
  const b: Backup = JSON.parse(readFileSync(BACKUP_URL, 'utf8'));
  const del = await OfficialReceipt.deleteMany({ _id: { $in: b.receiptIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  console.log(`Deleted ${del.deletedCount} receipt(s) created by this script.`);

  let restored = 0;
  for (const e of b.bookingEdits) {
    const unset: any = {};
    const set: any = {};
    if (e.customerCategory == null) unset.customerCategory = ''; else set.customerCategory = e.customerCategory;
    if (e.discountIdNumber == null) unset.discountIdNumber = ''; else set.discountIdNumber = e.discountIdNumber;
    const update: any = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    await Booking.updateOne({ _id: e.id }, update);
    restored++;
  }
  console.log(`Restored ${restored} booking(s) to their original discount fields.`);

  for (const c of b.counters) {
    if (c.seq == null) await ReceiptCounter.deleteOne({ venueId: c.venueId });
    else await ReceiptCounter.updateOne({ venueId: c.venueId }, { $set: { seq: c.seq } });
  }
  console.log(`Rewound ${b.counters.length} venue receipt counter(s).`);
}

async function main() {
  await connectDb();

  if (REVERT) { await revert(); await mongoose.disconnect(); return; }

  // ── The candidate set: paid bookings with no receipt yet ────────────
  const bookings = await Booking.find({
    status: { $in: RECEIPTABLE_STATUSES },
    bookingType: { $ne: 'blocked' },
  }).select('_id userId venueId amount serviceFeeAmount discountAmount customerCategory discountIdNumber customerName date bookingType').lean();

  const bookingIds = bookings.map((b: any) => b._id);
  const payments = await Payment.find({ bookingId: { $in: bookingIds } }).select('bookingId method status').lean();
  const paymentByBooking = new Map((payments as any[]).map((p) => [String(p.bookingId), p]));
  const existing = await OfficialReceipt.find({ bookingId: { $in: bookingIds } }).select('bookingId').lean();
  const hasReceipt = new Set((existing as any[]).map((r) => String(r.bookingId)));

  // Only bookings that carry a Payment — a receipt without money behind it is
  // exactly the kind of invented row this script is trying not to create.
  const candidates = bookings.filter((b: any) =>
    !hasReceipt.has(String(b._id))
    && paymentByBooking.has(String(b._id))
    && ((b.amount || 0) + (b.serviceFeeAmount || 0)) > 0
    && b.venueId);

  const venues = await Venue.find({ _id: { $in: [...new Set(candidates.map((b: any) => String(b.venueId)))] } })
    .select('_id displayName ownerUserId').lean();
  const venueById = new Map((venues as any[]).map((v) => [String(v._id), v]));

  console.log(`Receiptable bookings: ${bookings.length}`);
  console.log(`  already have a receipt: ${hasReceipt.size}`);
  console.log(`  candidates (have a Payment, no receipt): ${candidates.length}`);
  const byStatus = new Map<string, number>();
  for (const b of candidates) {
    const s = paymentByBooking.get(String(b._id))?.status ?? '(none)';
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  console.log(`  payment status mix: ${[...byStatus].map(([s, n]) => `${s}=${n}`).join(', ')}`);
  console.log(`  spread over ${venueById.size} venue(s)`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write. Nothing was changed.');
    await mongoose.disconnect();
    return;
  }

  const backup: Backup = { createdAt: new Date().toISOString(), receiptIds: [], bookingEdits: [], counters: [] };

  // ── Mark a few bookings senior/PWD so the VAT-exempt path is exercised ──
  const exemptTargets = [...candidates].sort(() => rng() - 0.5).slice(0, Math.min(EXEMPT_N, candidates.length));
  const exemptIds = new Set<string>();
  for (const b of exemptTargets as any[]) {
    const kind: 'senior' | 'pwd' = chanceSenior() ? 'senior' : 'pwd';
    backup.bookingEdits.push({
      id: String(b._id),
      customerCategory: b.customerCategory ?? null,
      discountIdNumber: b.discountIdNumber ?? null,
    });
    await Booking.updateOne({ _id: b._id }, { $set: { customerCategory: kind, discountIdNumber: idNumber(kind) } });
    b.customerCategory = kind;
    b.discountIdNumber = idNumber(kind);
    exemptIds.add(String(b._id));
  }
  console.log(`\nMarked ${exemptTargets.length} booking(s) senior/PWD (VAT-exempt).`);

  // Snapshot the counters we are about to advance, so revert can rewind them.
  const touchedVenues = [...new Set(candidates.map((b: any) => String(b.venueId)))];
  const priorCounters = await ReceiptCounter.find({ venueId: { $in: touchedVenues } }).select('venueId seq').lean();
  const priorByVenue = new Map((priorCounters as any[]).map((c) => [String(c.venueId), c.seq]));
  for (const vid of touchedVenues) backup.counters.push({ venueId: vid, seq: priorByVenue.get(vid) ?? null });

  // ── Mint the receipts ───────────────────────────────────────────────
  const year = new Date().getFullYear().toString().slice(2);
  let made = 0;
  const madeIdsInOrder: string[] = [];

  // Oldest first, so the OR sequence per venue runs in the order the bookings
  // were actually taken rather than in whatever order Mongo returned them.
  candidates.sort((a: any, b: any) => String(a.date ?? '').localeCompare(String(b.date ?? '')));

  for (const b of candidates as any[]) {
    const venue = venueById.get(String(b.venueId));
    if (!venue) continue;

    const counter = await ReceiptCounter.findOneAndUpdate(
      { venueId: b.venueId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // Same helper the server generator uses, so seeded and live OR numbers
    // share one format and one uniqueness guarantee.
    const receiptNumber = `OR-${venueReceiptCode(String(b.venueId), venue.displayName)}-${year}-${String(counter!.seq).padStart(5, '0')}`;

    const gross = (b.amount || 0) + (b.serviceFeeAmount || 0);
    const vatExempt = ['senior', 'pwd'].includes(b.customerCategory);
    const vatRate = vatExempt ? 0 : 12;
    const vatAmount = vatExempt ? 0 : round2(gross * vatRate / (100 + vatRate));
    const netAmount = round2(gross - vatAmount);

    const payment = paymentByBooking.get(String(b._id));
    // Receipts for money already collected are `issued`; the OR is the document
    // handed over at the counter, so an unpaid booking's stays a draft.
    const collected = payment?.status === 'completed' || payment?.status === 'paid' || payment?.status === 'refunded';

    const doc = await OfficialReceipt.create({
      receiptNumber,
      bookingId: b._id,
      paymentId: (payment as any)?._id,
      userId: b.userId,
      venueId: b.venueId,
      payorName: b.customerName || undefined,
      amount: gross,
      vatAmount,
      vatRate,
      netAmount,
      discountAmount: b.discountAmount || 0,
      discountCategory: vatExempt ? b.customerCategory : undefined,
      discountIdNumber: vatExempt ? b.discountIdNumber : undefined,
      vatExempt,
      description: `Court booking at ${venue.displayName || 'venue'} on ${b.date || 'a date'}`,
      status: collected ? 'issued' : 'draft',
      issuedAt: collected ? new Date() : undefined,
    });
    backup.receiptIds.push(String(doc._id));
    madeIdsInOrder.push(String(doc._id));
    made++;
  }
  console.log(`Created ${made} official receipt(s).`);

  // ── Void a handful so that state is visible on the screen ───────────
  const voidTargets = [...madeIdsInOrder].sort(() => rng() - 0.5).slice(0, Math.min(VOID_N, madeIdsInOrder.length));
  for (const id of voidTargets) {
    await OfficialReceipt.updateOne({ _id: id }, {
      $set: { status: 'voided', voidedAt: new Date(), voidReason: pick(VOID_REASONS) },
    });
  }
  console.log(`Voided ${voidTargets.length} receipt(s).`);

  writeFileSync(BACKUP_URL, JSON.stringify(backup, null, 2));
  console.log(`\nBackup written to ${BACKUP_URL.pathname}`);
  console.log('Revert with: npx tsx src/shared/db/seed-official-receipts.ts --revert');

  await mongoose.disconnect();
}

/** Seniors outnumber PWD bookings in practice; keep the mix believable. */
function chanceSenior() { return rng() < 0.7; }

main().catch((e) => { console.error(e); process.exit(1); });
