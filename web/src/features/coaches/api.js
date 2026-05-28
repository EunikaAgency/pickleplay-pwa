import { apiGet, apiImageUrl } from '../../shared/api/client.js';

function normalizeCoach(c) {
  if (!c) return null;
  return {
    id: c._id,
    slug: c.slug,
    coachId: c.coachId,
    name: c.displayName,
    roleLabel: c.coachRoleLabel || '',
    specialty: c.specialty || '',
    certifications: c.certifications || [],
    languages: c.languages || [],
    location: c.location || c.cityPrimary || '',
    region: c.regionsServed?.join(', ') || '',
    rating: c.rating ?? null,
    reviewCount: c.reviewCount ?? 0,
    bio: c.bio || '',
    yearsExperience: c.experienceYears ?? null,
    duprRating: c.duprRating ?? null,
    avatar: apiImageUrl(c.avatarUrl || c.imageUrl),
    rateFrom: c.rateFrom ?? c.pricePrivatePerHour ?? null,
    pricePrivate: c.pricePrivatePerHour ?? null,
    priceGroup: c.priceGroupPerPlayer ?? null,
    priceCurrency: c.priceCurrency || 'PHP',
    phone: c.phone || '',
    email: c.email || '',
    website: c.websiteUrl || '',
    facebook: c.facebookUrl || '',
    instagram: c.instagramUrl || '',
    bookingUrl: c.externalBookingUrl || '',
    isVerified: !!c.isVerified,
    isLeadAnywhere: !!c.isLeadCoachAnywhere,
    raw: c,
  };
}

export async function fetchCoaches({ limit = 200, signal } = {}) {
  const res = await apiGet(`/api/v1/coaches?limit=${limit}`, { signal });
  return (res?.data || []).map(normalizeCoach);
}
