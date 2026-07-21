import { describe, it, expect } from 'vitest';
import {
  playStartOf,
  approvalShare,
  computeApprovalDeadline,
  computePaymentDueAt,
  isBlocking,
  blockingFilter,
} from './bookingDeadlines.js';

const MIN = 60_000;
const HOUR = 3_600_000;
const NOW = new Date('2026-07-20T12:00:00.000Z');

/** Minutes between `now` and the computed deadline — the unit the spec table is in. */
const windowMins = (deadline: Date, now = NOW) => (deadline.getTime() - now.getTime()) / MIN;

const at = (msFromNow: number) => new Date(NOW.getTime() + msFromNow);

describe('approvalShare', () => {
  it('gives half the runway when the game is more than two days out', () => {
    expect(approvalShare(14 * 24 * HOUR)).toBe(0.5);
    expect(approvalShare(48 * HOUR + 1)).toBe(0.5);
  });

  it('gives a tenth when the game is under twelve hours away', () => {
    expect(approvalShare(3 * HOUR)).toBe(0.1);
    expect(approvalShare(12 * HOUR - 1)).toBe(0.1);
  });

  // Both boundaries belong to the LOWER band. A `>` / `>=` slip here silently
  // doubles or halves every owner's window, so they are pinned exactly.
  it('puts both band boundaries in the lower band', () => {
    expect(approvalShare(48 * HOUR)).toBe(0.25);
    expect(approvalShare(12 * HOUR)).toBe(0.25);
  });
});

describe('computeApprovalDeadline — the agreed outcome table', () => {
  // Verbatim from docs/PB-04-stuck-bookings-proposal.md §2.2. That table is the
  // signed-off spec; encoding it here makes it executable.
  const table: { label: string; leadMs: number; expectMins: number; bound: string }[] = [
    { label: '2 weeks out',   leadMs: 14 * 24 * HOUR, expectMins: 24 * 60, bound: 'venue window' },
    { label: '3 days out',    leadMs: 72 * HOUR,      expectMins: 24 * 60, bound: 'venue window' },
    { label: '36 hours out',  leadMs: 36 * HOUR,      expectMins: 9 * 60,  bound: '25% band' },
    { label: '14 hours out',  leadMs: 14 * HOUR,      expectMins: 210,     bound: '25% band' },
    { label: '10 hours out',  leadMs: 10 * HOUR,      expectMins: 60,      bound: '10% band' },
    { label: '3 hours out',   leadMs: 3 * HOUR,       expectMins: 18,      bound: '10% band' },
    { label: '45 minutes out', leadMs: 45 * MIN,      expectMins: 15,      bound: 'floor + play cap' },
  ];

  for (const row of table) {
    it(`${row.label} → owner gets ${row.expectMins} min (${row.bound})`, () => {
      const deadline = computeApprovalDeadline({
        now: NOW,
        playStart: at(row.leadMs),
        approvalWindowHours: 24,
      });
      expect(windowMins(deadline)).toBe(row.expectMins);
    });
  }
});

