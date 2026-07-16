import { z } from 'zod';
import { DemandEvent, DEMAND_TYPES } from './demand.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { Court, VenueHour } from '../venues/venues.model.js';
import { Venue } from '../venues/venues.model.js';
import { resolveVenueId, getVenueManagerRole } from '../venues/venues.controller.js';

// "HH:MM" → hour 0–23, or null.
function hourOf(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):/.exec(t);
  return m ? Number(m[1]) : null;
}

const recordSchema = z.object({
  type: z.enum(DEMAND_TYPES),
  venueId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  courtId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startHour: z.coerce.number().int().min(0).max(23).optional(),
  query: z.string().max(200).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

/**
 * Record a demand signal. Public (optionalAuth) — guests browse too, and their
 * interest is exactly what we want to capture. Fire-and-forget from the client;
 * a bad/duplicate event is never worth failing a user action over, so this is
 * forgiving (best-effort insert, always 202).
 */
export async function recordDemandEvent(c: any) {
  const parsed = recordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid demand event' } }, 400);
  const body = parsed.data;
  const user = c.get('user');
  try {
    await DemandEvent.create({
      type: body.type,
      venueId: body.venueId || undefined,
      courtId: body.courtId || undefined,
      userId: user?.sub || undefined,
      date: body.date,
      startHour: body.startHour,
      query: body.query,
      meta: body.meta,
    });
  } catch {
    /* best-effort — never block the user's action on analytics capture */
  }
  return c.json({ data: { ok: true } }, 202);
}

/**
 * Server-side helper so other controllers (bookings) can log demand signals
 * without an HTTP round-trip. Best-effort; swallows errors. Not awaited by callers.
 */
export async function recordDemand(event: {
  type: typeof DEMAND_TYPES[number];
  venueId?: string | null;
  courtId?: string | null;
  userId?: string | null;
  date?: string | null;
  startHour?: number | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await DemandEvent.create({
      type: event.type,
      venueId: event.venueId || undefined,
      courtId: event.courtId || undefined,
      userId: event.userId || undefined,
      date: event.date || undefined,
      startHour: event.startHour ?? undefined,
      meta: event.meta,
    });
  } catch {
    /* best-effort */
  }
}

const demandQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional().default(30),
});

/**
 * Owner/manager demand report for a venue over the last N days: totals by signal
 * type, the attempt→completion conversion + cancellation rates, demand-by-hour
 * (when players try to book), and an unmet-demand / empty-supply read (open
 * court-hours that went unbooked over the window). Foundation for demand pricing.
 */
export async function getVenueDemand(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  // Demand is part of the money/analytics view — owner or a manager-role staffer.
  const role = await getVenueManagerRole(c, venueId);
  if (role !== 'owner' && role !== 'manager') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or a manager can view demand' } }, 403);
  }
  const { days } = demandQuerySchema.parse(c.req.query());
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await DemandEvent.find({ venueId, createdAt: { $gte: since } })
    .select('type startHour date createdAt')
    .lean<{ type: string; startHour?: number; date?: string; createdAt: Date }[]>();

  // Totals by signal type.
  const totals: Record<string, number> = { search: 0, venue_view: 0, booking_attempt: 0, booking_completed: 0, booking_cancelled: 0, empty_slot: 0, checkout_started: 0, checkout_abandoned: 0, booking_link_shared: 0 };
  // Demand by hour (when players try to book or hit a full slot) — 0..23.
  const demandByHour = new Array<number>(24).fill(0);
  for (const e of events) {
    totals[e.type] = (totals[e.type] ?? 0) + 1;
    if ((e.type === 'booking_attempt' || e.type === 'empty_slot') && e.startHour != null && e.startHour >= 0 && e.startHour < 24) {
      demandByHour[e.startHour] += 1;
    }
  }

  const attempts = totals.booking_attempt ?? 0;
  const completions = totals.booking_completed ?? 0;
  const conversionPct = attempts > 0 ? Math.round((completions / attempts) * 100) : null;
  const liveBookings = completions; // completed minus cancelled, floored at 0
  const cancelRate = (completions + (totals.booking_cancelled ?? 0)) > 0
    ? Math.round(((totals.booking_cancelled ?? 0) / (completions + (totals.booking_cancelled ?? 0))) * 100)
    : 0;

  // Empty-supply read: open court-hours over the window vs court-hours actually
  // booked. A coarse "how much capacity went unused" — the inverse of occupancy,
  // surfaced here so the demand view is self-contained.
  const [courtCount, hours, bookings] = await Promise.all([
    Court.countDocuments({ venueId, isActive: true }),
    VenueHour.find({ venueId, courtId: null }).select('dayOfWeek openTime closeTime isClosed').lean<{ dayOfWeek: number; openTime?: string; closeTime?: string; isClosed?: boolean }[]>(),
    Booking.find({ venueId, status: { $ne: 'cancelled' }, createdAt: { $gte: since } }).select('startTime endTime').lean<{ startTime?: string; endTime?: string }[]>(),
  ]);
  const courts = Math.max(1, courtCount);
  // Average open hours per day from the venue-default schedule.
  const openByDow = new Map<number, number>();
  for (const h of hours) {
    if (h.isClosed) { openByDow.set(h.dayOfWeek, 0); continue; }
    const o = hourOf(h.openTime); const cl = hourOf(h.closeTime);
    if (o != null && cl != null && cl > o) openByDow.set(h.dayOfWeek, cl - o);
  }
  const dailyOpenHours = openByDow.size ? [...openByDow.values()].reduce((a, b) => a + b, 0) / openByDow.size : 12;
  const openCourtHours = Math.round(dailyOpenHours * courts * days);
  const bookedCourtHours = bookings.reduce((sum, b) => {
    const s = hourOf(b.startTime); const e = hourOf(b.endTime);
    return sum + (s != null && e != null && e > s ? e - s : 1);
  }, 0);
  const emptyCourtHours = Math.max(0, openCourtHours - bookedCourtHours);
  const occupancyPct = openCourtHours > 0 ? Math.round((bookedCourtHours / openCourtHours) * 100) : 0;

  return c.json({
    data: {
      days,
      totals,
      conversionPct,
      cancelRate,
      liveBookings,
      demandByHour,
      supply: { openCourtHours, bookedCourtHours, emptyCourtHours, occupancyPct },
    },
  });
}

