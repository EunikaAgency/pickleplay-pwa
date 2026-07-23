import { describe, it, expect } from 'vitest';
import { automaticStatutoryDiscountCategory, countdownLabel, deadlineLabel, deadlineUrgency, estimateApprovalDeadline, isSeniorOnDate } from './bookingDisplay';

const MIN = 60_000;
const HOUR = 3_600_000;
const NOW = new Date('2026-07-20T12:00:00.000Z').getTime();

describe('isSeniorOnDate', () => {
  it('becomes eligible on the 60th birthday', () => {
    expect(isSeniorOnDate('1966-07-22', '2026-07-21')).toBe(false);
    expect(isSeniorOnDate('1966-07-22', '2026-07-22')).toBe(true);
  });

  it('accepts an older Senior profile and rejects missing or invalid dates', () => {
    expect(isSeniorOnDate('1950-11-20', '2026-07-22')).toBe(true);
    expect(isSeniorOnDate(undefined, '2026-07-22')).toBe(false);
    expect(isSeniorOnDate('1950-02-31', '2026-07-22')).toBe(false);
  });
});

describe('automaticStatutoryDiscountCategory', () => {
  const seniorProfile = {
    birthday: '1950-11-20',
    onDate: '2026-07-23',
    seniorCitizenIdNumber: 'OSCA-123',
  };

  it('automatically uses a saved Senior card for an eligible profile', () => {
    expect(automaticStatutoryDiscountCategory(seniorProfile)).toBe('senior');
  });

  it('does not claim a Senior discount without both eligibility and a saved card', () => {
    expect(automaticStatutoryDiscountCategory({ ...seniorProfile, seniorCitizenIdNumber: '' })).toBe('none');
    expect(automaticStatutoryDiscountCategory({ ...seniorProfile, birthday: '1990-11-20' })).toBe('none');
  });

  it('does not auto-apply a saved PWD card while PWD discounts are paused', () => {
    expect(automaticStatutoryDiscountCategory({
      birthday: '1990-11-20',
      onDate: '2026-07-23',
      pwdIdNumber: 'PWD-456',
    })).toBe('none');
  });

  it('keeps Senior when both cards qualify while PWD discounts are paused', () => {
    expect(automaticStatutoryDiscountCategory({
      ...seniorProfile,
      pwdIdNumber: 'PWD-456',
      statutoryDiscounts: [
        { category: 'senior', percent: 20 },
        { category: 'pwd', percent: 25 },
      ],
    })).toBe('senior');
  });

  it('prefers Senior when both saved cards have the same discount', () => {
    expect(automaticStatutoryDiscountCategory({
      ...seniorProfile,
      pwdIdNumber: 'PWD-456',
    })).toBe('senior');
  });
});

/** Build a `date` + `startTime` pair that lands `leadMs` from NOW, in local time
 *  (which is how the booking flow stores and re-parses them). */
function slotAt(leadMs: number): { date: string; startTime: string } {
  const d = new Date(NOW + leadMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    startTime: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

describe('estimateApprovalDeadline — mirrors the server formula', () => {
  // The same table as api/src/features/bookings/bookingDeadlines.test.ts.
  // Two implementations, one fixture: if the client drifts from the server,
  // this is what catches it.
  const table = [
    { label: '2 weeks out', leadMs: 14 * 24 * HOUR, expectMins: 24 * 60 },
    { label: '3 days out', leadMs: 72 * HOUR, expectMins: 24 * 60 },
    { label: '36 hours out', leadMs: 36 * HOUR, expectMins: 9 * 60 },
    { label: '14 hours out', leadMs: 14 * HOUR, expectMins: 210 },
    { label: '10 hours out', leadMs: 10 * HOUR, expectMins: 60 },
    { label: '3 hours out', leadMs: 3 * HOUR, expectMins: 18 },
    { label: '45 minutes out', leadMs: 45 * MIN, expectMins: 15 },
  ];

  for (const row of table) {
    it(`${row.label} → ~${row.expectMins} min`, () => {
      const { date, startTime } = slotAt(row.leadMs);
      const d = estimateApprovalDeadline(date, startTime, 24, NOW);
      const mins = (d.getTime() - NOW) / MIN;
      // ±1 min: slotAt truncates to whole minutes, so the reconstructed lead can
      // differ from the exact input by up to 60s.
      expect(Math.abs(mins - row.expectMins)).toBeLessThanOrEqual(1);
    });
  }

  it('never lands after play has started', () => {
    for (const leadMins of [5, 10, 16, 20, 25, 30, 45]) {
      const { date, startTime } = slotAt(leadMins * MIN);
      const playMs = new Date(`${date}T${startTime}:00`).getTime();
      expect(estimateApprovalDeadline(date, startTime, 24, NOW).getTime()).toBeLessThanOrEqual(playMs);
    }
  });

  it('falls back to the venue window without a start time', () => {
    const d = estimateApprovalDeadline('2026-08-01', null, 24, NOW);
    expect((d.getTime() - NOW) / MIN).toBe(24 * 60);
  });
});

describe('countdownLabel', () => {
  it('renders minutes, then hours + minutes', () => {
    expect(countdownLabel(new Date(NOW + 18 * MIN), 'left', NOW)).toBe('18 min left');
    expect(countdownLabel(new Date(NOW + 135 * MIN), 'left', NOW)).toBe('2h 15m left');
    expect(countdownLabel(new Date(NOW + 120 * MIN), 'left', NOW)).toBe('2h left');
  });

  it('collapses a passed deadline rather than going negative', () => {
    expect(countdownLabel(new Date(NOW - HOUR), 'left', NOW)).toBe('Expiring now');
  });

  it('takes a custom suffix, so the waitlist can share it', () => {
    expect(countdownLabel(new Date(NOW + 45 * MIN), 'to claim', NOW)).toBe('45 min to claim');
  });

  it('is empty for missing or unparseable input', () => {
    expect(countdownLabel(null, 'left', NOW)).toBe('');
    expect(countdownLabel('garbage', 'left', NOW)).toBe('');
  });
});

describe('deadlineLabel', () => {
  it('is empty for missing or unparseable input', () => {
    expect(deadlineLabel(null)).toBe('');
    expect(deadlineLabel('garbage')).toBe('');
  });

  it('says "today" for a deadline later the same day', () => {
    expect(deadlineLabel(new Date(NOW + HOUR), NOW)).toContain('today');
  });
});

describe('deadlineUrgency', () => {
  const created = new Date(NOW);
  const deadline = new Date(NOW + 100 * MIN);

  it('is calm early in the window', () => {
    expect(deadlineUrgency(created, deadline, NOW + 10 * MIN)).toBe('calm');
  });

  it('warns under a quarter remaining', () => {
    expect(deadlineUrgency(created, deadline, NOW + 80 * MIN)).toBe('soon');
  });

  it('is urgent under a tenth remaining', () => {
    expect(deadlineUrgency(created, deadline, NOW + 95 * MIN)).toBe('urgent');
  });

  it('is null without both endpoints', () => {
    expect(deadlineUrgency(null, deadline, NOW)).toBeNull();
    expect(deadlineUrgency(created, null, NOW)).toBeNull();
  });
});
