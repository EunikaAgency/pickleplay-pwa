// Display formatters shared by the venue/court screens. The API data is real
// but sparse (lat/lng, ratings, amenities are often null), so everything here
// degrades gracefully — callers can render the result or hide the slot.

import type { ApiVenue } from './api';

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

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

/** Curated amenity chips if present, else derived from the boolean flags. */
export function venueAmenities(v: ApiVenue): string[] {
  if (v.amenityChips && v.amenityChips.length) return v.amenityChips;
  return AMENITY_FLAGS.filter((a) => v[a.key] === true).map((a) => a.label);
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

/** A Google Maps link — prefer the stored URL, then coords, then a name/address search. */
export function mapsUrl(
  v: Pick<ApiVenue, 'googleMapsUrl' | 'lat' | 'lng' | 'fullAddress' | 'displayName'>,
): string {
  if (v.googleMapsUrl) return v.googleMapsUrl;
  if (v.lat != null && v.lng != null) return `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`;
  const q = encodeURIComponent(v.fullAddress || v.displayName || '');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