describe('computeApprovalDeadline — each cap binding alone', () => {
  it('venue window binds on a far-future booking', () => {
    const d = computeApprovalDeadline({ now: NOW, playStart: at(14 * 24 * HOUR), approvalWindowHours: 6 });
    expect(windowMins(d)).toBe(6 * 60);
  });

  it('the share binds when it is tighter than the venue window', () => {
    const d = computeApprovalDeadline({ now: NOW, playStart: at(36 * HOUR), approvalWindowHours: 24 });
    expect(windowMins(d)).toBe(9 * 60);
  });

  it('play start minus 30 min binds just under an hour out', () => {
    // 50 min lead: share gives 5 min, but the floor lifts it to 15 — and
    // playStart − 30min is 20 min, so the floor is what actually binds here.
    const d = computeApprovalDeadline({ now: NOW, playStart: at(50 * MIN), approvalWindowHours: 24 });
    expect(windowMins(d)).toBe(15);
  });

  it('the 15-minute floor lifts a very short window', () => {
    const d = computeApprovalDeadline({ now: NOW, playStart: at(2 * HOUR), approvalWindowHours: 24 });
    expect(windowMins(d)).toBe(15); // 10% of 2h = 12 min, floored to 15
  });

  it('never returns a deadline after play has started', () => {
    // The regression this clamp exists for: with a 20-minute lead,
    // playStart − 30min is already in the past, so the floor would otherwise
    // push the deadline past the start of the game and keep the court blocked.
    for (const leadMins of [5, 10, 16, 20, 25, 30]) {
      const playStart = at(leadMins * MIN);
      const d = computeApprovalDeadline({ now: NOW, playStart, approvalWindowHours: 24 });
      expect(d.getTime()).toBeLessThanOrEqual(playStart.getTime());
      expect(d.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });
});

describe('computeApprovalDeadline — missing or unusable play start', () => {
  it('falls back to the venue window when play start is unknown', () => {
    const d = computeApprovalDeadline({ now: NOW, playStart: null, approvalWindowHours: 24 });
    expect(windowMins(d)).toBe(24 * 60);
  });

  it('ignores a play start already in the past', () => {
    const d = computeApprovalDeadline({ now: NOW, playStart: at(-2 * HOUR), approvalWindowHours: 24 });
    expect(windowMins(d)).toBe(24 * 60);
  });

  it('never emits an Invalid Date', () => {
    for (const playStart of [null, at(-HOUR), at(45 * MIN), at(14 * 24 * HOUR)]) {
      const d = computeApprovalDeadline({ now: NOW, playStart, approvalWindowHours: 24 });
      expect(Number.isNaN(d.getTime())).toBe(false);
    }
  });
});

describe('computePaymentDueAt', () => {
  it('clamps to before play start — the shipped bug this replaces', () => {
    // Approve at 5pm today for a 9am slot tomorrow. The old code set
    // `now + 24h`, giving the player a payment deadline eight hours AFTER the
    // court time had already passed.
    const now = new Date('2026-07-20T17:00:00.000Z');
    const playStart = new Date('2026-07-21T09:00:00.000Z');
    const due = computePaymentDueAt({ now, playStart, payWindowHours: 24 });
    expect(due.getTime()).toBeLessThan(playStart.getTime());
    expect(due.toISOString()).toBe('2026-07-21T08:45:00.000Z');
  });

  it('uses the full window when the game is far enough out', () => {
    const due = computePaymentDueAt({ now: NOW, playStart: at(10 * 24 * HOUR), payWindowHours: 24 });
    expect(windowMins(due)).toBe(24 * 60);
  });

  it('still returns a future deadline when play is imminent', () => {
    const due = computePaymentDueAt({ now: NOW, playStart: at(5 * MIN), payWindowHours: 24 });
    expect(due.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe('playStartOf', () => {
  it('combines date and start time', () => {
    expect(playStartOf('2026-07-20', '09:00')).toBeInstanceOf(Date);
  });

  it('returns null rather than an Invalid Date for unusable input', () => {
    expect(playStartOf('2026-07-20', null)).toBeNull();
    expect(playStartOf(null, '09:00')).toBeNull();
    expect(playStartOf('', '')).toBeNull();
    expect(playStartOf('not-a-date', 'garbage')).toBeNull();
  });
});

describe('isBlocking / blockingFilter agree', () => {
  const pastDate = at(-HOUR);
  const futureDate = at(HOUR);

  it('a cancelled booking never blocks', () => {
    expect(isBlocking({ status: 'cancelled' }, NOW)).toBe(false);
  });

  it('a live request blocks; a lapsed one does not', () => {
    expect(isBlocking({ status: 'pending_approval', approvalDeadline: futureDate }, NOW)).toBe(true);
    expect(isBlocking({ status: 'pending_approval', approvalDeadline: pastDate }, NOW)).toBe(false);
  });

  it('an overdue awaiting_payment booking stops blocking', () => {
    expect(isBlocking({ status: 'awaiting_payment', paymentDueAt: futureDate }, NOW)).toBe(true);
    expect(isBlocking({ status: 'awaiting_payment', paymentDueAt: pastDate }, NOW)).toBe(false);
  });

  // The whole design rests on legacy rows behaving unchanged: no deadline means
  // no expiry, so they keep holding their slot exactly as they did before.
  it('a legacy row with no deadline keeps blocking', () => {
    expect(isBlocking({ status: 'pending_approval' }, NOW)).toBe(true);
    expect(isBlocking({ status: 'pending_approval', approvalDeadline: null }, NOW)).toBe(true);
    expect(isBlocking({ status: 'awaiting_payment', paymentDueAt: null }, NOW)).toBe(true);
  });

  it('a confirmed booking always blocks, deadlines notwithstanding', () => {
    expect(isBlocking({ status: 'confirmed', approvalDeadline: pastDate }, NOW)).toBe(true);
  });

  it('accepts ISO strings as well as Dates', () => {
    expect(isBlocking({ status: 'pending_approval', approvalDeadline: pastDate.toISOString() }, NOW)).toBe(false);
  });

  it('exposes the same two expiry clauses to Mongo', () => {
    const f = blockingFilter(NOW);
    expect(f.status).toEqual({ $ne: 'cancelled' });
    expect(f.$nor).toEqual([
      { status: 'pending_approval', approvalDeadline: { $ne: null, $lt: NOW } },
      { status: 'awaiting_payment', paymentDueAt: { $ne: null, $lt: NOW } },
    ]);
  });
});
