// Client-side aggregation helpers for the owner dashboard. Pure + framework-
// free, co-located with the owner feature (like games/gameDisplay.ts). The
// heavy lifting (KPIs, daily series, peak hours) is done server-side in
// getVenueAnalytics; these helpers re-bucket the daily revenue series for the
// Day/Week/Month toggle and derive the lighter glance/preview numbers from a
// raw bookings list (used where we don't fetch full analytics).

import type { ApiBooking, OwnerAnalytics } from '../../../shared/lib/api';
import { todayYMD } from '../../bookings/bookingDisplay';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYMD(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}

export type RevenueBucket = 'day' | 'week' | 'month';
export interface RevenuePoint {
  label: string;
  amount: number;
}

export interface DailyRevenue {
  date: string;
  amount: number;
}

/** Re-bucket the daily revenue series for the Day/Week/Month toggle. */
export function bucketRevenue(daily: DailyRevenue[], mode: RevenueBucket): RevenuePoint[] {
  if (mode === 'day') {
    return daily.slice(-14).map((d) => ({ label: String(parseYMD(d.date).getDate()), amount: d.amount }));
  }
  const map = new Map<string, { order: string; label: string; amount: number }>();
  if (mode === 'week') {
    for (const d of daily) {
      const m = mondayOf(parseYMD(d.date));
      const key = ymd(m);
      const cur = map.get(key) || { order: key, label: `${m.getMonth() + 1}/${m.getDate()}`, amount: 0 };
      cur.amount += d.amount;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => (a.order < b.order ? -1 : 1)).slice(-12).map(({ label, amount }) => ({ label, amount }));
  }
  for (const d of daily) {
    const dt = parseYMD(d.date);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const cur = map.get(key) || { order: key, label: MONTHS[dt.getMonth()], amount: 0 };
    cur.amount += d.amount;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => (a.order < b.order ? -1 : 1)).map(({ label, amount }) => ({ label, amount }));
}

/** Lightweight glance numbers from a raw bookings list (no analytics call). */
export function summarizeFromBookings(bookings: ApiBooking[]) {
  const today = todayYMD();
  let todayCount = 0;
  let pendingCount = 0;
  let upcomingCount = 0;
  let todayRevenue = 0;
  for (const b of bookings) {
    const st = b.status;
    const date = b.date || '';
    if (st === 'pending_approval') pendingCount += 1;
    if (st !== 'cancelled' && date === today) todayCount += 1;
    if (st !== 'cancelled' && date >= today) upcomingCount += 1;
    if ((st === 'confirmed' || st === 'paid') && date === today) todayRevenue += b.amount || 0;
  }
  return { todayCount, pendingCount, upcomingCount, todayRevenue };
}

/** Next few non-cancelled bookings, soonest first. */
export function upcomingPreview(bookings: ApiBooking[], n = 4): ApiBooking[] {
  const today = todayYMD();
  return bookings
    .filter((b) => b.status !== 'cancelled' && (b.date || '') >= today)
    .sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return da === db ? (a.startTime || '').localeCompare(b.startTime || '') : da.localeCompare(db);
    })
    .slice(0, n);
}

/** Percent change vs a previous period (100% when growing from zero). */
export function pctChange(curr: number, prev: number): number {
  if (prev > 0) return Math.round(((curr - prev) / prev) * 100);
  return curr > 0 ? 100 : 0;
}

/* ─── Cross-venue aggregation (for the global Insights screen) ─────── */

type BookingsDay = { date: string; confirmed: number; paid: number; pending: number; cancelled: number };

/** Sum each venue's daily bookings-by-status into one ascending series. */
export function mergeBookingsDaily(list: OwnerAnalytics[]): BookingsDay[] {
  const map = new Map<string, BookingsDay>();
  for (const a of list) {
    for (const d of a.bookingsDaily) {
      const cur = map.get(d.date) || { date: d.date, confirmed: 0, paid: 0, pending: 0, cancelled: 0 };
      cur.confirmed += d.confirmed; cur.paid += d.paid; cur.pending += d.pending; cur.cancelled += d.cancelled;
      map.set(d.date, cur);
    }
  }
  return [...map.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** Sum peak-hours cells across venues (dayOfWeek × hour). */
export function mergePeakHours(list: OwnerAnalytics[]): { dayOfWeek: number; hour: number; bookings: number }[] {
  const map = new Map<string, { dayOfWeek: number; hour: number; bookings: number }>();
  for (const a of list) {
    for (const p of a.peakHours) {
      const key = `${p.dayOfWeek}-${p.hour}`;
      const cur = map.get(key) || { dayOfWeek: p.dayOfWeek, hour: p.hour, bookings: 0 };
      cur.bookings += p.bookings;
      map.set(key, cur);
    }
  }
  return [...map.values()];
}

/** Merge top customers across venues by userId (sum spend/bookings), top N. */
export function mergeTopCustomers(list: OwnerAnalytics[], n = 8): { userId: string; name: string; bookings: number; spend: number }[] {
  const map = new Map<string, { userId: string; name: string; bookings: number; spend: number }>();
  for (const a of list) {
    for (const c of a.topCustomers) {
      const cur = map.get(c.userId) || { userId: c.userId, name: c.name, bookings: 0, spend: 0 };
      cur.bookings += c.bookings; cur.spend += c.spend;
      map.set(c.userId, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.spend - x.spend).slice(0, n);
}
