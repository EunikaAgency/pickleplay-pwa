// Shared owner-dashboard data: loads the owner's venues, then per-venue
// analytics (for combined revenue/booking KPIs + each card's glance) and,
// optionally, per-venue bookings (for the cross-venue pending/upcoming lists on
// the owner home). One analytics call per venue, plus one bookings call per
// venue when `withBookings` — bounded by the (small) number of owned venues.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import {
  listOwnerVenues, getVenueAnalytics, getVenueBookings, listGames, getReviews, entityId,
  type ApiVenue, type ApiBooking, type ApiGame, type OwnerAnalytics, type OwnerReview,
} from '../../../shared/lib/api';
import { todayYMD } from '../../bookings/bookingDisplay';

export type Glance = { todayCount: number; pendingCount: number; todayRevenue: number };
export interface OwnerBookingRow extends ApiBooking {
  venueName: string;
}
export interface OwnerGameRow extends ApiGame {
  venueName: string;
}
export interface OwnerReviewRow extends OwnerReview {
  /** Stable id for the row (review id, namespaced by venue to avoid collisions). */
  rowId: string;
  venueName: string;
  venueId: string;
  /** slug (preferred) or id — used to deep-link to the owner-venue reviews tab. */
  venueRef: string;
}

const byDateTime = (a: ApiBooking, b: ApiBooking) => {
  const da = a.date || '';
  const db = b.date || '';
  return da === db ? (a.startTime || '').localeCompare(b.startTime || '') : da.localeCompare(db);
};

