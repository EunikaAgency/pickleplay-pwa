// Server-side pricing resolver — mirrors the client-side pricing engine at
// app/src/shared/lib/pricing.ts. The 7-tier precedence and math are kept
// identical so server validation never diverges from what the client computes.
//
// Rate precedence (most specific wins), per the chosen start hour:
//   1. surge        — owner's manual slot override for that date+time
//   2. timeBlock    — VenueHour "hours pricing" block covering the slot
//   3. holiday      — venue holiday rate, when the date is a configured holiday
//   4. weekend      — venue weekend rate, on Sat/Sun
//   5. subUnit      — split-court sub-unit rate
//   6. court        — the court's own hourly rate
//   7. venue        — the venue's flat priceFrom (fallback)

import { Venue, Court, VenueHour, SlotPriceOverride } from '../venues/venues.model.js';

export type RateSource = 'surge' | 'timeBlock' | 'holiday' | 'weekend' | 'subUnit' | 'court' | 'venue';

export interface RateBreakdown {
  rate: number;
  baseRate: number;
  source: RateSource;
  memberApplied: boolean;
  memberDiscountPercent: number;
  customerCategory: 'none' | 'senior' | 'pwd';
  statutoryDiscountApplied: boolean;
  statutoryDiscountPercent: number;
  /** The SlotPriceOverride _id when source='surge', else undefined. */
  overrideId?: string;
}

// ── Pure helpers (byte-identical to the client-side pricing.ts) ──────────

const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** "HH:MM" → minutes since midnight, or null. */
function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Day-of-week for a YYYY-MM-DD string, 0=Sunday (local). */
function dowOf(date: string): number {
  return new Date(date + 'T00:00:00').getDay();
}

function isWeekendDate(date: string): boolean {
  const d = dowOf(date);
  return d === 0 || d === 6;
}

function isHolidayDate(date: string, holidayDates?: string[] | null): boolean {
  return !!holidayDates && holidayDates.includes(date);
}

/** A VenueHour "hours pricing" block covering this day+start, or null. */
function timeBlockRate(
  hours: { dayOfWeek: number; openTime?: string | null; closeTime?: string | null; price?: number | null; isClosed?: boolean }[] | undefined,
  date: string,
  startTime: string,
): number | null {
  if (!hours?.length) return null;
  const dow = dowOf(date);
  const startMin = toMinutes(startTime);
  if (startMin == null) return null;
  const match = hours.find((h) => {
    if (h.dayOfWeek !== dow || h.isClosed || h.price == null) return false;
    const open = toMinutes(h.openTime) ?? 0;
    const close = toMinutes(h.closeTime) ?? 1440;
    return startMin >= open && startMin < close;
  });
  return match?.price ?? null;
}

/**
 * SlotPriceOverride rows carrying one of these notes are *occupancy markers the
 * owner painted*, not prices — they're stored with `price: 0` purely because the
 * schema needs a number. They must never reach the rate ladder: as the
 * highest-precedence source, a `price: 0` override would sell the slot for ₱0.
 *
 * 'Maintenance' — owner closed the slot (no Booking behind it; see
 *   `maintenanceBlocksForDate` in bookings.controller.ts, which makes it block).
 * 'Reserved'    — painted alongside a manual reservation, which is a real
 *   confirmed Booking. That Booking is what blocks the slot.
 * 'Closed'      — the venue simply isn't trading that hour on that date. Needed
 *   once a venue has a recurring weekly default: leaving an hour unpainted then
 *   means "inherit the usual week", so there was no longer any way to say "shut,
 *   this date only". Distinct from 'Maintenance', which claims something is
 *   broken — this is just not open.
 */
export const BLOCK_NOTES = new Set(['Maintenance', 'Reserved', 'Closed']);

/** The notes with no Booking behind them, so they join the occupancy set themselves. */
export const OCCUPANCY_BLOCK_NOTES = ['Maintenance', 'Closed'];

export const isBlockOverride = (o: { note?: string | null }) => BLOCK_NOTES.has(o.note ?? '');

/** A surge override covering this date+start (court-scoped first, then venue-wide), or null. */
function surgeRate(
  overrides: { date: string; startTime: string; endTime: string; price: number; courtId?: any; note?: string | null; _id?: any }[] | undefined,
  date: string,
  startTime: string,
  courtId?: string | null,
): { price: number; overrideId: string } | null {
  if (!overrides?.length) return null;
  const startMin = toMinutes(startTime);
  if (startMin == null) return null;
  // Block markers are not prices — skip them so they can't win precedence at ₱0.
  const priced = overrides.filter((o) => !isBlockOverride(o));
  if (!priced.length) return null;
  const covers = (o: { date: string; startTime: string; endTime: string }) => {
    if (o.date !== date) return false;
    const s = toMinutes(o.startTime);
    const e = toMinutes(o.endTime);
    return s != null && e != null && startMin >= s && startMin < e;
  };
  // A court-specific override beats a venue-wide one. `o.courtId` is an ObjectId
  // off a lean doc while `courtId` is a string — compare stringified, or every
  // court-scoped override silently loses to the venue fallback.
  const courtSpecific = courtId ? priced.find((o) => covers(o) && o.courtId != null && String(o.courtId) === String(courtId)) : null;
  if (courtSpecific) return { price: courtSpecific.price, overrideId: String(courtSpecific._id) };
  const venueWide = priced.find((o) => covers(o) && !o.courtId);
  return venueWide ? { price: venueWide.price, overrideId: String(venueWide._id) } : null;
}

