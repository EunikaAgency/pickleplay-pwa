// Derives the owner notifications feed entirely client-side from data the owner
// dashboard already fetches (bookings, games, reviews) — there is no
// notifications backend yet. Only bookings carry a real event timestamp
// (`createdAt`), so only they get a "time ago" + drive the unread badge; games
// show their date and reviews are untimed (the API exposes no review timestamp).
//
// Feed order: recent booking activity (newest first) → upcoming games (soonest
// first) → reviews. The screen's filter chips isolate each kind.

import type { Screen } from '../../../shared/lib/navigation';
import type { OwnerBookingRow, OwnerGameRow, OwnerReviewRow } from '../hooks/useOwnerDashboard';
import { prettyDate, to12h } from '../../bookings/bookingDisplay';

export type OwnerNotifKind = 'booking' | 'game' | 'review';
type Tone = 'lime' | 'blue' | 'coral';

export interface OwnerNotif {
  id: string;
  kind: OwnerNotifKind;
  icon: string;
  tone: Tone;
  /** Real event time — present only for bookings; null = untimed (games/reviews). */
  timestamp: Date | null;
  /** Display string for the time column ("2m ago", "Sat, Jun 7", or ""). */
  timeLabel: string;
  /** Bold lead line. */
  title: string;
  /** Secondary line. */
  detail: string;
  /** Tap destination (omitted for actionable pending bookings — they use inline buttons). */
  target?: Screen;
  /** Present only for actionable pending bookings → inline Confirm / Decline. */
  booking?: OwnerBookingRow;
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Relative "time ago" for a real timestamp; "" when null. */
export function timeAgo(date: Date | null, now: Date = new Date()): string {
  if (!date) return '';
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 0) return prettyDate(ymd(date));
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return prettyDate(ymd(date));
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bookingNotif(b: OwnerBookingRow): OwnerNotif {
  const created = parseDate(b.createdAt);
  const who = b.userName || 'A player';
  const when = [b.venueName, b.date ? prettyDate(b.date) : null, b.startTime ? to12h(b.startTime) : null]
    .filter(Boolean)
    .join(' · ');
  const base = {
    id: `booking:${b.id}`,
    kind: 'booking' as const,
    timestamp: created,
    timeLabel: timeAgo(created),
    target: { id: 'owner-bookings' } as Screen,
  };
  switch (b.status) {
    case 'pending_approval':
      // Actionable: no target — the row renders inline Confirm / Decline.
      return { ...base, target: undefined, booking: b, icon: 'bell', tone: 'coral', title: `New booking request · ${who}`, detail: when };
    case 'paid':
    case 'confirmed':
      return { ...base, icon: 'check', tone: 'blue', title: `Booking complete · ${who}`, detail: when };
    case 'cancelled':
      return { ...base, icon: 'close', tone: 'coral', title: `Booking cancelled · ${who}`, detail: when };
    default:
      return { ...base, icon: 'calendar', tone: 'blue', title: `Booking update · ${who}`, detail: when };
  }
}

function gameNotif(g: OwnerGameRow): OwnerNotif {
  const label = g.date ? prettyDate(g.date) : g.whenLabel || '';
  const detail = [g.title || 'Open play game', g.timeLabel].filter(Boolean).join(' · ');
  return {
    id: `game:${g.id}`,
    kind: 'game',
    icon: 'paddle',
    tone: 'blue',
    timestamp: null,
    timeLabel: label,
    title: `Game at ${g.venueName}`,
    detail,
    target: { id: 'games' },
  };
}

function reviewNotif(r: OwnerReviewRow): OwnerNotif {
  const stars = Math.round(r.rating || 0);
  return {
    id: `review:${r.rowId}`,
    kind: 'review',
    icon: 'star',
    tone: stars >= 4 ? 'lime' : 'coral',
    timestamp: null,
    timeLabel: '',
    title: `New ${stars}★ review · ${r.venueName}`,
    detail: r.text ? truncate(r.text, 90) : 'No comment left',
    target: { id: 'owner-venue', params: { id: r.venueRef, tab: 'reviews' } },
  };
}

export function deriveOwnerNotifications(data: {
  bookings: OwnerBookingRow[];
  games: OwnerGameRow[];
  reviews: OwnerReviewRow[];
}): OwnerNotif[] {
  const bookings = [...data.bookings]
    .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0))
    .map(bookingNotif);
  const games = [...data.games]
    .sort((a, b) => (parseDate(a.date)?.getTime() ?? Infinity) - (parseDate(b.date)?.getTime() ?? Infinity))
    .map(gameNotif);
  const reviews = data.reviews.map(reviewNotif);
  return [...bookings, ...games, ...reviews];
}
