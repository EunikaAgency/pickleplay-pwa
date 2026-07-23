// Formatters for the Nearby venue grid. The redesign surfaces member-vs-guest
// pricing, a booking-policy badge and an open-slot count — all derived from
// fields the venue list already returns, so every one of them degrades to
// "hide the slot" rather than inventing a value.

import type { ApiBooking, ApiVenue } from '../../../shared/lib/api';
import { currencySymbol, indoorLabel, venueAmenities, venueImage } from '../../../shared/lib/venueDisplay';

/** What the card shows in its price block. */
export interface VenueRates {
  /** Walk-in hourly rate, e.g. "₱700/hr". Null when the venue carries no numeric rate. */
  guest: string | null;
  /** Discounted hourly rate for venue members — null when there's no member discount. */
  member: string | null;
  /** Free-text fallback ("Pay to Play") for venues with a label but no number. */
  label: string | null;
}

/**
 * Member/guest hourly rates. `priceFrom` is the walk-in rate; members pay
 * `memberDiscountPercent` less. Venues with no numeric rate fall back to the
 * owner's free-text `priceFromLabel` so the card still says *something* about cost.
 */
export function venueRates(v: ApiVenue): VenueRates {
  const sym = currencySymbol(v.pricingCurrency);
  const base = typeof v.priceFrom === 'number' && v.priceFrom > 0 ? v.priceFrom : null;
  if (base == null) return { guest: null, member: null, label: v.priceFromLabel || null };
  const pct = typeof v.memberDiscountPercent === 'number' ? v.memberDiscountPercent : 0;
  const member = pct > 0 ? Math.round(base * (1 - pct / 100)) : null;
  return {
    guest: `${sym}${base}/hr`,
    member: member != null ? `${sym}${member}/hr` : null,
    label: null,
  };
}

/**
 * The indoor/outdoor pill over the photo. `tone` picks the fill. The source
 * field is free-ish text — "Indoor", "Outdoor", "Mixed" all occur — so only a
 * genuinely indoor venue earns the "/ Aircon" suffix; "Mixed" keeps its own
 * label rather than being mislabelled as indoor.
 */
export function venueTypeBadge(v: ApiVenue): { label: string; tone: 'indoor' | 'outdoor' } | null {
  const io = indoorLabel(v);
  if (!io) return null;
  if (io === 'Outdoor') return { label: 'Outdoor', tone: 'outdoor' };
  // Air-conditioning is the thing players actually pick an indoor court for.
  if (io === 'Indoor') return { label: v.hasAc ? 'Indoor / Aircon' : 'Indoor', tone: 'indoor' };
  return { label: io, tone: 'indoor' };
}

/**
 * How many clock-hours have at least one free court, from the batch
 * availability endpoint's per-hour free-court counts. Null when we haven't
 * loaded availability for this venue — the card then hides the badge rather
 * than claiming "0 slots open" for a venue we simply didn't check.
 */
export function openSlotCount(freeByHour: number[] | undefined): number | null {
  if (!freeByHour) return null;
  return freeByHour.reduce((n, free) => n + (free > 0 ? 1 : 0), 0);
}

/** "6 PM" / "12 NN" / "12 MN" — compact hour label for the time-range pickers. */
export function hourLabel(h: number): string {
  if (h === 0) return '12 MN';
  if (h === 12) return '12 NN';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/**
 * Whether a venue has a court free for EVERY hour of [startHour, endHour) —
 * the question a player booking a 6–8 PM slot is actually asking. A venue we
 * have no availability row for fails: we can't promise a court we never checked.
 */
export function freeAcrossWindow(
  freeByHour: number[] | undefined,
  startHour: number,
  endHour: number | null,
): boolean {
  if (!freeByHour) return false;
  const end = Math.min(endHour ?? startHour + 1, 24);
  for (let h = startHour; h < end; h++) {
    if ((freeByHour[h] ?? 0) <= 0) return false;
  }
  return true;
}

/** Up to `max` amenity chips for the card footer. */
export function cardAmenities(v: ApiVenue, max = 3): string[] {
  return venueAmenities(v).slice(0, max);
}

/** The area a venue is filtered by — its city, else the free-text region. */
export function venueArea(v: ApiVenue): string | null {
  return v.city || v.region || null;
}

/** Today as YYYY-MM-DD in the *device's* timezone (not UTC). */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "JUL 12" — the compact last-played stamp on the recent-venues rail. */
export function shortDayStamp(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

/* ─── "Venues you've played at recently" ─────────────────────────── */

/** One venue the signed-in player has actually played at. */
export interface RecentVenue {
  venueId: string;
  /** What to navigate with — the venue slug when we resolved it, else its id. */
  target: string;
  name: string;
  image: string | null;
  playCount: number;
  /** "JUL 12" — when they last played here. */
  lastPlayed: string;
  /** "₱450/hr", plus whether that figure is the member rate. */
  rate: string | null;
  rateIsMember: boolean;
}

/**
 * Roll the player's bookings up into "venues you've played at recently".
 *
 * Only past, non-cancelled bookings count — a court booked for next Tuesday
 * isn't somewhere you've *played*, and a cancelled one never happened. Ordered
 * by most-recently played, ties broken by play count.
 */
export function deriveRecentVenues(
  bookings: ApiBooking[],
  venuesById: Map<string, ApiVenue>,
  limit = 4,
): RecentVenue[] {
  const today = localToday();
  const byVenue = new Map<string, { name: string; slug: string | null; count: number; last: string }>();

  for (const b of bookings) {
    const id = b.venueId;
    const date = b.date;
    if (!id || !date) continue;
    if (b.status === 'cancelled') continue;
    if (date > today) continue;
    const prev = byVenue.get(id);
    if (prev) {
      prev.count += 1;
      if (date > prev.last) prev.last = date;
    } else {
      byVenue.set(id, {
        name: b.venueName || venuesById.get(id)?.displayName || 'Venue',
        slug: b.venueSlug ?? null,
        count: 1,
        last: date,
      });
    }
  }

  return [...byVenue.entries()]
    .sort((a, b) => (a[1].last === b[1].last ? b[1].count - a[1].count : a[1].last < b[1].last ? 1 : -1))
    .slice(0, limit)
    .map(([venueId, agg]) => {
      const v = venuesById.get(venueId);
      const rates = v ? venueRates(v) : null;
      return {
        venueId,
        target: agg.slug || v?.slug || venueId,
        name: v?.displayName || agg.name,
        image: v ? venueImage(v) : null,
        playCount: agg.count,
        lastPlayed: shortDayStamp(agg.last),
        // Prefer the member rate — a returning player is the one most likely to
        // hold a membership here, and it's the number that brings them back.
        rate: rates?.member ?? rates?.guest ?? null,
        rateIsMember: !!rates?.member,
      };
    });
}
