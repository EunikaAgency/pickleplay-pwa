import { z } from 'zod';
import { DemandEvent, DEMAND_TYPES } from './demand.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { WaitlistEntry } from '../bookings/bookings.model.js';
import { Court, VenueHour, SlotPriceOverride } from '../venues/venues.model.js';
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

// ── Suggested dynamic pricing ───────────────────────────────────────────────
// Analyses booking density + unmet demand per day-of-week × hour and recommends
// price adjustments. The owner reviews and applies suggestions — the platform
// never changes prices automatically. Needs ≥14 days of data to be meaningful.

const suggestQuerySchema = z.object({
  days: z.coerce.number().int().min(14).max(365).optional().default(90),
});

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface HourBucket {
  dow: number;            // 0=Sun … 6=Sat
  hour: number;           // 0–23
  bookings: number;
  emptySlotEvents: number;
  waitlistCount: number;
  occupancyPct: number;   // 0–100
  currentPrice: number;   // resolved hourly rate
  suggestedPrice: number;
  adjustmentPct: number;  // e.g. +20 or -15
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export async function getSuggestedPricing(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const role = await getVenueManagerRole(c, venueId);
  if (role !== 'owner' && role !== 'manager') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or a manager can view pricing suggestions' } }, 403);
  }

  const { days } = suggestQuerySchema.parse(c.req.query());
  const since = new Date();
  since.setDate(since.getDate() - days);

  // 1. Fetch venue, courts, and current pricing.
  const [venue, courts, venueHours, bookings, emptySlotEvents, waitlistEntries] = await Promise.all([
    Venue.findById(venueId).select('priceFrom peakPrice offPeakPrice weekendPrice holidayPrice perPlayerFee perPlayerFeeThreshold').lean(),
    Court.find({ venueId, isActive: true }).select('hourlyRate').lean<{ hourlyRate?: number }[]>(),
    VenueHour.find({ venueId, courtId: null, isClosed: { $ne: true } }).select('dayOfWeek openTime closeTime price').lean<{ dayOfWeek: number; openTime?: string; closeTime?: string; price?: number }[]>(),
    Booking.find({
      venueId,
      status: { $nin: ['cancelled', 'pending_approval'] },
      bookingType: { $nin: ['blocked', 'manual'] },
      createdAt: { $gte: since },
    }).select('date startTime endTime amount').lean<{ date?: string; startTime?: string; endTime?: string; amount?: number }[]>(),
    DemandEvent.find({
      venueId,
      type: 'empty_slot',
      createdAt: { $gte: since },
    }).select('startHour').lean<{ startHour?: number }[]>(),
    WaitlistEntry.find({
      venueId,
      status: 'waiting',
      createdAt: { $gte: since },
    }).select('startTime').lean<{ startTime?: string }[]>(),
  ]);

  // 2. Resolve the base hourly rate.
  const baseRate = courts.length > 0
    ? courts.reduce((sum, c) => sum + (c.hourlyRate ?? venue?.priceFrom ?? 200), 0) / courts.length
    : (venue?.priceFrom ?? 200);

  // 3. Build a lookup of current price per (dow, hour) from VenueHour.
  const currentPriceMap = new Map<string, number>();
  for (const vh of venueHours) {
    const o = hourOf(vh.openTime);
    const cl = hourOf(vh.closeTime);
    if (o == null || cl == null) continue;
    for (let h = o; h < cl; h++) {
      const key = `${vh.dayOfWeek}:${h}`;
      currentPriceMap.set(key, vh.price ?? baseRate);
    }
  }

  // 4. Compute the venue's opening hours per day-of-week.
  const openHoursByDow = new Map<number, { open: number; close: number }>();
  for (const vh of venueHours) {
    const o = hourOf(vh.openTime);
    const cl = hourOf(vh.closeTime);
    if (o == null || cl == null) continue;
    const cur = openHoursByDow.get(vh.dayOfWeek);
    if (!cur || o < cur.open) openHoursByDow.set(vh.dayOfWeek, { open: o, close: Math.max(cur?.close ?? cl, cl) });
    else if (cl > cur.close) openHoursByDow.set(vh.dayOfWeek, { open: cur.open, close: cl });
  }

  // 5. Aggregate bookings by (dow, hour).
  const bookingMap = new Map<string, { count: number; totalAmount: number }>();
  for (const b of bookings) {
    if (!b.date || !b.startTime) continue;
    const d = new Date(`${b.date}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    const dow = d.getDay();
    const sh = hourOf(b.startTime);
    const eh = hourOf(b.endTime);
    if (sh == null || eh == null) continue;
    for (let h = sh; h < eh; h++) {
      const key = `${dow}:${h}`;
      const cur = bookingMap.get(key) || { count: 0, totalAmount: 0 };
      cur.count++;
      cur.totalAmount += (b.amount ?? baseRate);
      bookingMap.set(key, cur);
    }
  }

  // 6. Aggregate empty_slot events by (dow, hour).
  const emptySlotMap = new Map<string, number>();
  for (const e of emptySlotEvents) {
    if (e.startHour == null) continue;
    // We don't have the day-of-week for events, so distribute across all days.
    // A more precise implementation would store date on empty_slot events.
    for (let dow = 0; dow < 7; dow++) {
      const key = `${dow}:${e.startHour}`;
      emptySlotMap.set(key, (emptySlotMap.get(key) || 0) + 1);
    }
  }

  // 7. Aggregate waitlist entries by (dow, hour).
  const waitlistMap = new Map<string, number>();
  for (const w of waitlistEntries) {
    const h = hourOf(w.startTime);
    if (h == null) continue;
    for (let dow = 0; dow < 7; dow++) {
      const key = `${dow}:${h}`;
      waitlistMap.set(key, (waitlistMap.get(key) || 0) + 1);
    }
  }

  // 8. Build suggestions for every open (dow, hour).
  const weeks = Math.max(1, Math.round(days / 7));
  const suggestions: HourBucket[] = [];

  for (let dow = 0; dow < 7; dow++) {
    const hours = openHoursByDow.get(dow);
    if (!hours) continue;
    for (let h = hours.open; h < hours.close; h++) {
      const key = `${dow}:${h}`;
      const bucket = bookingMap.get(key);
      const bookingCount = bucket?.count ?? 0;
      const emptyCount = emptySlotMap.get(key) ?? 0;
      const waitlistCount = waitlistMap.get(key) ?? 0;
      // Max possible bookings = weeks × courts.length (one booking per court per hour per week)
      const maxPossible = weeks * Math.max(1, courts.length);
      const occupancyPct = maxPossible > 0 ? Math.round((bookingCount / maxPossible) * 100) : 0;
      const currentPrice = currentPriceMap.get(key) ?? baseRate;
      const avgPaid = bucket && bucket.count > 0 ? Math.round(bucket.totalAmount / bucket.count) : currentPrice;

      // Heuristic classification.
      let adjustmentPct = 0;
      let confidence: 'low' | 'medium' | 'high' = 'low';
      let rationale = '';

      if (occupancyPct >= 85 || emptyCount >= weeks * 0.5 || waitlistCount >= weeks * 0.3) {
        // High demand — suggest increase.
        if (occupancyPct >= 95) { adjustmentPct = 30; confidence = 'high'; rationale = 'Near-full occupancy with unmet demand'; }
        else if (occupancyPct >= 85) { adjustmentPct = 20; confidence = 'medium'; rationale = 'High occupancy — room to raise rates'; }
        else if (waitlistCount >= weeks) { adjustmentPct = 15; confidence = 'medium'; rationale = `~${Math.round(waitlistCount / weeks)} waitlisted/week — excess demand`; }
        else { adjustmentPct = 10; confidence = 'low'; rationale = 'Some unmet demand detected'; }
      } else if (occupancyPct <= 25 && emptyCount === 0 && waitlistCount === 0 && bookingCount < weeks * 0.5) {
        // Low demand — suggest decrease.
        if (occupancyPct <= 10 && bookingCount <= 1) { adjustmentPct = -20; confidence = 'medium'; rationale = 'Very low utilisation — consider a discount to attract players'; }
        else { adjustmentPct = -10; confidence = 'low'; rationale = 'Below-average bookings — a small drop may help'; }
      } else if (bookingCount === 0 && emptyCount === 0 && waitlistCount === 0) {
        // No data — skip (no signal).
        continue;
      } else {
        // Normal — no suggestion needed.
        continue;
      }

      const suggestedPrice = Math.round(currentPrice * (1 + adjustmentPct / 100));

      suggestions.push({
        dow, hour: h,
        bookings: bookingCount,
        emptySlotEvents: emptyCount,
        waitlistCount,
        occupancyPct,
        currentPrice,
        suggestedPrice,
        adjustmentPct,
        confidence,
        rationale,
      });
    }
  }

  // Sort: high-confidence first, then by occupancy descending.
  suggestions.sort((a, b) => {
    const conf = { high: 0, medium: 1, low: 2 };
    const c = conf[a.confidence] - conf[b.confidence];
    if (c !== 0) return c;
    return b.occupancyPct - a.occupancyPct;
  });

  return c.json({
    data: {
      venueId,
      days,
      baseRate,
      courtCount: courts.length,
      suggestions: suggestions.slice(0, 50), // cap at 50 suggestions
      summary: {
        total: suggestions.length,
        highDemand: suggestions.filter((s) => s.adjustmentPct > 0).length,
        lowDemand: suggestions.filter((s) => s.adjustmentPct < 0).length,
      },
    },
  });
}

// ── Apply pricing suggestions ────────────────────────────────────────────────
// Accepts a list of (dow, hour, price) entries and creates SlotPriceOverride
// rows for the next N weeks. Owner-gated.

const applySuggestionsSchema = z.object({
  suggestions: z.array(z.object({
    dow: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    price: z.number().min(0),
  })),
  weeks: z.number().int().min(1).max(12).optional().default(4),
});

export async function applySuggestedPricing(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const role = await getVenueManagerRole(c, venueId);
  if (role !== 'owner' && role !== 'manager') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or a manager can apply pricing' } }, 403);
  }

  const body = applySuggestionsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid suggestions payload', details: body.error.issues } }, 400);

  const { suggestions, weeks } = body.data;
  if (suggestions.length === 0) return c.json({ data: { created: 0 } });

  const created: unknown[] = [];
  const today = new Date();

  for (const sug of suggestions) {
    for (let w = 0; w < weeks; w++) {
      // Find the next occurrence of the target day-of-week.
      const d = new Date(today);
      d.setDate(d.getDate() + w * 7);
      const currentDow = d.getDay();
      let offset = sug.dow - currentDow;
      if (offset < 0) offset += 7;
      d.setDate(d.getDate() + offset);

      const dateStr = d.toISOString().slice(0, 10);
      const startTime = `${String(sug.hour).padStart(2, '0')}:00`;
      const endTime = `${String(sug.hour + 1).padStart(2, '0')}:00`;

      // Upsert: update existing override or create new one.
      const existing = await SlotPriceOverride.findOneAndUpdate(
        { venueId, date: dateStr, startTime, endTime, courtId: null },
        { price: sug.price, note: `Dynamic pricing suggestion (${weeks}w batch)`, createdByUserId: c.get('user')?.sub },
        { upsert: true, new: true },
      );
      created.push(existing);
    }
  }

  return c.json({ data: { created: created.length, weeks } }, 201);
}
