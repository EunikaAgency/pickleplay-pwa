// Display formatters shared by the venue/court screens. The API data is real
// but sparse (lat/lng, ratings, amenities are often null), so everything here
// degrades gracefully — callers can render the result or hide the slot.

import { apiImageUrl, type ApiVenue, type ApiCourt } from './api';

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

/** The currency symbol for a venue's pricing currency ("₱", "$", …), or "". */
export function currencySymbol(code?: string | null): string {
  return CURRENCY_SYMBOLS[(code || '').toUpperCase()] ?? '';
}

/**
 * Per-hour price for the detail screen: "₱500/hr", or a range "₱300–₱500/hr"
 * when the venue's courts carry differing rates. A court's own `hourlyRate`
 * overrides the venue's flat `priceFrom`; courts without one fall back to it.
 * Null when there's no price at all.
 */
export function priceRangeLabel(
  v: Pick<ApiVenue, 'priceFrom' | 'priceFromLabel' | 'pricingCurrency'>,
  courts: Pick<ApiCourt, 'hourlyRate'>[] = [],
): string | null {
  const sym = currencySymbol(v.pricingCurrency);
  const base = typeof v.priceFrom === 'number' ? v.priceFrom : null;
  const rates = (courts.length
    ? courts.map((c) => (typeof c.hourlyRate === 'number' && c.hourlyRate > 0 ? c.hourlyRate : base))
    : [base]
  ).filter((r): r is number => typeof r === 'number' && r > 0);
  if (rates.length) {
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return min === max ? `${sym}${min}/hr` : `${sym}${min}–${sym}${max}/hr`;
  }
  // No numeric rate — reuse a server label, ensuring it reads per-hour.
  if (v.priceFromLabel) return /hr|hour/i.test(v.priceFromLabel) ? v.priceFromLabel : `${v.priceFromLabel}/hr`;
  return null;
}

/**
 * The venue's display image as an absolute URL, or null. Prefers the
 * media-derived `image`; falls back to the stored `mainImageUrl` hero path
 * (which most venues have but the media table doesn't). Both are resolved
 * against the API host — mirrors how the web renders venue photos.
 */
export function venueImage(v: Pick<ApiVenue, 'image' | 'mainImageUrl'>): string | null {
  return apiImageUrl(v.image) || apiImageUrl(v.mainImageUrl) || null;
}

/** "From ₱200" / a server-provided label / null when there's no price. */
export function priceLabel(v: Pick<ApiVenue, 'priceFrom' | 'priceFromLabel' | 'pricingCurrency'>): string | null {
  if (v.priceFromLabel) return v.priceFromLabel;
  if (v.priceFrom == null) return null;
  const sym = CURRENCY_SYMBOLS[(v.pricingCurrency || '').toUpperCase()] ?? '';
  return `${sym}${v.priceFrom}`;
}

/** "Indoor" / "Outdoor" / null — the source stores lowercase, so normalize. */
export function indoorLabel(v: Pick<ApiVenue, 'indoorOutdoor'>): string | null {
  if (!v.indoorOutdoor) return null;
  const s = v.indoorOutdoor.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Brgy. Camambugan · Daet" — area + city/region, blanks dropped. */
export function locationLine(v: Pick<ApiVenue, 'area' | 'city' | 'region'>): string {
  return [v.area, v.city || v.region].filter(Boolean).join(' · ');
}

const AMENITY_FLAGS: { key: keyof ApiVenue; label: string }[] = [
  { key: 'hasParking', label: 'Parking' },
  { key: 'hasToilets', label: 'Restrooms' },
  { key: 'hasShowers', label: 'Showers' },
  { key: 'hasFoodBeverage', label: 'Food & Drink' },
  { key: 'hasAc', label: 'Air-conditioned' },
  { key: 'hasLighting', label: 'Lighted' },
  { key: 'hasSeating', label: 'Seating' },
  { key: 'hasPaddleRental', label: 'Paddle rental' },
  { key: 'hasProShop', label: 'Pro shop' },
];

/** Curated amenity chips if present, else derived from the boolean flags + custom amenities. */
export function venueAmenities(v: ApiVenue): string[] {
  if (v.amenityChips && v.amenityChips.length) return v.amenityChips;
  const fromFlags = AMENITY_FLAGS.filter((a) => v[a.key] === true).map((a) => a.label);
  const custom = (v.customAmenities && v.customAmenities.length) ? v.customAmenities : [];
  return [...fromFlags, ...custom];
}

/** Up to 3 short tags for a list card: indoor/outdoor, beginner, open play, amenities. */
export function venueTags(v: ApiVenue): string[] {
  const tags: string[] = [];
  const io = indoorLabel(v);
  if (io) tags.push(io);
  if (v.isBeginnerFriendly) tags.push('Beginner-friendly');
  if (v.hasOpenPlay) tags.push('Open play');
  if (tags.length < 2) tags.push(...venueAmenities(v).slice(0, 2 - tags.length));
  return tags.slice(0, 3);
}

/**
 * A venue's `[lat, lng]` for map plotting, or null when unknown. Prefers the
 * stored `lat`/`lng`, then falls back to coordinates embedded in the Google
 * Maps URL: the `@<lat>,<lng>` viewport form, then the `!3d<lat>!4d<lng>` data
 * form. The seeded data almost never sets `lat`/`lng` directly, but most map
 * links carry the coordinates inline — so this recovers pins that would
 * otherwise be missing from the map.
 */
export function venueCoords(
  v: Pick<ApiVenue, 'lat' | 'lng' | 'googleMapsUrl'>,
): [number, number] | null {
  if (v.lat != null && v.lng != null) return [v.lat, v.lng];
  const url = v.googleMapsUrl;
  if (!url) return null;
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return [Number(at[1]), Number(at[2])];
  const data = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (data) return [Number(data[1]), Number(data[2])];
  return null;
}

/** A Google Maps link — prefer the stored URL, then coords, then a name/address search. */
export function mapsUrl(
  v: Pick<ApiVenue, 'googleMapsUrl' | 'lat' | 'lng' | 'fullAddress' | 'displayName'>,
): string {
  if (v.googleMapsUrl) return v.googleMapsUrl;
  if (v.lat != null && v.lng != null) return `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`;
  const q = encodeURIComponent(v.fullAddress || v.displayName || '');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
