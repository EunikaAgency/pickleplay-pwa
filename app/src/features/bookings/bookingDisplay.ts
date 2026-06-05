// Formatters for the booking screens. Kept next to the screens (like
// games/gameDisplay.ts) since they're booking-specific.

import type { ApiBooking } from '../../shared/lib/api';

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

/** "₱600" — money with the right symbol (defaults to PHP, the seeded currency). */
export function money(amount: number | null | undefined, currency = 'PHP'): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? '';
  const n = typeof amount === 'number' ? amount : 0;
  return `${sym}${n % 1 === 0 ? n : n.toFixed(2)}`;
}

/** Local YYYY-MM-DD (matches how the API stores a booking's date). */
export function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "18:30" → "6:30 PM". */
export function to12h(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Add `hours` to a "HH:MM" start, returning "HH:MM" (clamped to 23:59). */
export function addHours(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + Math.round(hours * 60), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "Sat, Jun 7" from a YYYY-MM-DD string (falls back to the raw value). */
export function prettyDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface StatusChip {
  label: string;
  /** Tailwind-ish inline tone classes for the chip. */
  className: string;
}

/** Map a booking status to a human label + tone for a status chip. */
export function statusChip(status: string | null | undefined): StatusChip {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', className: 'bg-[var(--lime)] text-[var(--ink)]' };
    case 'paid':
      return { label: 'Paid', className: 'bg-[var(--primary)] text-white' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'pending_approval':
    default:
      return { label: 'Pending approval', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
  }
}

/** Whether a booking can still be cancelled (not already cancelled). */
export function isCancellable(b: ApiBooking): boolean {
  return b.status !== 'cancelled';
}
