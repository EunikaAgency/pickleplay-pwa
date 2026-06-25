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
  if (b.status === 'awaiting_payment') return { label: 'Pay to confirm', className: 'bg-[var(--blue)]/15 text-[var(--blue)]' };
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

/** A booking's lifecycle phase by clock time (cancelled/completed are "done").
 *  Drives the My-bookings filter (Upcoming / Ongoing / Completed). */
export type BookingPhase = 'upcoming' | 'ongoing' | 'completed';
export function bookingPhase(b: ApiBooking, now: number = Date.now()): BookingPhase {
  const s = (b.status || '').toLowerCase();
  if (s === 'cancelled' || s === 'completed') return 'completed';
  const start = b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN;
  const end = b.date && b.endTime ? new Date(`${b.date}T${b.endTime}:00`).getTime() : NaN;
  if (!Number.isNaN(start) && now < start) return 'upcoming';
  if (!Number.isNaN(end) && now >= end) return 'completed';
  if (!Number.isNaN(start) && now >= start) return 'ongoing'; // started, not yet ended
  return 'upcoming'; // no usable date → treat as upcoming
}

/** Status chip that distinguishes Ongoing (in-progress) from Upcoming/Completed,
 *  and still surfaces Cancelled/Pending. Used on the My-bookings cards. */
export function bookingPhaseChip(b: ApiBooking, now: number = Date.now()): StatusChip {
  const s = (b.status || '').toLowerCase();
  if (s === 'cancelled') return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  if (s === 'pending_approval') return { label: 'Pending', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
  if (s === 'awaiting_payment') return { label: 'Pay to confirm', className: 'bg-[var(--blue)]/15 text-[var(--blue)]' };
  const phase = bookingPhase(b, now);
  if (phase === 'upcoming') return { label: 'Upcoming', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' };
  if (phase === 'ongoing') return { label: 'Ongoing', className: 'bg-[var(--blue)]/15 text-[var(--blue)]' };
  return { label: 'Completed', className: 'bg-[var(--lime)] text-[var(--ink)]' };
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
    // Owner approved a request-to-book; the player still needs to pay to confirm.
    case 'awaiting_payment':
      return { label: 'Awaiting payment', className: 'bg-[var(--blue)]/15 text-[var(--blue)]' };
    case 'pending_approval':
    default:
      return { label: 'Pending approval', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
  }
}

/** Whether a booking can still be cancelled: not already cancelled, and not in
 *  the past. A completed booking (confirmed/paid with a start time that has
 *  passed) can't be cancelled — mirrors the Upcoming-vs-Completed split in
 *  `bookingStatusChip`. A pending request can always be declined. */
export function isCancellable(b: ApiBooking, now: number = Date.now()): boolean {
  if (b.status === 'cancelled') return false;
  if (b.status === 'pending_approval') return true;
  const start = b.date ? new Date(`${b.date}T${b.startTime || '00:00'}:00`).getTime() : NaN;
  return Number.isNaN(start) || start >= now;
}