export function useOwnerDashboard(opts: { withBookings?: boolean; withGames?: boolean; withReviews?: boolean; withAnalytics?: boolean } = {}) {
  const { withBookings = false, withGames = false, withReviews = false, withAnalytics = true } = opts;
  const currentUser = useAuthStore((s) => s.user);
  const ownerId = currentUser?.id ?? '';
  const canAnalytics = withAnalytics && userHasPermission(currentUser, 'owner.analytics.view');

  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [analytics, setAnalytics] = useState<Record<string, OwnerAnalytics>>({});
  const [bookings, setBookings] = useState<OwnerBookingRow[]>([]);
  const [games, setGames] = useState<OwnerGameRow[]>([]);
  const [reviews, setReviews] = useState<OwnerReviewRow[]>([]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    listOwnerVenues(ownerId)
      .then((v) => { if (!cancelled) { setVenues(v); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [ownerId]);

  const retry = useCallback(() => {
    setStatus('loading');
    listOwnerVenues(ownerId)
      .then((v) => { setVenues(v); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, [ownerId]);

  // Analytics per venue → combined KPIs + per-card glance.
  useEffect(() => {
    if (!canAnalytics || venues.length === 0) return;
    let cancelled = false;
    Promise.allSettled(venues.map((v) => getVenueAnalytics(v.slug || v.id))).then((results) => {
      if (cancelled) return;
      const map: Record<string, OwnerAnalytics> = {};
      results.forEach((r, i) => { if (r.status === 'fulfilled') map[venueKey(venues[i])] = r.value; });
      setAnalytics(map);
    });
    return () => { cancelled = true; };
  }, [venues, canAnalytics]);

  // Bookings per venue (only when the consumer needs the actionable lists).
  useEffect(() => {
    if (!withBookings || venues.length === 0) return;
    let cancelled = false;
    Promise.allSettled(venues.map((v) => getVenueBookings(v.slug || v.id))).then((results) => {
      if (cancelled) return;
      const rows: OwnerBookingRow[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const v = venues[i];
        for (const b of r.value) rows.push({ ...b, venueId: b.venueId || v.id, venueName: v.displayName || 'Venue' });
      });
      setBookings(rows);
    });
    return () => { cancelled = true; };
  }, [withBookings, venues]);

  // Games per venue (community games played at the owner's courts).
  useEffect(() => {
    if (!withGames || venues.length === 0) return;
    let cancelled = false;
    // listGames matches the raw venueId (no slug resolution) — use the _id.
    Promise.allSettled(venues.map((v) => listGames({ venueId: v.id }))).then((results) => {
      if (cancelled) return;
      const rows: OwnerGameRow[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const v = venues[i];
        for (const g of r.value) rows.push({ ...g, venueId: g.venueId || v.id, venueName: v.displayName || 'Venue' });
      });
      setGames(rows);
    });
    return () => { cancelled = true; };
  }, [withGames, venues]);

  // Reviews per venue (only when the consumer needs them, e.g. notifications).
  useEffect(() => {
    if (!withReviews || venues.length === 0) return;
    let cancelled = false;
    Promise.allSettled(venues.map((v) => getReviews(v.slug || v.id))).then((results) => {
      if (cancelled) return;
      const rows: OwnerReviewRow[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const v = venues[i];
        const ref = v.slug || v.id;
        for (const review of r.value.items) {
          rows.push({ ...review, rowId: `${v.id}:${entityId(review)}`, venueName: v.displayName || 'Venue', venueId: v.id, venueRef: ref });
        }
      });
      setReviews(rows);
    });
    return () => { cancelled = true; };
  }, [withReviews, venues]);

  const combined = useMemo(() => {
    const vals = Object.values(analytics);
    return vals.reduce(
      (acc, a) => ({
        month: acc.month + a.kpis.revenue.month,
        week: acc.week + a.kpis.revenue.week,
        prevMonth: acc.prevMonth + a.kpis.revenue.prevMonth,
        todayBookings: acc.todayBookings + a.kpis.bookings.today,
        pending: acc.pending + a.kpis.bookings.pending,
      }),
      { month: 0, week: 0, prevMonth: 0, todayBookings: 0, pending: 0 },
    );
  }, [analytics]);

  // Bookings that happened in the current calendar month, summed across venues.
  // revenueDaily carries a per-day `bookings` count over a ~90-day window, so
  // the current month is always fully covered.
  const monthBookings = useMemo(() => {
    const prefix = todayYMD().slice(0, 7); // YYYY-MM
    let n = 0;
    for (const a of Object.values(analytics)) {
      for (const d of a.revenueDaily) if (d.date.startsWith(prefix)) n += d.bookings;
    }
    return n;
  }, [analytics]);

  // Daily revenue summed across venues by date → ascending series for a sparkline.
  const combinedRevenueDaily = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of Object.values(analytics)) {
      for (const d of a.revenueDaily) map.set(d.date, (map.get(d.date) || 0) + d.amount);
    }
    return [...map.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([, amount]) => amount);
  }, [analytics]);

  const statsReady = canAnalytics && Object.keys(analytics).length > 0;

  // Structural counts — used only when the user can't see analytics.
  const structural = useMemo(() => {
    const claimed = venues.filter((v) => v.state === 'claimed').length;
    const verified = venues.filter((v) => v.isVerified).length;
    const courts = venues.reduce((sum, v) => sum + (v.courtCount || 0), 0);
    return { total: venues.length, claimed, verified, courts };
  }, [venues]);

  const glanceFor = useCallback((v: ApiVenue): Glance | null => {
    const a = analytics[venueKey(v)];
    if (!a) return null;
    return { todayCount: a.kpis.bookings.today, pendingCount: a.kpis.bookings.pending, todayRevenue: a.kpis.revenue.today };
  }, [analytics]);

  const today = todayYMD();
  const pending = useMemo(
    () => bookings.filter((b) => b.status === 'pending_approval').sort(byDateTime),
    [bookings],
  );
  const upcoming = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled' && (b.date || '') >= today).sort(byDateTime),
    [bookings, today],
  );

  const removeBooking = useCallback((id: string) => setBookings((list) => list.filter((b) => b.id !== id)), []);
  // Replace a row in place after a status change (keeps the venueName tag).
  const updateBookingRow = useCallback((updated: ApiBooking) => {
    setBookings((list) => list.map((b) => (b.id === updated.id ? { ...b, ...updated, venueName: b.venueName } : b)));
  }, []);

  return {
    ownerId, canAnalytics, venues, status, retry,
    analyticsByVenue: analytics,
    combined, combinedRevenueDaily, monthBookings, statsReady, structural, glanceFor,
    bookings, pending, upcoming, removeBooking, updateBookingRow,
    games, reviews,
  };
}

/** Key a venue maps to in `analyticsByVenue` (matches the hook's internal keying). */
export function venueKey(v: ApiVenue): string {
  return v.id || v.slug || '';
}
