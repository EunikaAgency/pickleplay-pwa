import { apiGet, apiImageUrl } from '../../shared/api/client.js';

// Normalize an API venue document into the shape the venues UI expects.
// Keeps the originals on `raw` for screens that need richer data.
function normalizeVenue(v) {
  if (!v) return null;
  const isIndoor = (v.indoorOutdoor || '').toLowerCase() === 'indoor';
  return {
    id: v._id,
    slug: v.slug,
    name: v.displayName,
    venueId: v.venueId,
    city: v.area || v.region || '',
    region: v.region,
    country: v.country,
    fullAddress: v.fullAddress,
    courtCount: v.courtCount ?? 0,
    surface: v.surfaceType || '',
    indoorOutdoor: v.indoorOutdoor,
    isIndoor,
    accessType: v.allowsWalkins === 'true' ? 'public' : (v.allowsWalkins === 'false' ? 'private' : ''),
    isPartner: !!v.isVerified,
    isClaimed: v.state === 'claimed',
    rating: v.googleRating ?? null,
    reviewCount: v.googleReviewCount ?? 0,
    heroImage: apiImageUrl(v.mainImageUrl),
    gallery: (v.galleryImageUrls || []).map(apiImageUrl),
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    description: v.description || v.oneLineSummary || '',
    summary: v.oneLineSummary || '',
    priceFrom: v.priceFrom ?? null,
    pricingCurrency: v.pricingCurrency || 'PHP',
    phone: v.phonePrimary || v.phone || '',
    email: v.email || '',
    website: v.website || '',
    bookingUrl: v.bookingUrl || v.externalBookingUrl || '',
    amenities: collectAmenities(v),
    raw: v,
  };
}

function collectAmenities(v) {
  const flags = {
    Parking: v.amenityParking,
    Showers: v.amenityShowers,
    Lockers: v.amenityLockers,
    'Air conditioning': v.amenityAirConditioning,
    'Tournament lighting': v.amenityTournamentLighting,
    'Seating area': v.amenitySeatingArea,
    'Water refill': v.amenityWaterRefill,
    'Cafe / food': v.amenityCafeFood,
    'Paddle rental': v.amenityPaddleRental,
    'Pro shop': v.amenityProShop,
    Wifi: v.amenityWifi,
    'Covered terrace': v.amenityCoveredTerrace,
  };
  return Object.entries(flags)
    .filter(([, val]) => val === 'true' || val === true)
    .map(([label]) => label);
}

export async function fetchVenues({ limit = 200, signal } = {}) {
  const res = await apiGet(`/api/v1/venues?limit=${limit}`, { signal });
  return (res?.data || []).map(normalizeVenue);
}

export async function fetchVenueBySlug(slug, { signal } = {}) {
  const res = await apiGet(`/api/v1/venues/${encodeURIComponent(slug)}`, { signal });
  return normalizeVenue(res?.data || res);
}

export async function fetchCities({ signal } = {}) {
  const res = await apiGet('/api/v1/cities?limit=200', { signal });
  return (res?.data || []).map((c) => ({
    id: c._id,
    slug: c.slug,
    name: c.name,
    region: c.region || '',
    venueCount: c.venueCount ?? 0,
    raw: c,
  }));
}
