// Formatters for the booking screens. Kept next to the screens (like
// games/gameDisplay.ts) since they're booking-specific.

import type { ApiBooking } from '../../shared/lib/api';

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

/** "₱32,540" — money with the right symbol + thousands separators (defaults to PHP). */
export function money(amount: number | null | undefined, currency = 'PHP'): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? '';
  const n = typeof amount === 'number' ? amount : 0;
  const formatted = n % 1 === 0
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${formatted}`;
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

/** "6:30 PM" → "18:30" (for prefilling a <input type="time">). Empty if unparseable. */
export function to24h(label: string | null | undefined): string {
  if (!label) return '';
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Snap a "HH:MM" time down to the hour ("18:30" → "18:00"). Empty stays empty. */
export function snapToHour(hhmm: string): string {
  if (!hhmm) return '';
  const [h] = hhmm.split(':');
  return `${String(Number(h) || 0).padStart(2, '0')}:00`;
}

/** Add `hours` to a "HH:MM" start, returning "HH:MM" (clamped to 23:59). */
export function addHours(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + Math.round(hours * 60), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Fractional hours between two "HH:MM" times; 0 when missing, unparseable, or non-positive. */
export function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}

/** "Sat, Jun 7" from a YYYY-MM-DD string (falls back to the raw value). */
export function prettyDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Weekday + day-of-month for a date box, e.g. { wd: 'MON', d: '8' }. */
export function dateBox(ymd: string | null | undefined): { wd: string; d: string } {
  if (!ymd) return { wd: '', d: '' };
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { wd: '', d: '' };
  return { wd: WD[d.getDay()], d: String(d.getDate()) };
}

/** "6:00–7:00 PM" from start/end "HH:MM" (shared meridiem collapses); just the start if no end. */
export function timeRange(b: Pick<ApiBooking, 'startTime' | 'endTime'>): string {
  if (!b.startTime) return '';
  const start = to12h(b.startTime);
  if (!b.endTime) return start;
  const end = to12h(b.endTime);
  // Collapse a shared AM/PM: "6:00 PM" + "7:00 PM" → "6:00–7:00 PM".
  return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)}–${end}` : `${start}–${end}`;
}

/** "1 hr" / "1.5 hr" / "45 min" from start/end; empty when not computable. */
export function bookingDuration(b: Pick<ApiBooking, 'startTime' | 'endTime'>): string {
  if (!b.startTime || !b.endTime) return '';
  const [sh, sm] = b.startTime.split(':').map(Number);
  const [eh, em] = b.endTime.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return '';
  if (mins < 60) return `${mins} min`;
  return mins % 60 === 0 ? `${mins / 60} hr` : `${(mins / 60).toFixed(1)} hr`;
}

/** Date-aware status for a booking card: confirmed/paid split into Upcoming vs Completed. */
export function bookingStatusChip(b: ApiBooking, now: number = Date.now()): StatusChip {
  if (b.status === 'cancelled') return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  if (b.status === 'pending_approval') return { label: 'Pending', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
  const start = b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN;
  const upcoming = Number.isNaN(start) || start >= now;
  return upcoming
    ? { label: 'Upcoming', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' }
    : { label: 'Completed', className: 'bg-[var(--lime)] text-[var(--ink)]' };
}

export interface StatusChip {
  label: string;
  /** Tailwind-ish inline tone classes for the chip. */
  className: string;
}

/** Map a booking status to a human label + tone for a status chip. */
export function statusChip(status: string | null | undefined): StatusChip {
  switch (status) {
    // Bookings arrive already paid + confirmed, so the settled state reads
    // "Complete". Legacy 'paid' rows fold into the same state.
    case 'confirmed':
    case 'paid':
      return { label: 'Complete', className: 'bg-[var(--lime)] text-[var(--ink)]' };
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
