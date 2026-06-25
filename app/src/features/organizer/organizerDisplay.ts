// Formatters + status metadata for the organizer console. Co-located with the
// organizer screens (like bookings/bookingDisplay.ts) so the slice stays
// self-contained and never cross-imports another feature's display helpers.

import type { TournamentStatus } from '../../shared/lib/api';

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

/** "₱1,200" — money with symbol + separators (defaults to PHP). */
export function money(amount: number | string | null | undefined, currency = 'PHP'): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? '';
  const n = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${sym}${n.toLocaleString('en-US')}`;
}

/** "18:30" → "6:30 PM". */
export function to12h(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

/** "6:00–7:00 PM" from start/end "HH:MM"; just the start if no end. */
export function timeRange(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const s = to12h(start);
  if (!end) return s;
  const e = to12h(end);
  return s.slice(-2) === e.slice(-2) ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;
}

/** "Sat, Jun 7" from a YYYY-MM-DD (falls back to the raw value). */
export function prettyDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Local YYYY-MM-DD today (for date <input> minimums / prefills). */
export function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DAYS_OF_WEEK = [
  { n: 0, short: 'Sun' }, { n: 1, short: 'Mon' }, { n: 2, short: 'Tue' },
  { n: 3, short: 'Wed' }, { n: 4, short: 'Thu' }, { n: 5, short: 'Fri' }, { n: 6, short: 'Sat' },
];

/** [1,3,5] → "Mon · Wed · Fri". */
export function formatDays(days: number[] | undefined): string {
  if (!days?.length) return '';
  return [...days].sort((a, b) => a - b).map((n) => DAYS_OF_WEEK[n]?.short).filter(Boolean).join(' · ');
}

export interface Chip {
  label: string;
  /** Inline tone classes for the pill. */
  className: string;
}

/** Human label + tone for a tournament status. */
export function tournamentStatusChip(status: TournamentStatus | string | undefined): Chip {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'pending_venue_approval':
      return { label: 'Pending venue', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
    case 'approved':
      return { label: 'Approved', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' };
    case 'registration_open':
      return { label: 'Registration open', className: 'bg-[var(--lime)] text-[var(--ink)]' };
    case 'ongoing':
      return { label: 'Ongoing', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' };
    case 'completed':
      return { label: 'Completed', className: 'bg-[var(--lime)] text-[var(--ink)]' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'rejected':
      return { label: 'Rejected', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
    default:
      return { label: String(status ?? '—'), className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  }
}

/** Human label + tone for a participant / venue-request status. */
export function regStatusChip(status: string | undefined): Chip {
  switch (status) {
    case 'registered':
    case 'approved':
    case 'confirmed':
      // Blue (info) — keeps each roster row to a single meaningful green (the
      // Paid pill) so the list doesn't read as all-green.
      return { label: status === 'approved' ? 'Approved' : 'Registered', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' };
    case 'pending':
      return { label: 'Pending', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
    case 'waitlisted':
      // Moved off blue (now used by Registered) to a soft "tentatively in" green.
      return { label: 'Waitlisted', className: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' };
    case 'declined':
    case 'rejected':
      return { label: status === 'declined' ? 'Declined' : 'Rejected', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    default:
      return { label: String(status ?? '—'), className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  }
}
