// Shared booking-pricing engine — the single source of truth for the effective
// hourly rate of a court booking, and the per-player surcharge. Pure functions so
// every booking surface (BookCourtScreen, CreateGame, CourtDetails, Front Desk)
// resolves a price the same way. Pricing is computed client-side and the resulting
// `amount` is sent to the API (existing convention), so this module is where the
// owner's pricing rules actually take effect.
//
// Rate precedence (most specific wins), per the chosen start hour:
//   1. surge        — owner's manual slot override for that date+time (absolute ₱/hr)
//   2. timeBlock    — VenueHour "hours pricing" block covering the slot (per-day, per-time)
//   3. holiday      — venue holiday rate, when the date is a configured holiday
//   4. weekend      — venue weekend rate, on Sat/Sun
//   5. subUnit      — split-court sub-unit rate
//   6. court        — the court's own hourly rate
//   7. venue        — the venue's flat priceFrom (fallback)
// The member discount (a % off) then applies to whatever rate resolved above.

import type { ApiVenue, ApiCourt, OwnerHourEntry, SlotPriceOverride } from './api';

export type RateSource = 'surge' | 'timeBlock' | 'holiday' | 'weekend' | 'subUnit' | 'court' | 'venue';

export interface RateBreakdown {
  /** Effective ₱/hr applied to the booking (after the member discount). */
  rate: number;
  /** The resolved rate before the member discount. */
  baseRate: number;
  /** Which rule produced the base rate. */
  source: RateSource;
  /** True when the venue's member discount was applied (viewer is a member). */
  memberApplied: boolean;
  /** The member discount % applied (0 when none). */
  memberDiscountPercent: number;
}

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

export function isWeekendDate(date: string): boolean {
  const d = dowOf(date);
  return d === 0 || d === 6;
}

export function isHolidayDate(date: string, holidayDates?: string[] | null): boolean {
  return !!holidayDates && holidayDates.includes(date);
}

/** The VenueHour "hours pricing" block rate covering this day+start, or null. */
function timeBlockRate(hours: OwnerHourEntry[] | undefined, date: string, startTime: string): number | null {
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

/** A surge override covering this date+start (court-scoped first, then venue-wide), or null. */
function surgeRate(
  overrides: SlotPriceOverride[] | undefined,
  date: string,
  startTime: string,
  courtId?: string | null,
): number | null {
  if (!overrides?.length) return null;
  const startMin = toMinutes(startTime);
  if (startMin == null) return null;
  const covers = (o: SlotPriceOverride) => {
    if (o.date !== date) return false;
    const s = toMinutes(o.startTime);
    const e = toMinutes(o.endTime);
    return s != null && e != null && startMin >= s && startMin < e;
  };
  // A court-specific override beats a venue-wide one.
  const courtSpecific = courtId ? overrides.find((o) => covers(o) && o.courtId === courtId) : null;
  if (courtSpecific) return courtSpecific.price;
  const venueWide = overrides.find((o) => covers(o) && !o.courtId);
  return venueWide?.price ?? null;
}

export interface ResolveRateInput {
  venue: Pick<ApiVenue, 'priceFrom' | 'weekendPrice' | 'holidayPrice' | 'holidayDates' | 'memberDiscountPercent'> | null | undefined;
  court?: ApiCourt | null;
  subUnitIndex?: number | null;
  hours?: OwnerHourEntry[];
  overrides?: SlotPriceOverride[];
  date: string;
  startTime: string;
  /** Whether the booking viewer is a member of this venue (member pricing applies). */
  isMember?: boolean;
}

/** Resolve the effective hourly rate for a booking slot, with a breakdown. */
export function resolveHourlyRate(input: ResolveRateInput): RateBreakdown {
  const { venue, court, subUnitIndex, hours, overrides, date, startTime, isMember } = input;

  const subUnitRate = (subUnitIndex != null && court?.subUnitRates?.length)
    ? (court.subUnitRates.find((r) => r.index === subUnitIndex)?.hourlyRate ?? null)
    : null;
  const courtRate = court?.hourlyRate != null ? court.hourlyRate : null;
  const venueRate = toNum(venue?.priceFrom) ?? 0;

  const surge = surgeRate(overrides, date, startTime, court?.id);
  const block = timeBlockRate(hours, date, startTime);
  const holiday = isHolidayDate(date, venue?.holidayDates) ? toNum(venue?.holidayPrice) : null;
  const weekend = isWeekendDate(date) ? toNum(venue?.weekendPrice) : null;

  let baseRate: number;
  let source: RateSource;
  if (surge != null) { baseRate = surge; source = 'surge'; }
  else if (block != null) { baseRate = block; source = 'timeBlock'; }
  else if (holiday != null) { baseRate = holiday; source = 'holiday'; }
  else if (weekend != null) { baseRate = weekend; source = 'weekend'; }
  else if (subUnitRate != null) { baseRate = subUnitRate; source = 'subUnit'; }
  else if (courtRate != null) { baseRate = courtRate; source = 'court'; }
  else { baseRate = venueRate; source = 'venue'; }

  const memberDiscountPercent = Math.max(0, Math.min(100, Number(venue?.memberDiscountPercent) || 0));
  const memberApplied = !!isMember && memberDiscountPercent > 0;
  const rate = memberApplied
    ? Math.round(baseRate * (1 - memberDiscountPercent / 100) * 100) / 100
    : baseRate;

  return { rate, baseRate, source, memberApplied, memberDiscountPercent };
}

/** The per-player surcharge for a booking — ₱ per head beyond the included threshold. */
export function perPlayerSurcharge(
  venue: Pick<ApiVenue, 'perPlayerFee' | 'perPlayerFeeThreshold'> | null | undefined,
  playerCount: number,
): number {
  const fee = toNum(venue?.perPlayerFee) ?? 0;
  if (fee <= 0) return 0;
  const threshold = Math.max(1, Number(venue?.perPlayerFeeThreshold) || 1);
  const extra = Math.max(0, Math.floor(playerCount) - threshold);
  return Math.round(fee * extra * 100) / 100;
}
