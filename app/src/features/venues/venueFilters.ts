// Courts filter model + predicate, shared by NearbyScreen (which owns the state
// and applies it) and NearbyFilterSheet (which edits it). Kept out of the sheet
// component file so it can export plain values without tripping fast-refresh.

import type { ApiVenue } from '../../shared/lib/api';

/** The applied Courts filters. */
export interface VenueFilters {
  courtType: 'All' | 'Indoor' | 'Outdoor';
  price: 'Any' | 'Free' | 'Paid';
  /** Courts that host open play / drop-in games (the "Games here" chip). */
  openPlay: boolean;
  /** Selected amenity ApiVenue boolean keys (e.g. 'hasLighting'). */
  amenities: Set<string>;
  /** Radius in miles for "Near me" — only applies once the user is located. */
  maxDistanceMi: number;
}

// Slider bounds + the default radius applied when the user taps "Near me", so
// the list shows courts *near* them rather than every court sorted by distance.
export const MIN_DISTANCE_MI = 1;
export const MAX_DISTANCE_MI = 50;
export const DEFAULT_NEARBY_MI = 25;
const KM_PER_MI = 1.60934;

/** Miles → kilometres (venue distances are computed in km). */
export const milesToKm = (mi: number): number => mi * KM_PER_MI;

/** A fresh, empty filter set (own Set instance so callers never share state). */
export const makeDefaultFilters = (): VenueFilters => ({
  courtType: 'All',
  price: 'Any',
  openPlay: false,
  amenities: new Set(),
  maxDistanceMi: DEFAULT_NEARBY_MI,
});

// Amenities offered in the sheet, mapped to their ApiVenue boolean flag so the
// predicate can check them directly (mirrors AMENITY_FLAGS in venueDisplay).
// Only flags that actually carry data are offered — `hasToilets`/`hasProShop`
// are `true` for no seeded venue, so a chip for them would always return empty.
export const AMENITY_OPTIONS: { key: keyof ApiVenue; label: string }[] = [
  { key: 'hasParking', label: 'Parking' },
  { key: 'hasLighting', label: 'Lighted' },
  { key: 'hasSeating', label: 'Seating' },
  { key: 'hasAc', label: 'Air-conditioned' },
  { key: 'hasShowers', label: 'Showers' },
  { key: 'hasPaddleRental', label: 'Paddle rental' },
  { key: 'hasFoodBeverage', label: 'Food & drink' },
];

/**
 * How many attribute filters are narrowing the list. The distance radius is not
 * counted here — it belongs to the "Near me" mode, not the filter chips/badge.
 */
export function countActiveFilters(f: VenueFilters): number {
  let n = 0;
  if (f.courtType !== 'All') n++;
  if (f.price !== 'Any') n++;
  if (f.openPlay) n++;
  n += f.amenities.size;
  return n;
}

/**
 * Whether a venue passes the attribute filters (court type, price, open play,
 * amenities). The distance radius is applied separately in NearbyScreen, since
 * it depends on the user's location and needs a graceful fallback.
 */
export function matchesFilters(v: ApiVenue, f: VenueFilters): boolean {
  if (f.courtType !== 'All' && (v.indoorOutdoor || '').toLowerCase() !== f.courtType.toLowerCase()) {
    return false;
  }
  if (f.price === 'Free' && v.priceFrom !== 0) return false;
  if (f.price === 'Paid' && !(typeof v.priceFrom === 'number' && v.priceFrom > 0)) return false;
  if (f.openPlay && v.hasOpenPlay !== true) return false;
  const flags = v as unknown as Record<string, unknown>;
  for (const key of f.amenities) {
    if (flags[key] !== true) return false;
  }
  return true;
}