// ── Leakage report (owner-facing booking-funnel analytics) ─────────────────
// Shows how many venue views become booking starts → checkouts → completions,
// plus estimated offline (manual) bookings, so the owner can see how much
// revenue leaks off-platform. Gated by owner.bookings.manage (same as the
// bookings inbox — the demand view is the "understand my business" permission).
const leakageQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional().default(30),
});

export async function getVenueLeakageReport(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const role = await getVenueManagerRole(c, venueId);
  if (role !== 'owner' && role !== 'manager') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or a manager can view leakage' } }, 403);
  }
  const { days } = leakageQuerySchema.parse(c.req.query());
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await DemandEvent.find({ venueId, createdAt: { $gte: since } })
    .select('type date createdAt')
    .lean<{ type: string; date?: string; createdAt: Date }[]>();

  const count = (t: string) => events.filter((e) => e.type === t).length;
  const views = count('venue_view');
  const uniqueViewers = new Set(events.filter((e) => e.type === 'venue_view').map((e) => (e as any).userId?.toString()).filter(Boolean)).size;
  const bookingStarts = count('booking_attempt');
  const checkoutStarts = count('checkout_started');
  const checkoutAbandoned = count('checkout_abandoned');
  const onlineBookings = count('booking_completed');
  const linksShared = count('booking_link_shared');

  // Manual bookings (off-platform: walk-in/phone/messenger) — count for the window.
  const manualBookings = await Booking.countDocuments({
    venueId,
    bookingType: 'manual',
    status: { $ne: 'cancelled' },
    createdAt: { $gte: since },
  });

  const leakageRate = views > 0 ? Math.round(((views - onlineBookings) / views) * 100) : null;
  const checkoutDropoff = checkoutStarts > 0 ? Math.round(((checkoutStarts - onlineBookings) / checkoutStarts) * 100) : null;

  // Daily timeseries for the 4 key funnel stages.
  const byDate = new Map<string, { views: number; starts: number; checkouts: number; online: number }>();
  for (const e of events) {
    const d = e.date ?? e.createdAt.toISOString().slice(0, 10);
    const row = byDate.get(d) || { views: 0, starts: 0, checkouts: 0, online: 0 };
    if (e.type === 'venue_view') row.views++;
    else if (e.type === 'booking_attempt') row.starts++;
    else if (e.type === 'checkout_started') row.checkouts++;
    else if (e.type === 'booking_completed') row.online++;
    byDate.set(d, row);
  }
  const daily = [...byDate.entries()]
    .map(([date, row]) => ({ date, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({
    data: {
      days,
      funnel: { views, uniqueViewers, bookingStarts, checkoutStarts, checkoutAbandoned, onlineBookings, manualBookings, linksShared },
      leakageRate,
      checkoutDropoff,
      daily,
    },
  });
}