// ── Main resolver ────────────────────────────────────────────────────────

export interface ResolveRateParams {
  venueId: string;
  courtId?: string | null;
  subUnitIndex?: number | null;
  date: string;
  startTime: string;
  /** Whether the booking viewer is a member of this venue (member pricing applies). */
  isMember?: boolean;
  customerCategory?: 'none' | 'senior' | 'pwd';
}

/**
 * Resolve the effective hourly rate for a booking slot server-side.
 *
 * Fetches all pricing inputs from MongoDB (venue, court, hours, overrides)
 * and applies the identical 7-tier precedence as the client-side engine.
 */
export async function resolveHourlyRate(params: ResolveRateParams): Promise<RateBreakdown> {
  const { venueId, courtId, subUnitIndex, date, startTime, isMember, customerCategory = 'none' } = params;

  // Fetch all pricing inputs in parallel.
  const [venue, court, hours, overrides] = await Promise.all([
    Venue.findById(venueId).select('priceFrom weekendPrice holidayPrice holidayDates memberDiscountPercent statutoryDiscounts perPlayerFee perPlayerFeeThreshold').lean(),
    courtId ? Court.findById(courtId).select('hourlyRate subUnitRates').lean() : null,
    VenueHour.find({ venueId }).select('dayOfWeek openTime closeTime price isClosed').lean(),
    SlotPriceOverride.find({ venueId, date }).select('date startTime endTime price courtId note').lean(),
  ]);

  const subUnitRate = (subUnitIndex != null && (court as any)?.subUnitRates?.length)
    ? ((court as any).subUnitRates.find((r: any) => r.index === subUnitIndex)?.hourlyRate ?? null)
    : null;
  const courtRate = (court as any)?.hourlyRate != null ? (court as any).hourlyRate : null;
  const venueRate = toNum(venue?.priceFrom) ?? 0;

  const surge = surgeRate(overrides as any[], date, startTime, courtId);
  const block = timeBlockRate(hours as any[], date, startTime);
  const holiday = isHolidayDate(date, (venue as any)?.holidayDates) ? toNum((venue as any)?.holidayPrice) : null;
  const weekend = isWeekendDate(date) ? toNum((venue as any)?.weekendPrice) : null;

  let baseRate: number;
  let source: RateSource;
  let overrideId: string | undefined;
  if (surge != null) { baseRate = surge.price; source = 'surge'; overrideId = surge.overrideId; }
  else if (block != null) { baseRate = block; source = 'timeBlock'; }
  else if (holiday != null) { baseRate = holiday; source = 'holiday'; }
  else if (weekend != null) { baseRate = weekend; source = 'weekend'; }
  else if (subUnitRate != null) { baseRate = subUnitRate; source = 'subUnit'; }
  else if (courtRate != null) { baseRate = courtRate; source = 'court'; }
  else { baseRate = venueRate; source = 'venue'; }

  const memberDiscountPercent = Math.max(0, Math.min(100, Number((venue as any)?.memberDiscountPercent) || 0));
  const configuredStatutoryPercent = (venue as any)?.statutoryDiscounts
    ?.find((d: any) => d.category === customerCategory)?.percent;
  // Existing venue documents predate this field. The locked launch policy is
  // 20%, so missing configuration must not silently deny the statutory rate.
  // Preserve an explicit 0 if an administrator deliberately stored one.
  const statutoryDiscountPercent = customerCategory === 'none' ? 0 : Math.max(0, Math.min(100,
    configuredStatutoryPercent == null ? 20 : Number(configuredStatutoryPercent),
  ));
  const statutoryDiscountApplied = customerCategory !== 'none' && statutoryDiscountPercent > 0;
  const memberApplied = !statutoryDiscountApplied && !!isMember && memberDiscountPercent > 0;
  const appliedPercent = statutoryDiscountApplied ? statutoryDiscountPercent : memberApplied ? memberDiscountPercent : 0;
  const rate = appliedPercent > 0
    ? Math.round(baseRate * (1 - appliedPercent / 100) * 100) / 100
    : baseRate;

  return { rate, baseRate, source, memberApplied, memberDiscountPercent, customerCategory, statutoryDiscountApplied, statutoryDiscountPercent, overrideId };
}

/** Per-player surcharge — ₱ per head beyond the included threshold. Mirrors app pricing.ts. */
export function perPlayerSurcharge(
  venue: { perPlayerFee?: number | null; perPlayerFeeThreshold?: number | null } | null | undefined,
  playerCount: number,
): number {
  const fee = toNum(venue?.perPlayerFee) ?? 0;
  if (fee <= 0) return 0;
  const threshold = Math.max(1, Number(venue?.perPlayerFeeThreshold) || 1);
  const extra = Math.max(0, Math.floor(playerCount) - threshold);
  return Math.round(fee * extra * 100) / 100;
}
