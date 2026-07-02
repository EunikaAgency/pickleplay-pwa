import { z } from 'zod';
import { Types } from 'mongoose';
import { Venue, VenueHour, Faq, HolidayClosure, VenueStaff, VenueMember, SlotPriceOverride, Court, SubscriptionPlan, SubscriptionPlanVersion, VenueSubscription } from './venues.model.js';
import { VenuePricing } from '../payments/payments.model.js';
import { VenueClaim } from './venue-management.model.js';
import { sendEmail, isGmailConfigured, hasValidTokens } from '../../shared/lib/gmail.js';
import { bookingApprovedReceipt, membershipReceipt } from '../../shared/lib/email-templates.js';

const canEmail = () => isGmailConfigured() && hasValidTokens();
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtTime = (t?: string | null) => { if (!t) return ''; const [h, m] = t!.split(':'); const hr = +h; const a = hr < 12 ? 'AM' : 'PM'; const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr; return `${h12}:${m} ${a}`; };
import { Media } from '../media/media.model.js';
import { Review } from '../interactions/interactions.model.js';
import { OpenPlaySession } from '../content/content.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { CoachApplication } from '../coach-applications/coach-applications.model.js';
import { User } from '../auth/auth.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { resolveVenueCapacity, freeCourtsByHour, courtFreeHoursWithTurnover, hoursTouched, activeBookingsForDate, expireOverdueBookings, findSlotConflict } from '../bookings/bookings.controller.js';
import { hasPermission, effectiveOwnerId } from '../../shared/lib/permissions.js';
import { notifyUser } from '../../shared/lib/notify.js';

/* ─── Schemas ─────────────────────────────────────────────────────── */

export const listQuery = z.object({
  city: z.string().optional(),
  search: z.string().optional(),
  hasOpenPlay: z.coerce.boolean().optional(),
  hasCoaching: z.coerce.boolean().optional(),
  isBeginnerFriendly: z.coerce.boolean().optional(),
  indoorOutdoor: z.enum(['Indoor', 'Outdoor']).optional(),
  sortBy: z.enum(['displayName', 'rating', 'createdAt', 'priceFrom']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  ownerUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  // Venues the viewer manages — owned OR staffed (active VenueStaff row). Honored
  // only for the authenticated user themselves (see listVenues), so it can't be
  // used to enumerate someone else's venues. Each row is annotated viewerStaffRole.
  managedByUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  // Claim lifecycle filter — 'unclaimed' powers the owner "claim an existing
  // venue" search (directory listings not yet linked to an owner).
  state: z.enum(['claimed', 'unclaimed']).optional(),
  // When true, also drop any venue that already has a pending ownership claim —
  // so the claim search only shows genuinely-claimable listings.
  excludePendingClaims: z.coerce.boolean().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const updateVenueSchema = z.object({
  displayName: z.string().max(200).optional(),
  oneLineSummary: z.string().max(255).optional(),
  description: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().max(255).optional(),
  website: z.string().optional(),
  bookingUrl: z.string().optional(),
  // Optional vanity slug for the auto-generated booking link. Empty string
  // clears it (falls back to the system slug); a value is normalized +
  // uniqueness-checked in the handler before it's stored.
  bookingSlug: z.string().max(60).optional(),
  indoorOutdoor: z.string().max(10).optional(),
  // courtCount is intentionally NOT accepted here — it's derived from the
  // actual court records (see recomputeCourtCount), never hand-entered.
  surfaceType: z.string().max(50).optional(),
  priceFrom: z.string().optional(),
  priceType: z.string().max(50).optional(),
  peakPrice: z.string().optional(),
  offPeakPrice: z.string().optional(),
  openPlayPrice: z.string().optional(),
  equipmentRentalPrice: z.string().optional(),
  // Day-based pricing — flat weekend/holiday hourly overrides + the holiday date list.
  weekendPrice: z.string().optional(),
  holidayPrice: z.string().optional(),
  holidayDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  // Member pricing — % discount for venue members (0 clears it).
  memberDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  // Per-player surcharge — ₱ per extra player + the headcount included before it applies.
  perPlayerFee: z.coerce.number().min(0).optional(),
  perPlayerFeeThreshold: z.coerce.number().int().min(1).optional(),
  priceNotes: z.string().optional(),
  hasOpenPlay: z.boolean().optional(),
  hasCoaching: z.boolean().optional(),
  hasCourtRental: z.boolean().optional(),
  isBeginnerFriendly: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  hasToilets: z.boolean().optional(),
  hasShowers: z.boolean().optional(),
  hasFoodBeverage: z.boolean().optional(),
  hasAc: z.boolean().optional(),
  hasLighting: z.boolean().optional(),
  hasSeating: z.boolean().optional(),
  hasPaddleRental: z.boolean().optional(),
  hasProShop: z.boolean().optional(),
  amenityChips: z.array(z.string()).optional(),
  customAmenities: z.array(z.string()).max(20).optional(),
  bestFor: z.array(z.string()).optional(),
  whatPlayersLike: z.array(z.string()).optional(),
  thingsToKnow: z.array(z.string()).optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  cityName: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  fullAddress: z.string().optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  // Booking policy: require the owner to accept each booking before the player
  // pays, and how many hours they then have to pay before the hold expires.
  requireBookingApproval: z.boolean().optional(),
  bookingPayWindowHours: z.coerce.number().int().min(1).max(168).optional(),
  // Payment options offered at checkout (subset of full/deposit/pay_at_venue) +
  // the deposit size (% of total) when 'deposit' is offered.
  paymentOptions: z.array(z.enum(['full', 'deposit', 'pay_at_venue'])).optional(),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  // Pricing display — "VAT inclusive", "VAT exclusive", or custom label.
  pricingTaxLabel: z.string().max(40).optional(),
  // Automated dynamic pricing — owner opt-in, off by default.
  autoDynamicPricing: z.boolean().optional(),
  autoDynamicPricingMinConfidence: z.enum(['low', 'medium', 'high']).optional(),
  autoDynamicPricingMaxAdjustment: z.coerce.number().int().min(5).max(50).optional(),
  // Cancellation & refund policy — configurable per venue.
  cancellationWindowHours: z.coerce.number().int().min(0).max(720).optional(),
  refundPercent: z.coerce.number().int().min(0).max(100).optional(),
  noShowFee: z.coerce.number().min(0).optional(),
});

// Empty strings from HTML forms should be treated as "unset", not as values
// (so optional numeric/id fields don't fail validation or store junk).
const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);

export const createVenueSchema = z.object({
  displayName: z.string().min(2).max(200),
  oneLineSummary: z.string().max(255).optional(),
  description: z.string().optional(),
  cityId: z.preprocess(emptyToUndef, z.string().regex(/^[0-9a-fA-F]{24}$/).optional()),
  cityName: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  fullAddress: z.string().optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  indoorOutdoor: z.string().max(10).optional(),
  courtCount: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).optional()),
  surfaceType: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().max(255).optional(),
  website: z.string().optional(),
  bookingUrl: z.string().optional(),
  priceFrom: z.preprocess(emptyToUndef, z.coerce.number().min(0).optional()),
  lat: z.preprocess(emptyToUndef, z.coerce.number().optional()),
  lng: z.preprocess(emptyToUndef, z.coerce.number().optional()),
});

export const createCourtSchema = z.object({
  courtNumber: z.string().max(10),
  courtName: z.string().max(120).optional(),
  // Short per-court blurb (surface/photos/etc. live alongside it).
  description: z.string().max(1000).optional(),
  surfaceType: z.string().max(50).optional(),
  // Per-court hourly rate (PHP); empty → unset (falls back to the venue rate).
  hourlyRate: z.preprocess(emptyToUndef, z.coerce.number().min(0).optional()),
  indoor: z.boolean().optional(),
  // Sport played on this court (multi-sport venues mix these). Empty → pickleball.
  sport: z.string().max(30).optional(),
  // Half-court / split-court capability + how many sub-units it divides into.
  isSplittable: z.boolean().optional(),
  splitCount: z.preprocess(emptyToUndef, z.coerce.number().int().min(2).max(4).optional()),
  // Per-sub-unit hourly rates; each sub-unit can override the court's base rate.
  subUnitRates: z.array(z.object({ index: z.number().int().min(0), hourlyRate: z.number().min(0) })).optional(),
  // Cover thumbnail + the rest of the court's photo gallery.
  mainImageUrl: z.string().max(500).optional(),
  galleryImageUrls: z.array(z.string().max(500)).optional(),
  // Per-court booking-approval override + turnover gap (see updateCourtSchema).
  approvalMode: z.enum(['inherit', 'auto', 'manual']).optional(),
  turnoverMinutes: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).max(180).optional()),
  // ── Court profile ── owner-described court attributes (see the Court model).
  hasAircon: z.boolean().optional(),
  highCeiling: z.boolean().optional(),
  spaceAroundCourt: z.string().max(30).optional(),
  hasRefreshmentStand: z.boolean().optional(),
  floorType: z.string().max(30).optional(),
  ballType: z.string().max(20).optional(),
});

export const updateCourtSchema = z.object({
  courtNumber: z.string().max(10).optional(),
  // Empty string clears the name/description (stored as-is on the doc).
  courtName: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  surfaceType: z.string().max(50).optional(),
  // Per-court hourly rate (PHP). Send a number to set it, or null/'' to clear
  // it (reverting this court to the venue's flat rate); omit to leave unchanged.
  hourlyRate: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().min(0).nullable().optional()),
  indoor: z.boolean().optional(),
  isActive: z.boolean().optional(),
  // Sport played on this court (multi-sport venues mix these). Empty → pickleball.
  sport: z.string().max(30).optional(),
  // Half-court / split-court capability + how many sub-units it divides into.
  isSplittable: z.boolean().optional(),
  splitCount: z.preprocess(emptyToUndef, z.coerce.number().int().min(2).max(4).optional()),
  // Per-sub-unit hourly rates; each sub-unit can override the court's base rate.
  subUnitRates: z.array(z.object({ index: z.number().int().min(0), hourlyRate: z.number().min(0) })).optional(),
  // Empty string clears the court's cover photo; an empty array clears the gallery.
  mainImageUrl: z.string().max(500).optional(),
  galleryImageUrls: z.array(z.string().max(500)).optional(),
  // Booking-approval override for this court: 'inherit' = follow the venue policy,
  // 'manual' = always request-to-book, 'auto' = always instant-book.
  approvalMode: z.enum(['inherit', 'auto', 'manual']).optional(),
  // Turnover/buffer gap (minutes) required between bookings on this court; 0 clears it.
  turnoverMinutes: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).max(180).optional()),
  // ── Court profile ── owner-described court attributes (empty string clears a text one).
  hasAircon: z.boolean().optional(),
  highCeiling: z.boolean().optional(),
  spaceAroundCourt: z.string().max(30).optional(),
  hasRefreshmentStand: z.boolean().optional(),
  floorType: z.string().max(30).optional(),
  ballType: z.string().max(20).optional(),
});

export const hourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  // Per-block rate (PHP/hr); '' or null → unset (the court/venue rate applies).
  price: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().min(0).optional()),
  isClosed: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createClosureSchema = z.object({
  closureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  isClosedAllDay: z.boolean().optional(),
});

// Venue staff roles. A 'manager' runs the venue (bookings + analytics); a
// 'front_desk' handles day-to-day bookings but not the revenue/analytics view.
// The owner is implicitly the top role and is never a VenueStaff row.
export const VENUE_STAFF_ROLES = ['manager', 'front_desk'] as const;
export type VenueStaffRole = (typeof VENUE_STAFF_ROLES)[number];

export const createStaffSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  staffRole: z.enum(VENUE_STAFF_ROLES),
});

// Member pricing — owner designates a player as a venue member (gets the member rate).
export const addMemberSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  tier: z.string().max(40).optional(),
});

// Self-service join — a signed-in player joins this venue's membership for themselves,
// optionally recording which plan (tier) they chose.
export const joinMembershipSchema = z.object({
  planId: z.string().trim().min(1).max(40).optional(),
});

// The invited player's response to an owner-sent membership invite (accept/decline).
// When accepting, the player can optionally pick a plan (tier) — if the invite
// didn't already carry one, the app shows the plan picker before sending the response.
export const respondMembershipSchema = z.object({
  accept: z.boolean(),
  planId: z.string().trim().min(1).max(40).optional(),
});

// ── Subscription plan schemas ──────────────────────────────────────

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0),
  currency: z.string().max(10).optional().default('PHP'),
  billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual', 'custom']),
  customBillingDays: z.coerce.number().min(1).max(365).optional().nullable(),
  benefits: z.array(z.string().max(200)).optional().default([]),
  maxMembers: z.coerce.number().min(0).optional().nullable(),
  freeTrialDays: z.coerce.number().min(0).optional().nullable(),
  autoRenew: z.boolean().optional().default(true),
  status: z.enum(['active', 'draft', 'disabled']).optional().default('draft'),
});

export const updateSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual', 'custom']).optional(),
  customBillingDays: z.coerce.number().min(1).max(365).optional().nullable(),
  benefits: z.array(z.string().max(200)).optional(),
  maxMembers: z.coerce.number().min(0).optional().nullable(),
  freeTrialDays: z.coerce.number().min(0).optional().nullable(),
  autoRenew: z.boolean().optional(),
  status: z.enum(['active', 'draft', 'disabled']).optional(),
});

// Manual surge — owner sets an absolute ₱/hr for a date + time window (optional court).
export const createSlotOverrideSchema = z.object({
  courtId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  price: z.coerce.number().min(0),
  note: z.string().max(200).optional(),
});

export const createFaqSchema = z.object({
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(10000),
  sortOrder: z.number().int().optional(),
});

export const updateFaqSchema = z.object({
  question: z.string().min(1).max(2000).optional(),
  answer: z.string().min(1).max(10000).optional(),
  sortOrder: z.number().int().optional(),
});

export const venueBookingQuerySchema = z.object({
  status: z.string().optional(),
});

export const updateBookingStatusSchema = z.object({
  // 'awaiting_payment' = owner accepts a request-to-book (player then pays).
  status: z.enum(['confirmed', 'cancelled', 'paid', 'awaiting_payment']),
  cancellationReason: z.string().max(500).optional(),
});

// Owner/staff-entered booking: a 'manual' off-platform reservation (phone /
// Messenger / IG / walk-in) or a 'blocked' slot the owner makes unavailable.
export const createVenueBookingSchema = z.object({
  bookingType: z.enum(['manual', 'blocked']),
  courtId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  subUnitIndex: z.coerce.number().int().min(0).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Manual booking — the off-platform customer + how they reached out + payment.
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  bookingSource: z.enum(['walk_in', 'phone', 'messenger', 'instagram', 'other']).optional(),
  amount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  // Slot block — why the time is unavailable.
  blockReason: z.string().max(200).optional(),
});

// Recurring booking (weekly regular / league): the same weekly slot generated
// across N weeks. Mirrors the manual-booking fields plus the recurrence shape.
export const createRecurringBookingSchema = z.object({
  bookingType: z.enum(['manual', 'blocked']).default('manual'),
  courtId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  subUnitIndex: z.coerce.number().int().min(0).optional(),
  // First occurrence; subsequent ones land every `weeklyInterval` weeks after it.
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  weeks: z.coerce.number().int().min(2).max(52),
  weeklyInterval: z.coerce.number().int().min(1).max(4).optional().default(1),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  bookingSource: z.enum(['walk_in', 'phone', 'messenger', 'instagram', 'other']).optional(),
  amount: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  blockReason: z.string().max(200).optional(),
});

export const venueAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional().default(90),
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

export async function resolveVenueId(id: string): Promise<string | null> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  // Match _id, system slug, or an owner's custom booking slug (the namespace is
  // kept collision-free on write, so at most one venue matches).
  const venue = isObjectId
    ? await Venue.findById(id).select('_id')
    : await Venue.findOne({ $or: [{ slug: id }, { bookingSlug: id }] }).select('_id');
  return venue ? venue._id.toString() : null;
}

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'venue';
}

// Normalize a custom booking slug the same way everywhere (update + availability
// check): lowercase, non-alphanumerics → hyphens, trim hyphens, cap at 60. Returns
// '' when nothing usable remains (e.g. all-punctuation input).
function normalizeBookingSlug(raw: string): string {
  return (raw || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Is `slug` free to use as venueId's booking slug? Free = no OTHER venue already
// uses it as their system slug or their custom booking slug.
async function isBookingSlugFree(slug: string, venueId: string): Promise<boolean> {
  const taken = await Venue.exists({ _id: { $ne: venueId }, $or: [{ slug }, { bookingSlug: slug }] });
  return !taken;
}

// Append -2, -3, … until the slug is free (slug is unique on the model).
async function uniqueVenueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Venue.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 100);
  }
  return slug;
}

export async function requireVenueOwner(c: any, venueId: string): Promise<boolean> {
  const user = c.get('user');
  const venue = await Venue.findById(venueId).select('ownerUserId');
  if (!venue) return false;
  if (hasPermission(user, 'admin.venues.manage')) return true;
  if (!hasPermission(user, 'owner.venues.manage')) return false;
  // effectiveOwnerId resolves to the user's own id for an owner, or the creating
  // owner's id for a staff sub-account — so a staff member is treated as the
  // owner for every venue their owner owns.
  return venue.ownerUserId?.toString() === effectiveOwnerId(user);
}

// The viewer's management role for a venue: 'owner' (or admin) > 'manager' >
// 'front_desk' > null. Owners/admins outrank any staff row. Staff are real
// users an owner added via VenueStaff — this is how a non-owner is "wired into"
// the venue's operational views (bookings, analytics) without owning it.
export async function getVenueManagerRole(
  c: any,
  venueId: string,
): Promise<'owner' | VenueStaffRole | null> {
  const user = c.get('user');
  if (!user) return null;
  const venue = await Venue.findById(venueId).select('ownerUserId');
  if (!venue) return null;
  if (hasPermission(user, 'admin.venues.manage')) return 'owner';
  if (hasPermission(user, 'owner.venues.manage') && venue.ownerUserId?.toString() === effectiveOwnerId(user)) return 'owner';
  const staff = await VenueStaff.findOne({ venueId, userId: user.sub, status: 'active' }).select('staffRole').lean();
  const role = (staff as any)?.staffRole;
  return role === 'manager' || role === 'front_desk' ? role : null;
}

// Operational access: the owner OR any active staff member can manage the
// venue's bookings. (Structural edits — listing, courts, hours, staff, delete —
// stay owner-only via requireVenueOwner.)
export async function requireVenueManager(c: any, venueId: string): Promise<boolean> {
  return (await getVenueManagerRole(c, venueId)) !== null;
}

// Keep the denormalized Venue.courtCount in sync with the real court records.
// courtCount is derived, never hand-entered: it always equals the number of
// active courts. Call this after every court create/update/delete so the
// listing page, venue cards, and search all stay accurate.
async function recomputeCourtCount(venueId: any): Promise<void> {
  const count = await Court.countDocuments({ venueId, isActive: true });
  await Venue.findByIdAndUpdate(venueId, { courtCount: count });
}

/* ─── Handlers ────────────────────────────────────────────────────── */

export async function listVenues(c: any) {
  const filters = listQuery.parse(c.req.query());
  const filter: Record<string, any> = {};
  if (filters.city) filter.cityId = filters.city;
  if (filters.search) {
    filter.$or = [
      { displayName: { $regex: filters.search, $options: 'i' } },
      { area: { $regex: filters.search, $options: 'i' } },
    ];
  }
  if (filters.hasOpenPlay !== undefined) filter.hasOpenPlay = filters.hasOpenPlay;
  if (filters.hasCoaching !== undefined) filter.hasCoaching = filters.hasCoaching;
  if (filters.isBeginnerFriendly !== undefined) filter.isBeginnerFriendly = filters.isBeginnerFriendly;
  if (filters.indoorOutdoor) filter.indoorOutdoor = filters.indoorOutdoor;
  if (filters.ownerUserId) filter.ownerUserId = filters.ownerUserId;
  if (filters.state) filter.state = filters.state;

  // "Venues I manage" — owned OR an active staff assignment. Self-only: a viewer
  // can only ask for their own managed set (prevents enumerating others' venues).
  // Each returned row is annotated with the viewer's role (see items map below).
  let staffRoleByVenue: Map<string, string> | null = null;
  let managedOwnerId: string | null = null;
  if (filters.managedByUserId) {
    const viewer = c.get('user');
    if (!viewer || viewer.sub !== filters.managedByUserId) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You can only list venues you manage' } }, 403);
    }
    // The owner whose venues this viewer manages: their own (owner) or their
    // creating owner's (staff sub-account). The per-venue VenueStaff assignments
    // below stay keyed on the viewer's own id (those are individual, not inherited).
    managedOwnerId = effectiveOwnerId(viewer);
    const staffRows = await VenueStaff.find({ userId: filters.managedByUserId, status: 'active' }).select('venueId staffRole').lean();
    staffRoleByVenue = new Map(staffRows.map((s: any) => [String(s.venueId), s.staffRole]));
    const staffVenueIds = staffRows.map((s: any) => s.venueId);
    filter.$or = [{ ownerUserId: managedOwnerId }, { _id: { $in: staffVenueIds } }];
  }

  // The owner "claim a venue" search wants genuinely-claimable listings only:
  // unclaimed AND without an outstanding (pending) ownership claim from anyone.
  if (filters.excludePendingClaims) {
    const pendingVenueIds = await VenueClaim.distinct('venueId', { status: 'pending' });
    if (pendingVenueIds.length) filter._id = { $nin: pendingVenueIds };
  }

  // Soft-deleted venues are hidden from everyone — including their own owner, so
  // a "deleted" venue truly disappears from their console. ({deletedAt:null}
  // also matches docs that predate the field.)
  filter.deletedAt = null;

  // Public discovery hides venues awaiting (or denied) admin approval. Owner-
  // scoped queries (the owner console passes ownerUserId) still surface their
  // own pending/rejected venues so owners can manage them. Imported venues have
  // no listingStatus, so $nin keeps them visible.
  if (!filters.ownerUserId && !filters.managedByUserId) filter.listingStatus = { $nin: ['pending', 'rejected'] };

  const sortDir = filters.sortOrder === 'desc' ? -1 : 1;
  const sortField = filters.sortBy || 'displayName';

  if (filters.cursor) {
    const decoded = Buffer.from(filters.cursor, 'base64url').toString();
    filter[sortField] = { $gt: decoded };
  }

  const rows = await Venue.find(filter)
    .populate('cityId', 'slug name')
    .sort({ [sortField]: sortDir })
    .limit(filters.pageSize + 1)
    .lean();

  const hasMore = rows.length > filters.pageSize;
  if (hasMore) rows.pop();

  // Batch one media lookup for the whole page, then attach a primary (or first)
  // image url per venue — same `image` shape the get-by-id endpoint returns.
  const venueIds = rows.map((r: any) => r._id);
  const mediaRows = venueIds.length
    ? await Media.find({ ownerType: 'venue', ownerId: { $in: venueIds } }).sort({ sortOrder: 1 }).lean()
    : [];
  const imageByVenue = new Map<string, { url: string; primary: boolean }>();
  for (const m of mediaRows as any[]) {
    const key = String(m.ownerId);
    const cur = imageByVenue.get(key);
    if (!cur) imageByVenue.set(key, { url: m.url, primary: !!m.isPrimary });
    else if (m.isPrimary && !cur.primary) imageByVenue.set(key, { url: m.url, primary: true });
  }

  const items = rows.map((r: any) => ({
    ...r, id: r._id, citySlug: r.cityId?.slug,
    // Prefer the seeded city's name; fall back to the venue's free-text cityName.
    cityName: r.cityId?.name ?? r.cityName ?? null,
    city: r.cityId?.name ?? r.cityName ?? null,
    cityId: r.cityId?._id?.toString(),
    image: imageByVenue.get(String(r._id))?.url || '',
    // Managed-venues mode: 'owner' when the viewer owns it (or is staff of the
    // owner that owns it), else their per-venue VenueStaff role.
    ...(staffRoleByVenue
      ? { viewerStaffRole: String(r.ownerUserId) === managedOwnerId ? 'owner' : (staffRoleByVenue.get(String(r._id)) ?? null) }
      : {}),
  }));

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(String(lastItem.displayName || '')).toString('base64url')
    : undefined;

  return c.json({ data: items, meta: { total: items.length, cursor: nextCursor } });
}

export async function createVenue(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'owner.venues.create')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Venue creation permission required' } }, 403);
  }
  const body = createVenueSchema.parse(await c.req.json());
  const slug = await uniqueVenueSlug(slugify(body.displayName));
  // Owner-created venues are live immediately (they're owned by the creator
  // and published right away — no admin approval gate, unlike claimed directory
  // venues which still go through the review queue).
  const venue = await Venue.create({
    ...body,
    slug,
    ownerUserId: user.sub,
    state: 'claimed',
    listingStatus: 'published',
  });
  return c.json({ data: { ...venue.toObject(), id: venue._id } }, 201);
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// The operating window per day (the price==null row, or the first row) as a
// "06:00 - 22:00" / "Closed" dict — the shape the public hours card renders.
function hoursDictFromRows(rows: any[]): Record<string, string> {
  const byDay = new Map<number, any[]>();
  for (const r of rows) {
    if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, []);
    byDay.get(r.dayOfWeek)!.push(r);
  }
  const dict: Record<string, string> = {};
  for (const [dow, dayRows] of byDay) {
    const name = DAY_NAMES[dow] || `day_${dow}`;
    const op = dayRows.find((r) => r.price == null) || dayRows[0];
    dict[name] = op.isClosed ? 'Closed' : `${op.openTime || ''} - ${op.closeTime || ''}`;
  }
  return dict;
}

// A court's effective hour rows: its own when it has any, else the venue default.
function effectiveCourtRows(allRows: any[], courtId: string, defaultRows: any[]): any[] {
  const own = allRows.filter((r) => r.courtId != null && String(r.courtId) === courtId);
  return own.length ? own : defaultRows;
}

// Venue-level hours = the union across its courts: a day is open when ANY court
// is open, spanning the earliest open to the latest close. Keeps the public
// venue "Hours" card meaningful now that hours live per court.
function unionHoursDict(courtRowSets: any[][]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (let dow = 0; dow < 7; dow++) {
    let minOpen: string | null = null, maxClose: string | null = null, anyOpen = false, anyRow = false;
    for (const rows of courtRowSets) {
      const dayRows = rows.filter((r) => r.dayOfWeek === dow);
      if (!dayRows.length) continue;
      anyRow = true;
      const op = dayRows.find((r) => r.price == null) || dayRows[0];
      if (op.isClosed) continue;
      anyOpen = true;
      if (op.openTime && (minOpen == null || op.openTime < minOpen)) minOpen = op.openTime;
      if (op.closeTime && (maxClose == null || op.closeTime > maxClose)) maxClose = op.closeTime;
    }
    if (!anyRow) continue;
    dict[DAY_NAMES[dow]!] = anyOpen ? `${minOpen || ''} - ${maxClose || ''}` : 'Closed';
  }
  return dict;
}

/* ─── Platform-curated highlights ──────────────────────────────────────
 * "Best for" (use-case) and "What players like" (amenities / quality /
 * activity) badges are CURATED BY THE PLATFORM from real venue data + editorial
 * — they are NOT owner-typed marketing claims. They're recomputed on every read
 * so they always reflect the venue's actual attributes and booking activity, and
 * an owner can't inflate them. (Editorial `customHighlights` come from the data
 * import / admin, never from the owner.) */
const truthy = (v: unknown) => v === true || v === 'true';

function dedupeCap(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const label = String(raw ?? '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= cap) break;
  }
  return out;
}

export function computeVenueHighlights(
  v: Record<string, any>,
  signals: { bookingCount: number; courtCount: number },
): { bestFor: string[]; whatPlayersLike: string[] } {
  // — Best for: who/what the venue suits (capability signals) —
  const bestFor: string[] = [];
  if (truthy(v.isBeginnerFriendly)) bestFor.push('Beginners');
  if (truthy(v.hasCoaching)) bestFor.push('Lessons & coaching');
  if (truthy(v.hasOpenPlay)) bestFor.push('Open play');
  if (signals.courtCount >= 4) bestFor.push('Groups & events');
  if (v.indoorOutdoor === 'Indoor') bestFor.push('Rain-or-shine play');
  else if (truthy(v.hasLighting) || truthy(v.amenityTournamentLighting)) bestFor.push('Evening games');

  // — What players like: amenities + quality, from real signals —
  const like: string[] = [];
  const rating = Number(v.googleRating) || 0;
  const reviews = Number(v.googleReviewCount) || 0;
  if (rating >= 4.5 && reviews >= 10) like.push('Top-rated');
  if (truthy(v.isVerified)) like.push('Verified venue');
  if (signals.bookingCount >= 8) like.push('Popular with players');
  if (truthy(v.hasParking) || truthy(v.amenityParking)) like.push('Easy parking');
  if (truthy(v.hasAc) || truthy(v.amenityAirConditioning)) like.push('Air-conditioned');
  if (truthy(v.hasShowers) || truthy(v.amenityShowers)) like.push('Showers');
  if (truthy(v.hasFoodBeverage) || truthy(v.amenityCafeFood)) like.push('Food & drinks');
  if (truthy(v.hasProShop) || truthy(v.amenityProShop)) like.push('Pro shop');
  if (truthy(v.hasPaddleRental) || truthy(v.amenityPaddleRental)) like.push('Paddle rental');

  // Editorial highlights (hand-curated at import/admin) lead "what players like".
  // Import data joins several points with ';' into one string and sometimes runs
  // long, so split on delimiters and keep only concise, badge-sized phrases.
  const editorial = (Array.isArray(v.customHighlights) ? v.customHighlights : [])
    .flatMap((h: any) => String(h ?? '').split(/[;·]/))
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0 && s.length <= 34);
  return {
    bestFor: dedupeCap(bestFor, 5),
    whatPlayersLike: dedupeCap([...editorial, ...like], 6),
  };
}

export async function getVenue(c: any) {
  const id = c.req.param('id');
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  // Resolve by _id, system slug, OR an owner's custom booking slug — so the
  // auto-generated booking link (…/venues/<bookingSlug>) lands on the venue.
  const venue = isObjectId
    ? await Venue.findById(id).populate('cityId').lean()
    : await Venue.findOne({ $or: [{ slug: id }, { bookingSlug: id }] }).populate('cityId').lean();

  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  // A soft-deleted venue is gone to everyone but an admin (who can still pull it
  // up for audit/recovery). The owner gets a 404 too, so it reads as deleted.
  if ((venue as any).deletedAt) {
    if (!hasPermission(c.get('user'), 'admin.venues.manage')) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
    }
  }

  // A venue awaiting (or denied) admin approval is only visible to its owner or
  // an admin; anyone else gets a 404 so it doesn't leak through direct links.
  if (['pending', 'rejected'].includes((venue as any).listingStatus)) {
    const requester = c.get('user');
    const isOwner = requester && String(venue.ownerUserId) === requester.sub;
    const isAdmin = hasPermission(requester, 'admin.venues.manage');
    if (!isOwner && !isAdmin) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
    }
  }

  const result: Record<string, any> = { ...venue, id: venue._id };
  if (venue.cityId) {
    result.citySlug = (venue.cityId as any).slug;
    result.cityName = (venue.cityId as any).name;
    result.city = (venue.cityId as any).name;
  } else {
    // No seeded city — surface the venue's free-text city name instead.
    result.city = (venue as any).cityName ?? null;
  }
  delete result.cityId;

  const venueId = venue._id.toString();
  const [hoursRows, faqRows, mediaRows, courtRows, bookingCount] = await Promise.all([
    VenueHour.find({ venueId }).sort({ dayOfWeek: 1 }).lean(),
    Faq.find({ venueId }).sort({ sortOrder: 1 }).lean(),
    Media.find({ ownerType: 'venue', ownerId: venueId }).sort({ sortOrder: 1 }).lean(),
    Court.find({ venueId, isActive: true }).sort({ courtNumber: 1 }).lean(),
    // Real booking activity feeds the "Popular with players" highlight.
    Booking.countDocuments({ venueId, status: { $ne: 'cancelled' } }),
  ]);

  // Hours now live per court (VenueHour rows carry a courtId; a null courtId is
  // the venue-wide default a court inherits). Each court surfaces its effective
  // weekly window; the venue-level `hours` is the union across courts so the
  // public venue card still reads sensibly. Legacy venues with no Court docs fall
  // back to their default rows directly.
  const defaultRows = hoursRows.filter((h: any) => h.courtId == null);
  const courtRowSets = courtRows.map((ct: any) => effectiveCourtRows(hoursRows, String(ct._id), defaultRows));
  result.hours = courtRows.length ? unionHoursDict(courtRowSets) : hoursDictFromRows(defaultRows);
  result.faqs = faqRows.map((f: any) => ({ ...f, id: f._id }));
  result.gallery = mediaRows.map((m: any) => m.url);
  result.image = mediaRows.find((m: any) => m.isPrimary)?.url || mediaRows[0]?.url || '';
  result.courts = courtRows.map((ct: any, i: number) => ({ ...ct, id: ct._id, hours: hoursDictFromRows(courtRowSets[i] ?? []) }));
  // Platform-curated highlights (see computeVenueHighlights) — derived, not owner-typed.
  result.curatedHighlights = computeVenueHighlights(venue as Record<string, any>, {
    bookingCount,
    courtCount: courtRows.length || (venue as any).courtCount || 0,
  });

  // The viewer's management role for this venue (owner/manager/front_desk/null),
  // so the owner console can restrict a staff member to the tabs their role allows.
  result.viewerStaffRole = await getVenueManagerRole(c, venueId);

  // Whether the signed-in player is a member of this venue — so the booking flow
  // can apply member pricing (Venue.memberDiscountPercent) at checkout, and the
  // membership CTA can reflect the plan the player joined (viewerMembershipTier).
  // An expired membership is treated as non-member (button switches to "Renew").
  // Also expose any pending invite tier so the notifications screen can decide
  // whether to show the plan picker before accepting (no tier → picker needed).
  const viewer = c.get('user');
  const [myActive, myPending] = viewer
    ? await Promise.all([
        VenueMember.findOne({ venueId, userId: viewer.sub, status: 'active' }).select('tier expiresAt').lean(),
        VenueMember.findOne({ venueId, userId: viewer.sub, status: 'pending' }).select('tier').lean(),
      ])
    : [null, null];
  const now = new Date();
  const isActive = !!myActive && (!(myActive as any).expiresAt || new Date((myActive as any).expiresAt) > now);
  result.viewerIsMember = isActive;
  result.viewerMembershipTier = isActive ? ((myActive as any)?.tier ?? null) : null;
  result.viewerMembershipExpiresAt = (myActive as any)?.expiresAt?.toISOString?.() ?? null;
  // If the viewer has a pending invite, surface its tier so the app knows whether to
  // show the plan picker on accept (null tier → player must pick a plan first).
  result.viewerPendingMembershipTier = myPending ? ((myPending as any)?.tier ?? null) : undefined;

  return c.json({ data: result });
}

export async function getVenueReviews(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const rows = await Review.find({ venueId }).sort({ createdAt: -1 }).limit(50).lean();
  const items = rows.map((r: any) => ({ ...r, id: r._id }));
  const stats = await Review.aggregate([
    { $match: { venueId: venueId as any } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, totalCount: { $sum: 1 } } },
  ]);
  const stat = stats[0] || { avgRating: 0, totalCount: 0 };
  return c.json({ data: { items, rating: Number(stat.avgRating?.toFixed(1) || 0), count: stat.totalCount || 0 } });
}

export async function getVenueOpenPlay(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await OpenPlaySession.find({ venueId, status: 'published' }).sort({ date: 1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function getVenueCoaches(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const [linkedRows, applicationRows] = await Promise.all([
    Coach.find({ venues: venueId }).limit(50).lean(),
    CoachApplication.find({ venueId, status: 'approved' }).select('coachId coachUserId decidedAt createdAt').lean(),
  ]);

  const byCoachId = new Map<string, any>();
  for (const row of linkedRows as any[]) byCoachId.set(String(row._id), { ...row, assignmentSource: 'linked' });

  const missingCoachIds = [...new Set(
    (applicationRows as any[])
      .map((a) => a.coachId?.toString())
      .filter((id) => id && !byCoachId.has(id)),
  )];
  const appCoachRows = missingCoachIds.length
    ? await Coach.find({ _id: { $in: missingCoachIds } }).lean()
    : [];
  for (const row of appCoachRows as any[]) byCoachId.set(String(row._id), { ...row, assignmentSource: 'application' });

  const applicationCoachIds = new Set((applicationRows as any[]).map((a) => a.coachId?.toString()).filter(Boolean));
  for (const id of applicationCoachIds) {
    const row = byCoachId.get(id);
    if (row) row.assignmentSource = 'application';
  }

  const coveredUserIds = new Set(
    [...byCoachId.values()].map((row: any) => row.userId?.toString()).filter(Boolean),
  );
  const fallbackUserIds = [...new Set(
    (applicationRows as any[])
      .filter((a) => !a.coachId || !byCoachId.has(a.coachId.toString()))
      .map((a) => a.coachUserId?.toString())
      .filter((id) => id && !coveredUserIds.has(id)),
  )];
  const fallbackUsers = fallbackUserIds.length
    ? await User.find({ _id: { $in: fallbackUserIds } }).select('displayName avatarUrl').lean()
    : [];

  const applicationDateByCoachId = new Map(
    (applicationRows as any[])
      .filter((a) => a.coachId)
      .map((a) => [a.coachId.toString(), a.decidedAt || a.createdAt]),
  );
  const applicationDateByUserId = new Map(
    (applicationRows as any[])
      .filter((a) => a.coachUserId)
      .map((a) => [a.coachUserId.toString(), a.decidedAt || a.createdAt]),
  );

  const data = [
    ...[...byCoachId.values()].map((r: any) => ({
      ...r,
      id: r._id,
      assignedAt: applicationDateByCoachId.get(String(r._id)) || null,
    })),
    ...(fallbackUsers as any[]).map((u) => ({
      id: u._id,
      userId: u._id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      assignmentSource: 'application',
      assignedAt: applicationDateByUserId.get(String(u._id)) || null,
    })),
  ];

  return c.json({ data });
}

export async function updateVenue(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can update this venue' } }, 403);
  const body = updateVenueSchema.parse(await c.req.json());

  // Custom booking-link slug: owners vanity-name the auto-generated booking link
  // (…/venues/<slug>). An empty value clears it (the link reverts to the system
  // slug); a non-empty value is normalized and must be unique across every
  // venue's `slug` AND `bookingSlug` so two booking links never resolve alike.
  if (body.bookingSlug !== undefined) {
    const candidate = normalizeBookingSlug(body.bookingSlug);
    if (!body.bookingSlug.trim()) {
      (body as Record<string, unknown>).bookingSlug = null; // clear → system slug
    } else if (!candidate) {
      return c.json({ error: { code: 'INVALID_SLUG', message: 'That custom link isn’t valid — use letters, numbers and hyphens.' } }, 400);
    } else if (!(await isBookingSlugFree(candidate, venueId))) {
      return c.json({ error: { code: 'SLUG_TAKEN', message: 'That custom link is already taken — try another.' } }, 409);
    } else {
      (body as Record<string, unknown>).bookingSlug = candidate;
    }
  }

  const result = await Venue.findByIdAndUpdate(venueId, body, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

// Live availability check for the custom booking slug, so the owner gets instant
// feedback while typing instead of only finding out a clash on save. Returns the
// normalized form + a status: empty (falls back to system slug) / invalid / taken
// / available. Owner-gated (it's scoped to one of their venues, and excludes self).
export async function checkBookingSlug(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can check this' } }, 403);

  const raw = String(c.req.query('slug') ?? '');
  const normalized = normalizeBookingSlug(raw);
  let status: 'empty' | 'invalid' | 'taken' | 'available';
  if (!raw.trim()) status = 'empty';                                  // blank → use the system slug
  else if (!normalized) status = 'invalid';                           // nothing usable (all punctuation)
  else if (!(await isBookingSlugFree(normalized, venueId))) status = 'taken';
  else status = 'available';

  return c.json({ data: { status, available: status === 'available' || status === 'empty', normalized } });
}

// "Delete" a venue. To the owner this is a permanent delete (it vanishes from
// their console + all public listings), but it's a SOFT delete: we stamp
// deletedAt and keep the document (and its courts/bookings/history) so an admin
// can audit or restore it. Idempotent — re-deleting an already-deleted venue is
// a no-op success.
export async function deleteVenue(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can delete this venue' } }, 403);
  }
  const user = c.get('user');
  await Venue.findByIdAndUpdate(venueId, { deletedAt: new Date(), deletedByUserId: user.sub });
  return c.json({ data: { id: venueId, deleted: true } });
}

export async function getVenueCourts(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await Court.find({ venueId, isActive: true }).sort({ courtNumber: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function createCourt(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage courts' } }, 403);
  const body = createCourtSchema.parse(await c.req.json());
  const court = await Court.create({ venueId, ...body });
  await recomputeCourtCount(venueId);
  return c.json({ data: court.toObject() }, 201);
}

export async function updateCourt(c: any) {
  const courtId = c.req.param('id');
  const court = await Court.findById(courtId);
  if (!court) return c.json({ error: { code: 'NOT_FOUND', message: 'Court not found' } }, 404);
  if (!(await requireVenueOwner(c, court.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can update courts' } }, 403);
  const body = updateCourtSchema.parse(await c.req.json());
  const result = await Court.findByIdAndUpdate(courtId, body, { new: true }).lean();
  await recomputeCourtCount(court.venueId); // isActive may have changed the count
  return c.json({ data: { ...result, id: result!._id } });
}

export async function deleteCourt(c: any) {
  const courtId = c.req.param('id');
  const court = await Court.findById(courtId);
  if (!court) return c.json({ error: { code: 'NOT_FOUND', message: 'Court not found' } }, 404);
  if (!(await requireVenueOwner(c, court.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can delete courts' } }, 403);
  await Court.findByIdAndDelete(courtId);
  await recomputeCourtCount(court.venueId);
  return c.json({ data: { message: 'Court deleted' } });
}

export async function getVenueHours(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await VenueHour.find({ venueId }).sort({ dayOfWeek: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

type HourEntry = z.infer<typeof hourEntrySchema>;

// Validate priced "Hours pricing" windows: each must sit inside the day's
// operating window (the un-priced row) and not overlap the previous priced one.
// Mirrors the app's pricingIssue() so the rule is enforced both ends. Returns a
// day number when invalid, else null. Shared by venue + per-court hours saves.
function invalidPricingDay(body: HourEntry[]): number | null {
  const hm = (t?: string) => (t ? t.slice(0, 5) : '');
  const byDay = new Map<number, HourEntry[]>();
  for (const e of body) {
    if (!byDay.has(e.dayOfWeek)) byDay.set(e.dayOfWeek, []);
    byDay.get(e.dayOfWeek)!.push(e);
  }
  for (const [dow, entries] of byDay) {
    if (entries.some((e) => e.isClosed)) continue;
    const operating = entries.find((e) => e.price == null);
    const opOpen = hm(operating?.openTime);
    const opClose = hm(operating?.closeTime);
    let prevClose = '';
    for (const p of entries.filter((e) => e.price != null)) {
      const open = hm(p.openTime);
      const close = hm(p.closeTime);
      const bad =
        (open && close && close <= open) ||
        (opOpen && open && open < opOpen) ||
        (opClose && close && close > opClose) ||
        (prevClose && open && open <= prevClose);
      if (bad) return dow;
      if (close) prevClose = close;
    }
  }
  return null;
}

export async function putVenueHours(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage hours' } }, 403);
  const body = hourEntrySchema.array().parse(await c.req.json());

  const badDay = invalidPricingDay(body);
  if (badDay != null) return c.json({ error: { code: 'INVALID_PRICING_WINDOW', message: `Hours pricing for day ${badDay} must stay within operating hours and not overlap.` } }, 400);

  // Only the venue-wide default rows are managed here (per-court rows are kept by
  // putCourtHours), so a venue-hours save never wipes a court's own schedule.
  await VenueHour.deleteMany({ venueId, courtId: null });
  if (body.length > 0) await VenueHour.insertMany(body.map(h => ({ venueId, courtId: null, ...h })));
  const rows = await VenueHour.find({ venueId, courtId: null }).sort({ dayOfWeek: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

// ─── Per-court operating hours ───────────────────────────────────────
// Each court can carry its own weekly schedule (+ hours-pricing). A court with
// no rows of its own inherits the venue-wide default (courtId: null), so legacy
// venues keep working until the owner sets a court's hours explicitly.

export async function getCourtHours(c: any) {
  const courtId = c.req.param('id');
  const court = await Court.findById(courtId).select('venueId').lean<{ venueId: any }>();
  if (!court) return c.json({ error: { code: 'NOT_FOUND', message: 'Court not found' } }, 404);
  let rows = await VenueHour.find({ courtId }).sort({ dayOfWeek: 1 }).lean();
  let inherited = false;
  if (rows.length === 0) {
    // Inherit the venue default as a starting point (the owner can then adjust).
    rows = await VenueHour.find({ venueId: court.venueId, courtId: null }).sort({ dayOfWeek: 1 }).lean();
    inherited = rows.length > 0;
  }
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })), meta: { inherited } });
}

export async function putCourtHours(c: any) {
  const courtId = c.req.param('id');
  const court = await Court.findById(courtId).select('venueId').lean<{ venueId: any }>();
  if (!court) return c.json({ error: { code: 'NOT_FOUND', message: 'Court not found' } }, 404);
  if (!(await requireVenueOwner(c, court.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage hours' } }, 403);
  const body = hourEntrySchema.array().parse(await c.req.json());

  const badDay = invalidPricingDay(body);
  if (badDay != null) return c.json({ error: { code: 'INVALID_PRICING_WINDOW', message: `Hours pricing for day ${badDay} must stay within operating hours and not overlap.` } }, 400);

  await VenueHour.deleteMany({ courtId });
  if (body.length > 0) await VenueHour.insertMany(body.map(h => ({ venueId: court.venueId, courtId, ...h })));
  const rows = await VenueHour.find({ courtId }).sort({ dayOfWeek: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function getVenueHolidayClosures(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await HolidayClosure.find({ venueId }).sort({ closureDate: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function createHolidayClosure(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage closures' } }, 403);
  const body = createClosureSchema.parse(await c.req.json());
  const result = await HolidayClosure.create({ venueId, ...body });
  return c.json({ data: result.toObject() }, 201);
}

export async function deleteHolidayClosure(c: any) {
  const id = c.req.param('id');
  const closure = await HolidayClosure.findById(id);
  if (!closure) return c.json({ error: { code: 'NOT_FOUND', message: 'Holiday closure not found' } }, 404);
  if (!(await requireVenueOwner(c, closure.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage closures' } }, 403);
  await HolidayClosure.findByIdAndDelete(id);
  return c.json({ data: { message: 'Holiday closure deleted' } });
}

// Staff list is identity-enriched (name/email/avatar of each member) and gated:
// the owner OR an active staff member can see who's on the team — it isn't public.
export async function getVenueStaff(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can view the team' } }, 403);
  const rows = await VenueStaff.find({ venueId, status: 'active' })
    .populate('userId', 'displayName email avatarUrl')
    .sort({ createdAt: 1 })
    .lean();
  return c.json({ data: rows.map((r: any) => ({
    id: r._id,
    userId: r.userId?._id ?? r.userId,
    staffRole: r.staffRole,
    status: r.status,
    createdAt: r.createdAt,
    displayName: r.userId?.displayName ?? null,
    email: r.userId?.email ?? null,
    avatarUrl: r.userId?.avatarUrl ?? null,
  })) });
}

// Adding/removing staff is owner-only AND needs owner.staff.manage — a
// structural change to who can act on the venue.
export async function createStaff(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!hasPermission(c.get('user'), 'owner.staff.manage')) return c.json({ error: { code: 'FORBIDDEN', message: 'Staff management permission required' } }, 403);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage staff' } }, 403);
  const body = createStaffSchema.parse(await c.req.json());

  const venue = await Venue.findById(venueId).select('ownerUserId').lean();
  if (venue?.ownerUserId?.toString() === body.userId) {
    return c.json({ error: { code: 'CONFLICT', message: 'The owner is already on the team' } }, 409);
  }
  const member = await User.findById(body.userId).select('_id').lean();
  if (!member) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Re-activate a previously-removed row instead of colliding on the unique index.
  const existing = await VenueStaff.findOne({ venueId, userId: body.userId });
  if (existing) {
    if (existing.status === 'active') return c.json({ error: { code: 'CONFLICT', message: 'This person is already on the team' } }, 409);
    existing.set({ staffRole: body.staffRole, status: 'active' });
    await existing.save();
    return c.json({ data: { ...existing.toObject(), id: existing._id } }, 201);
  }
  const result = await VenueStaff.create({ venueId, userId: body.userId, staffRole: body.staffRole, status: 'active' });
  return c.json({ data: { ...result.toObject(), id: result._id } }, 201);
}

export async function deleteStaff(c: any) {
  const id = c.req.param('id');
  if (!hasPermission(c.get('user'), 'owner.staff.manage')) return c.json({ error: { code: 'FORBIDDEN', message: 'Staff management permission required' } }, 403);
  const staff = await VenueStaff.findById(id);
  if (!staff) return c.json({ error: { code: 'NOT_FOUND', message: 'Staff member not found' } }, 404);
  if (!(await requireVenueOwner(c, staff.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage staff' } }, 403);
  await VenueStaff.findByIdAndUpdate(id, { status: 'inactive' });
  return c.json({ data: { message: 'Staff member removed' } });
}

/* ─── Venue members (member pricing) ──────────────────────────────── */

// The owner/staff see who the venue's members are (member pricing applies to them).
export async function getVenueMembers(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can view members' } }, 403);
  // Active members + outstanding invites (owner-added memberships the player
  // hasn't accepted yet) — the latter render as "Pending" in the owner's list.
  const rows = await VenueMember.find({ venueId, status: { $in: ['active', 'pending'] } })
    .populate('userId', 'displayName email avatarUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: rows.map((r: any) => ({
    id: r._id,
    userId: r.userId?._id ?? r.userId,
    tier: r.tier ?? null,
    status: r.status,
    createdAt: r.createdAt,
    displayName: r.userId?.displayName ?? null,
    email: r.userId?.email ?? null,
    avatarUrl: r.userId?.avatarUrl ?? null,
  })) });
}

// Owner/staff invite a player to the venue's membership. The membership starts as
// a PENDING invite — the player must accept (from their notifications) before it's
// active and member pricing applies. expiresAt is computed only on acceptance.
export async function addVenueMember(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage members' } }, 403);
  const body = addMemberSchema.parse(await c.req.json());
  const member = await User.findById(body.userId).select('_id').lean();
  if (!member) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  const invitedBy = c.get('user').sub;
  const existing = await VenueMember.findOne({ venueId, userId: body.userId });
  if (existing) {
    if (existing.status === 'active' && (!existing.expiresAt || existing.expiresAt > new Date())) return c.json({ error: { code: 'CONFLICT', message: 'This player is already a member' } }, 409);
    if (existing.status === 'pending') return c.json({ data: { ...existing.toObject(), id: existing._id } }); // invite already outstanding — idempotent
    existing.set({ status: 'pending', tier: body.tier ?? existing.tier, expiresAt: null, addedByUserId: invitedBy });
    await existing.save();
    await notifyMembershipInvite(venueId, body.userId);
    return c.json({ data: { ...existing.toObject(), id: existing._id } }, 201);
  }
  const result = await VenueMember.create({ venueId, userId: body.userId, tier: body.tier, status: 'pending', expiresAt: null, addedByUserId: invitedBy });
  await notifyMembershipInvite(venueId, body.userId);
  return c.json({ data: { ...result.toObject(), id: result._id } }, 201);
}

// Tell a player they've been invited to a venue's membership, so they can accept
// or decline it from their notifications (it isn't active until they accept).
async function notifyMembershipInvite(venueId: string, userId: unknown): Promise<void> {
  const venue = await Venue.findById(venueId).select('displayName').lean<{ displayName?: string }>();
  await notifyUser(userId, {
    type: 'venue_membership_invite',
    title: 'Membership invitation',
    body: `${venue?.displayName || 'A venue'} invited you to join their membership. Accept to start enjoying member perks.`,
    icon: 'card_membership',
    linkUrl: `/venues/${venueId}`,
  });
}

// Self-service — the invited player accepts or declines an owner-sent membership
// invite. Accepting flips their pending row to active (and computes expiry from
// the tier cadence); declining marks it declined so it drops from the owner's list.
// Either way the inviting owner is notified of the outcome (best-effort).
export async function respondMembershipInvite(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const userId = c.get('user').sub;
  const body = respondMembershipSchema.parse(await c.req.json().catch(() => ({})));
  const row = await VenueMember.findOne({ venueId, userId, status: 'pending' });
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'No pending membership invite for this venue' } }, 404);
  if (body.accept) {
    // Use the plan the player picked (if the invite had no tier, the app shows a
    // plan picker and sends the chosen planId here). Falls back to whatever tier
    // the owner originally set on the invite, then to null (perpetual).
    const tier = body.planId || (row as any).tier || null;
    row.set({ status: 'active', tier, expiresAt: computeMembershipExpiresAt(tier) });
  } else {
    row.set({ status: 'declined' });
  }
  await row.save();
  if ((row as any).addedByUserId) {
    const [venue, player] = await Promise.all([
      Venue.findById(venueId).select('displayName').lean<{ displayName?: string }>(),
      User.findById(userId).select('displayName').lean<{ displayName?: string }>(),
    ]);
    const who = player?.displayName || 'A player';
    await notifyUser((row as any).addedByUserId, {
      type: 'venue_membership_response',
      title: body.accept ? 'Membership accepted' : 'Membership declined',
      body: body.accept
        ? `${who} accepted your membership invite at ${venue?.displayName || 'your venue'}.`
        : `${who} declined your membership invite at ${venue?.displayName || 'your venue'}.`,
      icon: 'card_membership',
      linkUrl: `/owner/venues/${venueId}?tab=members`,
    });
  }
  return c.json({ data: { ...row.toObject(), id: row._id, accepted: body.accept } });
}

export async function removeVenueMember(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage members' } }, 403);
  const userId = c.req.param('userId');
  await VenueMember.findOneAndUpdate({ venueId, userId }, { status: 'inactive' });
  // Also cancel any linked venue subscription so the plan member count drops to 0.
  await VenueSubscription.findOneAndUpdate({ venueId, userId, status: 'active' }, { status: 'cancelled' });
  // Notify the player they were removed (best-effort).
  const venue = await Venue.findById(venueId).select('displayName').lean<{ displayName?: string }>();
  await notifyUser(userId, {
    type: 'venue_membership_removed',
    title: 'Removed from members',
    body: `You've been removed from the membership at ${venue?.displayName || 'a venue'} by the venue owner.`,
    icon: 'card_membership',
    linkUrl: `/venues/${venueId}`,
  });
  return c.json({ data: { message: 'Member removed' } });
}

// Self-service membership — a signed-in player joins (or switches plans on) this
// venue's membership for themselves. The counterpart to the owner-managed
// addVenueMember; recorded as the same VenueMember row, so it surfaces in the
// owner's Members tab and member pricing (Venue.memberDiscountPercent) applies.
//
// If the player already has an expired membership, this is a renewal — the existing
// row is reactivated and its expiresAt extended. An active membership can still be
// switched to a different plan (same flow, same row).
export async function joinVenueMembership(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const userId = c.get('user').sub;
  const body = joinMembershipSchema.parse(await c.req.json().catch(() => ({})));
  const tier = body.planId ?? null;
  const expiresAt = computeMembershipExpiresAt(tier);
  const existing = await VenueMember.findOne({ venueId, userId });
  if (existing) {
    existing.set({ status: 'active', tier, expiresAt });
    await existing.save();
    void sendMembershipEmail(existing, userId);
    return c.json({ data: { ...existing.toObject(), id: existing._id } });
  }
  const result = await VenueMember.create({ venueId, userId, tier, status: 'active', expiresAt, addedByUserId: userId });
  void sendMembershipEmail(result, userId);
  return c.json({ data: { ...result.toObject(), id: result._id } }, 201);
}

async function sendMembershipEmail(member: any, userId: string) {
  if (!canEmail()) return;
  try {
    const [u, v] = await Promise.all([
      import('../auth/auth.model.js').then(m => m.User.findById(userId).select('email displayName').lean<{ email?: string; displayName?: string }>()),
      Venue.findById(member.venueId).select('displayName').lean<{ displayName?: string }>(),
    ]);
    if (!u?.email) return;
    const tier = (member.tier || 'member') as string;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const cycleLabel = tier === 'monthly' ? 'Monthly' : tier === 'quarterly' ? 'Quarterly' : tier === 'annual' ? 'Annual' : 'Membership';
    const expires = member.expiresAt ? new Date(member.expiresAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No expiry';
    const t = membershipReceipt({
      receipt: `MEM-${String(member._id).slice(-8).toUpperCase()}`,
      venue: v?.displayName || 'the venue',
      plan: tierLabel,
      cycle: cycleLabel,
      amount: 'Free',
      nextBilling: expires,
      benefits: ['Member pricing on court bookings', 'Priority access'],
    });
    await sendEmail({ to: u.email, subject: `Membership confirmed — ${v?.displayName || 'your venue'}`, body: t.text, html: t.html });
  } catch { /* best-effort */ }
}

/** Compute when a membership plan expires from now (UTC), or null if the tier
 *  isn't a recognised cadence (owner-added members or legacy rows stay perpetual). */
function computeMembershipExpiresAt(tier: string | null): Date | null {
  if (!tier) return null;
  const now = new Date();
  switch (tier) {
    case 'monthly':   return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    case 'quarterly': return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    case 'annual':    return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    default:          return null; // unknown tier → perpetual
  }
}

// Self-service — the player cancels their own membership at this venue.
export async function leaveVenueMembership(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const userId = c.get('user').sub;
  await VenueMember.findOneAndUpdate({ venueId, userId }, { status: 'inactive' });
  return c.json({ data: { message: 'Membership cancelled' } });
}

/* ─── Slot price overrides (manual surge) ─────────────────────────── */

// Public read: the active overrides for a venue (optionally a single date), so the
// booking flow can apply the owner's surge/discount rate for a slot. The owner
// management screen lists all of them; the booker only needs the chosen date.
export async function getSlotOverrides(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const date = c.req.query('date');
  const filter: Record<string, any> = { venueId };
  if (date) filter.date = date;
  // Owner/staff see history; the public booking read only needs today onward.
  if (!date && !(await requireVenueManager(c, venueId))) {
    filter.date = { $gte: ymd(new Date()) };
  }
  const rows = await SlotPriceOverride.find(filter).sort({ date: 1, startTime: 1 }).limit(500).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, courtId: r.courtId ? String(r.courtId) : null })) });
}

export async function createSlotOverride(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can set slot pricing' } }, 403);
  const body = createSlotOverrideSchema.parse(await c.req.json());
  if (body.endTime <= body.startTime) return c.json({ error: { code: 'BAD_REQUEST', message: 'End time must be after the start time.' } }, 400);
  if (body.courtId) {
    const court = await Court.findOne({ _id: body.courtId, venueId }).select('_id').lean();
    if (!court) return c.json({ error: { code: 'BAD_REQUEST', message: 'That court does not belong to this venue.' } }, 400);
  }
  const result = await SlotPriceOverride.create({
    venueId, courtId: body.courtId || null, date: body.date, startTime: body.startTime,
    endTime: body.endTime, price: body.price, note: body.note, createdByUserId: c.get('user').sub,
  });
  return c.json({ data: { ...result.toObject(), id: result._id, courtId: result.courtId ? String(result.courtId) : null } }, 201);
}

export async function deleteSlotOverride(c: any) {
  const id = c.req.param('id');
  const row = await SlotPriceOverride.findById(id);
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Slot pricing not found' } }, 404);
  if (!(await requireVenueManager(c, row.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage slot pricing' } }, 403);
  await SlotPriceOverride.findByIdAndDelete(id);
  return c.json({ data: { message: 'Slot pricing removed' } });
}

export async function getVenueFaqs(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await Faq.find({ venueId }).sort({ sortOrder: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function createFaq(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueOwner(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage FAQs' } }, 403);
  const body = createFaqSchema.parse(await c.req.json());
  const result = await Faq.create({ venueId, ...body });
  return c.json({ data: result.toObject() }, 201);
}

export async function updateFaq(c: any) {
  const id = c.req.param('id');
  const faq = await Faq.findById(id);
  if (!faq) return c.json({ error: { code: 'NOT_FOUND', message: 'FAQ not found' } }, 404);
  if (!(await requireVenueOwner(c, faq.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage FAQs' } }, 403);
  const body = updateFaqSchema.parse(await c.req.json());
  const result = await Faq.findByIdAndUpdate(id, body, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

export async function deleteFaq(c: any) {
  const id = c.req.param('id');
  const faq = await Faq.findById(id);
  if (!faq) return c.json({ error: { code: 'NOT_FOUND', message: 'FAQ not found' } }, 404);
  if (!(await requireVenueOwner(c, faq.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can manage FAQs' } }, 403);
  await Faq.findByIdAndDelete(id);
  return c.json({ data: { message: 'FAQ deleted' } });
}

export async function getVenueBookings(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can view bookings' } }, 403);
  const { status } = venueBookingQuerySchema.parse(c.req.query());
  const filter: Record<string, any> = { venueId };
  if (status) filter.status = status;
  // Sort by _id (true insertion order), not createdAt: seeded demo bookings set
  // createdAt to the play-date (sometimes a future date), so a real new booking
  // would sort below them and could fall outside the 50-row cap. The ObjectId's
  // leading bytes are the real creation timestamp, so newest bookings come first.
  const rows = await Booking.find(filter)
    .populate('userId', 'displayName avatarUrl')
    .populate('courtId', 'courtNumber courtName')
    // Cap raised from 50 → 200 so the app has the full per-venue history to
    // filter client-side (When: upcoming/ongoing/past) and sort (play date vs
    // recently booked). Sorted by _id desc so if a venue ever exceeds the cap,
    // the most recently *created* bookings are the ones kept.
    .sort({ _id: -1 }).limit(200).lean();
  await expireOverdueBookings(rows);
  return c.json({ data: rows.map((r: any) => ({
    ...r,
    id: r._id,
    // Flatten the populated booker back to a plain id (the Members tab groups by
    // it); displayName/avatar are surfaced alongside for the booking card.
    userId: r.userId?._id ?? r.userId,
    userName: r.userId?.displayName,
    userAvatarUrl: r.userId?.avatarUrl,
    // courtId was populated to a doc above — flatten back to its id and surface
    // the court's number/name for the booking card.
    courtId: r.courtId?._id ?? r.courtId,
    courtNumber: r.courtId?.courtNumber,
    courtName: r.courtId?.courtName,
  })) });
}

// Owner/staff create a booking directly — a 'manual' off-platform reservation
// (phone / Messenger / IG / walk-in) or a 'blocked' slot the owner takes out of
// availability. The #1 meeting ask: the front desk records bookings made outside
// the app so they reserve the court (double-booking guard runs) and show on the
// schedule. No payment flow — a manual booking is recorded as already settled
// (cash/transfer offline); a block carries no money. Gated to the owner or any
// active staff member (front-desk included), same as the bookings inbox.
export async function createVenueBooking(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can add bookings' } }, 403);
  const user = c.get('user');
  const body = createVenueBookingSchema.parse(await c.req.json());

  if (body.endTime <= body.startTime) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'End time must be after the start time.' } }, 400);
  }

  // Validate the chosen court belongs to this venue (+ split-court bounds), and
  // read its turnover/split config for the clash guard — mirrors createBooking.
  let court: { turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number } | null = null;
  if (body.courtId) {
    court = await Court.findOne({ _id: body.courtId, venueId, isActive: { $ne: false } })
      .select('turnoverMinutes isSplittable splitCount').lean<{ turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number }>();
    if (!court) return c.json({ error: { code: 'BAD_REQUEST', message: 'That court does not belong to this venue.' } }, 400);
    if (body.subUnitIndex != null) {
      if (!court.isSplittable) return c.json({ error: { code: 'BAD_REQUEST', message: 'This court is not splittable.' } }, 400);
      const max = court.splitCount ?? 2;
      if (body.subUnitIndex < 0 || body.subUnitIndex >= max) return c.json({ error: { code: 'BAD_REQUEST', message: `subUnitIndex must be 0–${max - 1}.` } }, 400);
    }
  }

  // Same double-booking guard the player flow runs — no userId (there's no single
  // customer to also check for self-overlap), but the court/pool clash + turnover
  // all apply, so a manual entry can't sit on top of an existing reservation.
  const conflict = await findSlotConflict(
    { venueId, courtId: body.courtId, subUnitIndex: body.subUnitIndex, date: body.date, startTime: body.startTime, endTime: body.endTime },
    null, court?.turnoverMinutes ?? 0, court?.isSplittable ?? false,
  );
  if (conflict) return c.json({ error: { code: 'SLOT_CONFLICT', message: conflict } }, 409);

  const isBlock = body.bookingType === 'blocked';
  const booking = await Booking.create({
    // userId satisfies the required ref; createdByUserId records who entered it.
    userId: user.sub,
    createdByUserId: user.sub,
    venueId,
    courtId: body.courtId || null,
    subUnitIndex: body.subUnitIndex ?? null,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    playerCount: 1,
    amount: isBlock ? 0 : (body.amount ?? 0),
    status: 'confirmed',
    bookingType: body.bookingType,
    paymentMethod: isBlock ? null : (body.paymentMethod || null),
    customerName: isBlock ? null : (body.customerName || null),
    customerPhone: isBlock ? null : (body.customerPhone || null),
    bookingSource: isBlock ? null : (body.bookingSource || null),
    blockReason: isBlock ? (body.blockReason || null) : null,
    notes: body.notes || null,
  });

  // Enrich with the court label so the schedule row reads right without a refetch.
  const courtDoc = body.courtId ? await Court.findById(body.courtId).select('courtNumber courtName').lean<{ courtNumber?: string; courtName?: string }>() : null;
  return c.json({
    data: {
      ...booking.toObject(),
      id: booking._id,
      courtNumber: courtDoc?.courtNumber,
      courtName: courtDoc?.courtName,
    },
  }, 201);
}

/* ─── Recurring bookings (weekly regulars / leagues) ──────────────── */

// Add `weeks` × 7 days to a YYYY-MM-DD string (UTC arithmetic — no TZ drift).
function addWeeks(date: string, weeks: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// Owner/staff create a recurring weekly booking — the same slot repeated for N
// weeks (a regular group, a league night). Each week is double-booking-guarded
// independently, so a week that clashes is SKIPPED (reported back) rather than
// failing the whole series. All created rows share one recurringId so the series
// can be listed and cancelled together.
export async function createRecurringBooking(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can add bookings' } }, 403);
  const user = c.get('user');
  const body = createRecurringBookingSchema.parse(await c.req.json());

  if (body.endTime <= body.startTime) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'End time must be after the start time.' } }, 400);
  }

  // Validate the court (+ split bounds) once; reuse its config for every week.
  let court: { turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number } | null = null;
  if (body.courtId) {
    court = await Court.findOne({ _id: body.courtId, venueId, isActive: { $ne: false } })
      .select('turnoverMinutes isSplittable splitCount').lean<{ turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number }>();
    if (!court) return c.json({ error: { code: 'BAD_REQUEST', message: 'That court does not belong to this venue.' } }, 400);
    if (body.subUnitIndex != null) {
      if (!court.isSplittable) return c.json({ error: { code: 'BAD_REQUEST', message: 'This court is not splittable.' } }, 400);
      const max = court.splitCount ?? 2;
      if (body.subUnitIndex < 0 || body.subUnitIndex >= max) return c.json({ error: { code: 'BAD_REQUEST', message: `subUnitIndex must be 0–${max - 1}.` } }, 400);
    }
  }

  const isBlock = body.bookingType === 'blocked';
  const recurringId = new Types.ObjectId();
  const created: any[] = [];
  const skipped: { date: string; reason: string }[] = [];

  for (let i = 0; i < body.weeks; i++) {
    const date = addWeeks(body.startDate, i * body.weeklyInterval);
    // eslint-disable-next-line no-await-in-loop
    const conflict = await findSlotConflict(
      { venueId, courtId: body.courtId, subUnitIndex: body.subUnitIndex, date, startTime: body.startTime, endTime: body.endTime },
      null, court?.turnoverMinutes ?? 0, court?.isSplittable ?? false,
    );
    if (conflict) { skipped.push({ date, reason: conflict }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const booking = await Booking.create({
      userId: user.sub,
      createdByUserId: user.sub,
      venueId,
      courtId: body.courtId || null,
      subUnitIndex: body.subUnitIndex ?? null,
      date,
      startTime: body.startTime,
      endTime: body.endTime,
      playerCount: 1,
      amount: isBlock ? 0 : (body.amount ?? 0),
      status: 'confirmed',
      bookingType: body.bookingType,
      customerName: isBlock ? null : (body.customerName || null),
      customerPhone: isBlock ? null : (body.customerPhone || null),
      bookingSource: isBlock ? null : (body.bookingSource || null),
      blockReason: isBlock ? (body.blockReason || null) : null,
      notes: body.notes || null,
      recurringId,
    });
    created.push({ ...booking.toObject(), id: booking._id });
  }

  return c.json({ data: { recurringId, created, skipped, createdCount: created.length, skippedCount: skipped.length } }, 201);
}

// List the venue's recurring series — each row summarises one recurringId group
// (the regular's name, court, weekday/time, and how many future dates remain).
export async function getRecurringBookings(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can view bookings' } }, 403);
  const today = ymd(new Date());
  const rows = await Booking.find({ venueId, recurringId: { $ne: null }, status: { $ne: 'cancelled' } })
    .select('recurringId courtId date startTime endTime customerName bookingType blockReason amount')
    .sort({ date: 1 }).lean();
  const courtNames = new Map((await Court.find({ venueId }).select('courtNumber courtName').lean())
    .map((c2: any) => [String(c2._id), c2.courtName || `Court ${c2.courtNumber}`]));
  const groups = new Map<string, any>();
  for (const b of rows as any[]) {
    const key = String(b.recurringId);
    const g = groups.get(key) ?? {
      recurringId: key,
      bookingType: b.bookingType,
      courtId: b.courtId ? String(b.courtId) : null,
      courtName: b.courtId ? (courtNames.get(String(b.courtId)) ?? 'Court') : 'Any court',
      label: b.bookingType === 'blocked' ? (b.blockReason || 'Recurring block') : (b.customerName || 'Recurring booking'),
      startTime: b.startTime, endTime: b.endTime, amount: b.amount,
      dates: [] as string[], upcomingCount: 0, totalCount: 0,
    };
    g.dates.push(b.date);
    g.totalCount += 1;
    if (b.date >= today) g.upcomingCount += 1;
    groups.set(key, g);
  }
  const series = [...groups.values()].map((g) => ({
    ...g,
    firstDate: g.dates[0],
    lastDate: g.dates[g.dates.length - 1],
    dayOfWeek: g.dates[0] ? new Date(g.dates[0] + 'T00:00:00Z').getUTCDay() : null,
  }));
  return c.json({ data: series });
}

// Cancel a recurring series — cancels its FUTURE (today-onward) instances,
// leaving past ones intact for history/revenue. Owner/staff only.
export async function cancelRecurringBooking(c: any) {
  const recurringId = c.req.param('recurringId');
  const sample = await Booking.findOne({ recurringId }).select('venueId').lean<{ venueId?: any }>();
  if (!sample) return c.json({ error: { code: 'NOT_FOUND', message: 'Recurring booking not found' } }, 404);
  if (!(await requireVenueManager(c, String(sample.venueId)))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage bookings' } }, 403);
  const today = ymd(new Date());
  const result = await Booking.updateMany(
    { recurringId, date: { $gte: today }, status: { $ne: 'cancelled' } },
    { status: 'cancelled', cancellationReason: 'Recurring series cancelled', cancelledAt: new Date() },
  );
  return c.json({ data: { cancelled: result.modifiedCount ?? 0 } });
}

// Public per-hour court availability for a venue on a date. Powers the booking
// screens' time pickers (greys out hours with no free court). Mirrors the same
// pool model the create-booking guard enforces, so the pre-check never disagrees
// with the server. Open (no auth): it only exposes free-court counts, no PII.
const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // When the booker has chosen a specific court, scope availability to that one
  // court (capacity 1) so the time picker greys the hours *that court* is taken,
  // not the whole venue pool. Omit for the legacy venue-level pool view.
  courtId: z.string().optional(),
});

export async function getVenueAvailability(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const { date, courtId } = availabilityQuerySchema.parse(c.req.query());

  // Per-court view: a court is free for an hour only when it isn't itself booked
  // AND the venue pool still has a court to spare — court-less (venue-level)
  // reservations consume the pool even though they don't name a court, so a named
  // court can't show free once every physical court is taken. This keeps the
  // picker in lockstep with the create-time guard (which enforces the same pool).
  // Split-court: a splittable court shows `capacity: splitCount` and `free` reports
  // how many sub-units are still available per hour.
  if (courtId) {
    const all = await activeBookingsForDate(venueId, date);
    const court = await Court.findById(courtId).select('turnoverMinutes isSplittable splitCount').lean<{ turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number }>();
    const subCount = court?.isSplittable ? (court.splitCount ?? 2) : 1;

    // For splittable courts, compute per-sub-unit free counts. A whole-court booking
    // (subUnitIndex unset) consumes ALL sub-units for its hours; a sub-unit booking
    // consumes only its own sub-unit. Non-splittable courts stay as before.
    if (subCount > 1) {
      const courtBookings = all.filter((b) => String(b.courtId) === courtId);
      const freeByHour = new Array(24).fill(subCount);
      for (const b of courtBookings) {
        for (const h of hoursTouched(b.startTime, b.endTime)) {
          if (b.subUnitIndex == null) {
            // Whole-court booking — blocks all sub-units.
            freeByHour[h] = 0;
          } else {
            freeByHour[h] = Math.max(0, freeByHour[h] - 1);
          }
        }
      }
      // Intersect with venue pool: if the venue as a whole is out of capacity the
      // court can't be booked either.
      const capacity = await resolveVenueCapacity(venueId);
      const poolFree = freeCourtsByHour(all, capacity);
      const hours = freeByHour.map((fc, hour) => ({ hour, free: Math.min(fc, (poolFree[hour] ?? 0) > 0 ? fc : 0) }));
      return c.json({ data: { date, capacity: subCount, courtId, hours, isSplittable: true } });
    }

    const capacity = await resolveVenueCapacity(venueId);
    const poolFree = freeCourtsByHour(all, capacity);
    // Court-specific occupancy honors the court's turnover buffer (a gap after each
    // booking), so the picker greys the same too-close hours the create guard rejects.
    const courtFree = courtFreeHoursWithTurnover(all.filter((b) => String(b.courtId) === courtId), court?.turnoverMinutes ?? 0);
    const hours = poolFree.map((pf, hour) => ({ hour, free: courtFree[hour] && pf > 0 ? 1 : 0 }));
    return c.json({ data: { date, capacity: 1, courtId, hours } });
  }

  const capacity = await resolveVenueCapacity(venueId);
  const free = freeCourtsByHour(await activeBookingsForDate(venueId, date), capacity);
  // hours[h].free = courts free for the slot starting at hour h (a booking can
  // start there when free > 0). The client greys hours where free <= 0.
  const hours = free.map((freeCourts, hour) => ({ hour, free: freeCourts }));
  return c.json({ data: { date, capacity, hours } });
}

// Per-DAY availability across a date range — powers the booking calendar's
// "fully booked" day markers, so a player can avoid dead days before tapping in.
// For each date it reports how many of the venue's *open* start-hours still have a
// free court; `full` = the day is open but every open hour is taken. One batched
// bookings query for the whole range keeps it to ~constant cost. Public (no PII),
// like the single-date availability above. Capped to 62 days per request.
const availabilityRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Same as the single-date endpoint: scope "full" to one court when chosen.
  courtId: z.string().optional(),
});

const RANGE_DAY_MS = 86_400_000;
const RANGE_MAX_DAYS = 62;

export async function getVenueAvailabilityRange(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const { from, to, courtId } = availabilityRangeQuerySchema.parse(c.req.query());
  if (to < from) return c.json({ error: { code: 'BAD_REQUEST', message: '`to` must be on or after `from`' } }, 400);

  // Every date in [from, to] (UTC-stepped so DST can't drop/duplicate a day).
  const dates: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`) && dates.length < RANGE_MAX_DAYS;
    t += RANGE_DAY_MS
  ) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }

  const capacity = await resolveVenueCapacity(venueId);

  // Bookable start-hour window per weekday (0=Sun..6=Sat). Hours now live per
  // court (a null courtId is the venue default a court inherits), so the venue
  // window is the UNION across courts — open when ANY court is open, from the
  // earliest open to the latest close. When a court is chosen, scope to its own
  // effective window. A day with no row, or all-closed, has no window (rendered
  // "closed", never "full"); no hours at all → assume all-day so "full" means
  // every hour's pool is exhausted.
  const allHourRows = await VenueHour.find({ venueId })
    .lean<{ dayOfWeek: number; courtId?: any; price?: number | null; isClosed?: boolean; openTime?: string; closeTime?: string }[]>();
  const defaultHourRows = allHourRows.filter((h) => h.courtId == null);
  const effFor = (cid: string) => {
    const own = allHourRows.filter((h) => h.courtId != null && String(h.courtId) === cid);
    return own.length ? own : defaultHourRows;
  };
  let rowSets: typeof allHourRows[];
  if (courtId) {
    rowSets = [effFor(courtId)];
  } else {
    const cts = await Court.find({ venueId, isActive: true }).select('_id').lean<{ _id: any }[]>();
    rowSets = cts.length ? cts.map((ct) => effFor(String(ct._id))) : [defaultHourRows];
  }
  const windowByDow = new Map<number, { open: number; lastStart: number } | null>();
  for (let dow = 0; dow < 7; dow++) {
    let open: number | null = null, lastStart: number | null = null, anyRow = false;
    for (const rows of rowSets) {
      const dayRows = rows.filter((h) => h.dayOfWeek === dow);
      if (!dayRows.length) continue;
      anyRow = true;
      const op = dayRows.find((h) => h.price == null) || dayRows[0];
      if (!op || op.isClosed || !op.openTime || !op.closeTime) continue;
      const o = Number(op.openTime.split(':')[0]) || 0;
      const cparts = op.closeTime.split(':').map(Number);
      const ls = (cparts[1] ?? 0) > 0 ? (cparts[0] ?? 0) : (cparts[0] ?? 0) - 1;
      if (ls < o) continue;
      if (open == null || o < open) open = o;
      if (lastStart == null || ls > lastStart) lastStart = ls;
    }
    if (anyRow) windowByDow.set(dow, open != null && lastStart != null ? { open, lastStart } : null);
  }
  const hasHours = allHourRows.length > 0;

  // All active bookings across the range, grouped by date (one query).
  const bookings = await Booking.find({ venueId, date: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } })
    .select('date startTime endTime courtId subUnitIndex')
    .lean<{ date: string; startTime?: string | null; endTime?: string | null; courtId?: any; subUnitIndex?: number | null }[]>();
  const byDate = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const arr = byDate.get(b.date);
    if (arr) arr.push(b); else byDate.set(b.date, [b]);
  }

  // Per-court turnover buffer + split-court config — fetched once (not per-date)
  // since the court's setting doesn't change mid-request.
  const courtConfig = courtId
    ? await Court.findById(courtId).select('turnoverMinutes isSplittable splitCount').lean<{ turnoverMinutes?: number; isSplittable?: boolean; splitCount?: number }>()
    : null;
  const courtTurnover = courtConfig?.turnoverMinutes ?? 0;
  const courtSubCount = courtConfig?.isSplittable ? (courtConfig.splitCount ?? 2) : 1;

  const days = dates.map((date) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const win = hasHours ? (windowByDow.get(dow) ?? null) : { open: 0, lastStart: 23 };
    if (!win) return { date, openHours: 0, freeHours: 0, full: false, closed: true };
    const dayBookings = byDate.get(date) ?? [];
    let free: number[];
    if (courtId) {
      if (courtSubCount > 1) {
        // Splittable court: per-sub-unit free counts. Whole-court bookings (no
        // subUnitIndex) consume all sub-units; sub-unit bookings consume one each.
        const freeByHour = new Array(24).fill(courtSubCount);
        for (const b of dayBookings.filter((b) => String(b.courtId) === courtId)) {
          for (const h of hoursTouched(b.startTime, b.endTime)) {
            if (b.subUnitIndex == null) { freeByHour[h] = 0; }
            else { freeByHour[h] = Math.max(0, freeByHour[h] - 1); }
          }
        }
        const poolFree = freeCourtsByHour(dayBookings, capacity);
        free = freeByHour.map((fc, hour) => Math.min(fc, (poolFree[hour] ?? 0) > 0 ? fc : 0));
      } else {
        const poolFree = freeCourtsByHour(dayBookings, capacity);
        // Honor the court's turnover buffer (gap between bookings), same as the
        // single-date endpoint + create-time clash guard.
        const courtFree = courtFreeHoursWithTurnover(dayBookings.filter((b) => String(b.courtId) === courtId), courtTurnover);
        free = poolFree.map((pf, hour) => ((courtFree[hour]) && pf > 0 ? 1 : 0));
      }
    } else {
      free = freeCourtsByHour(dayBookings, capacity);
    }
    let openHours = 0, freeHours = 0;
    for (let h = win.open; h <= win.lastStart; h++) { openHours++; if ((free[h] ?? 0) > 0) freeHours++; }
    return { date, openHours, freeHours, full: openHours > 0 && freeHours === 0, closed: false };
  });

  return c.json({ data: { from, to, capacity: courtId ? courtSubCount : capacity, courtId, days } });
}

export async function updateBookingStatus(c: any) {
  const rawId = c.req.param('id');
  const bookingId = c.req.param('bookingId');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage bookings' } }, 403);
  const booking = await Booking.findOne({ _id: bookingId, venueId });
  if (!booking) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found for this venue' } }, 404);
  const { status, cancellationReason } = updateBookingStatusSchema.parse(await c.req.json());
  if (booking.status === 'cancelled') return c.json({ error: { code: 'CONFLICT', message: "Cannot update a booking with status 'cancelled'" } }, 409);
  const update: Record<string, any> = { status };
  if (status === 'cancelled') { update.cancelledAt = new Date(); if (cancellationReason) update.cancellationReason = cancellationReason; }
  // Approving a request-to-book: start the player's pay-window (per-venue length)
  // so it can lazily expire if they don't pay in time.
  if (status === 'awaiting_payment') {
    const venue = await Venue.findById(venueId).select('bookingPayWindowHours displayName').lean<{ bookingPayWindowHours?: number; displayName?: string }>();
    const hours = venue?.bookingPayWindowHours ?? 24;
    update.paymentDueAt = new Date(Date.now() + hours * 3_600_000);
  }
  const result = await Booking.findByIdAndUpdate(bookingId, update, { new: true }).lean();
  // Tell the booker their request was approved and they need to pay to confirm.
  if (status === 'awaiting_payment' && result) {
    const venue = await Venue.findById(venueId).select('displayName bookingPayWindowHours').lean<{ displayName?: string; bookingPayWindowHours?: number }>();
    const hours = venue?.bookingPayWindowHours ?? 24;
    const windowLabel = hours % 24 === 0 ? `${hours / 24} day${hours / 24 === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`;
    await notifyUser((result as any).userId, {
      type: 'booking_approved',
      title: 'Booking approved — pay to confirm',
      body: `${venue?.displayName || 'The venue'} approved your booking. Pay within ${windowLabel} to confirm your court.`,
      icon: 'calendar',
      linkUrl: '/my-bookings',
    });

    // Send approval email (best-effort).
    if (canEmail()) {
      void (async () => {
        try {
          const u = await import('../auth/auth.model.js').then(m => m.User.findById((result as any).userId).select('email').lean<{ email?: string }>());
          if (u?.email) {
            const deadline = new Date((result as any).paymentDueAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const t = bookingApprovedReceipt({
              receipt: String((result as any)._id).slice(-8).toUpperCase(),
              venue: venue?.displayName || 'the venue',
              date: fmtDate((result as any).date),
              start: fmtTime((result as any).startTime), end: fmtTime((result as any).endTime),
              total: `₱${Number((result as any).amount || 0).toFixed(2)}`,
              deadline,
              payUrl: 'https://pickleballer-pwa.eunika.xyz/my-bookings',
            });
            await sendEmail({ to: u.email, subject: `Booking approved — ${venue?.displayName || 'your booking'}`, body: t.text, html: t.html });
          }
        } catch { /* best-effort */ }
      })();
    }
  }
  return c.json({ data: { ...result, id: result!._id } });
}

/* ─── Analytics ───────────────────────────────────────────────────── */

const REVENUE_STATUSES = ['confirmed', 'paid'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// "HH:MM" → minutes since midnight (null if unparseable).
function toMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
// Booked court-hours a single booking represents (defaults to 1h when times missing).
function bookedHours(b: any): number {
  const s = toMin(b.startTime);
  const e = toMin(b.endTime);
  if (s == null || e == null || e <= s) return 1;
  return (e - s) / 60;
}

// Owner-gated venue analytics: revenue/bookings trends, occupancy, peak hours,
// per-court revenue and top customers. Aggregated in JS over a single windowed
// query — booking volume per venue is modest, and this keeps the math readable.
export async function getVenueAnalytics(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  // Revenue/analytics is the owner + manager view; a front-desk staffer handles
  // bookings but doesn't see the money view.
  const role = await getVenueManagerRole(c, venueId);
  if (role !== 'owner' && role !== 'manager') return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or a manager can view analytics' } }, 403);
  const { days } = venueAnalyticsQuerySchema.parse(c.req.query());

  const now = new Date();
  const today = ymd(now);
  const windowStartDate = new Date(now); windowStartDate.setDate(now.getDate() - (days - 1)); windowStartDate.setHours(0, 0, 0, 0);
  const windowStart = ymd(windowStartDate);
  // Monday-based week start.
  const weekStartDate = new Date(now); weekStartDate.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStartDate.setHours(0, 0, 0, 0);
  const weekStart = ymd(weekStartDate);
  const prevWeekStartDate = new Date(weekStartDate); prevWeekStartDate.setDate(weekStartDate.getDate() - 7);
  const prevWeekStart = ymd(prevWeekStartDate);
  const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevMonthStart = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const [bookings, courts, hours] = await Promise.all([
    Booking.find({ venueId, date: { $gte: windowStart } }).populate('userId', 'displayName').lean(),
    Court.find({ venueId, isActive: true }).lean(),
    VenueHour.find({ venueId }).lean(),
  ]);

  const isRevenue = (b: any) => REVENUE_STATUSES.includes(b.status);
  const sumIf = (pred: (b: any) => boolean) => bookings.filter(pred).reduce((t, b) => t + (b.amount || 0), 0);
  const countIf = (pred: (b: any) => boolean) => bookings.filter(pred).length;

  const revenue = {
    today: sumIf((b) => isRevenue(b) && b.date === today),
    week: sumIf((b) => isRevenue(b) && b.date >= weekStart),
    month: sumIf((b) => isRevenue(b) && b.date >= monthStart),
    prevMonth: sumIf((b) => isRevenue(b) && b.date >= prevMonthStart && b.date < monthStart),
    momChangePct: 0,
  };
  revenue.momChangePct = revenue.prevMonth > 0
    ? Math.round(((revenue.month - revenue.prevMonth) / revenue.prevMonth) * 100)
    : (revenue.month > 0 ? 100 : 0);

  const bookingsKpi = {
    today: countIf((b) => b.date === today && b.status !== 'cancelled'),
    pending: countIf((b) => b.status === 'pending_approval'),
    upcoming: countIf((b) => b.date >= today && b.status !== 'cancelled'),
    week: countIf((b) => b.date >= weekStart && b.status !== 'cancelled'),
    prevWeek: countIf((b) => b.date >= prevWeekStart && b.date < weekStart && b.status !== 'cancelled'),
  };

  // Occupancy = booked court-hours ÷ available court-hours over the period.
  const courtCount = courts.length || 0;
  const weeklyOpenHours = hours.reduce((t, h: any) => {
    if (h.isClosed) return t;
    const o = toMin(h.openTime); const cl = toMin(h.closeTime);
    return (o != null && cl != null && cl > o) ? t + (cl - o) / 60 : t;
  }, 0);
  const weeklyAvailable = weeklyOpenHours * courtCount;
  const bookedHoursIn = (pred: (b: any) => boolean) =>
    bookings.filter((b) => b.status !== 'cancelled' && pred(b)).reduce((t, b) => t + bookedHours(b), 0);
  const occPct = (booked: number, available: number) => (available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0);
  const occupancyPct = {
    week: occPct(bookedHoursIn((b) => b.date >= weekStart), weeklyAvailable),
    prevWeek: occPct(bookedHoursIn((b) => b.date >= prevWeekStart && b.date < weekStart), weeklyAvailable),
  };

  // Daily series — fill every day in the window for continuous charts.
  const revByDay = new Map<string, { amount: number; bookings: number }>();
  const bookByDay = new Map<string, { confirmed: number; paid: number; pending: number; cancelled: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(windowStartDate); d.setDate(windowStartDate.getDate() + i);
    const key = ymd(d);
    revByDay.set(key, { amount: 0, bookings: 0 });
    bookByDay.set(key, { confirmed: 0, paid: 0, pending: 0, cancelled: 0 });
  }
  for (const b of bookings) {
    const r = revByDay.get(b.date);
    if (r && isRevenue(b)) { r.amount += b.amount || 0; r.bookings += 1; }
    const bk = bookByDay.get(b.date);
    if (bk) {
      if (b.status === 'confirmed') bk.confirmed += 1;
      else if (b.status === 'paid') bk.paid += 1;
      else if (b.status === 'cancelled') bk.cancelled += 1;
      else bk.pending += 1;
    }
  }
  const revenueDaily = [...revByDay.entries()].map(([date, v]) => ({ date, ...v }));
  const bookingsDaily = [...bookByDay.entries()].map(([date, v]) => ({ date, ...v }));

  // Per-court revenue.
  const courtNumberById = new Map(courts.map((c2: any) => [c2._id.toString(), c2.courtNumber]));
  const byCourtMap = new Map<string, { courtId: string; courtNumber: any; amount: number; bookings: number }>();
  for (const b of bookings) {
    if (!b.courtId) continue;
    const id = b.courtId.toString();
    const row = byCourtMap.get(id) || { courtId: id, courtNumber: courtNumberById.get(id) ?? '—', amount: 0, bookings: 0 };
    if (isRevenue(b)) row.amount += b.amount || 0;
    if (b.status !== 'cancelled') row.bookings += 1;
    byCourtMap.set(id, row);
  }
  const byCourt = [...byCourtMap.values()].sort((a, b) => b.amount - a.amount);

  // Peak hours — dayOfWeek (0=Sun..6=Sat) × hour, non-cancelled bookings.
  const peakMap = new Map<string, { dayOfWeek: number; hour: number; bookings: number }>();
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const mins = toMin(b.startTime);
    if (mins == null) continue;
    const dow = new Date(`${b.date}T00:00:00`).getDay();
    const hour = Math.floor(mins / 60);
    const key = `${dow}-${hour}`;
    const row = peakMap.get(key) || { dayOfWeek: dow, hour, bookings: 0 };
    row.bookings += 1;
    peakMap.set(key, row);
  }
  const peakHours = [...peakMap.values()];

  // Top customers by spend.
  const custMap = new Map<string, { userId: string; name: string; bookings: number; spend: number }>();
  for (const b of bookings) {
    if (!b.userId) continue;
    const u: any = b.userId;
    const id = (u._id || u).toString();
    const row = custMap.get(id) || { userId: id, name: u.displayName || 'Player', bookings: 0, spend: 0 };
    if (b.status !== 'cancelled') row.bookings += 1;
    if (isRevenue(b)) row.spend += b.amount || 0;
    custMap.set(id, row);
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.spend - a.spend).slice(0, 8);

  return c.json({
    data: { kpis: { revenue, bookings: bookingsKpi, occupancyPct }, revenueDaily, bookingsDaily, byCourt, peakHours, topCustomers },
  });
}

/* ─── Subscription Plans ─────────────────────────────────────────── */

function planVersionView(v: any) {
  return {
    id: v._id,
    planId: v.planId,
    versionNumber: v.versionNumber,
    price: v.price,
    currency: v.currency,
    billingCycle: v.billingCycle,
    customBillingDays: v.customBillingDays ?? null,
    benefits: v.benefits ?? [],
    maxMembers: v.maxMembers ?? null,
    freeTrialDays: v.freeTrialDays ?? null,
    autoRenew: v.autoRenew ?? true,
    createdAt: v.createdAt,
  };
}

async function planView(p: any) {
  const version = p.currentVersionId
    ? await SubscriptionPlanVersion.findById(p.currentVersionId).lean()
    : null;
  // Count active subscribers linked to this plan.
  const memberCount = await VenueSubscription.countDocuments({ planId: p._id, status: 'active' });
  return {
    id: p._id,
    venueId: p.venueId,
    name: p.name,
    description: p.description ?? '',
    status: p.status,
    memberCount,
    currentVersion: version ? planVersionView(version) : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Compute the next renewal date from now given a billing cycle. */
function computeRenewalDate(billingCycle: string, customBillingDays: number | null): Date | null {
  const now = new Date();
  switch (billingCycle) {
    case 'weekly':      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    case 'monthly':     return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    case 'quarterly':   return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    case 'semiAnnual':  return new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    case 'annual':      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    case 'custom':      return customBillingDays ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + customBillingDays) : null;
    default:            return null;
  }
}

/** Determine whether editing a plan should create a new version.
 *  A new version is created when price, billing cycle, custom billing days,
 *  or benefits change — those are the fields that affect what the subscriber gets.
 *  Name, description, status changes are cosmetic and don't create a new version. */
function shouldCreateNewVersion(
  current: any,
  update: z.infer<typeof updateSubscriptionPlanSchema>,
): boolean {
  if (update.price !== undefined && update.price !== current.price) return true;
  if (update.billingCycle !== undefined && update.billingCycle !== current.billingCycle) return true;
  if (update.customBillingDays !== undefined && update.customBillingDays !== (current.customBillingDays ?? null)) return true;
  if (update.benefits !== undefined) {
    const cur = (current.benefits ?? []) as string[];
    const upd = update.benefits as string[];
    if (cur.length !== upd.length || !cur.every((b, i) => b === upd[i])) return true;
  }
  return false;
}

/** List all subscription plans for a venue (owner/staff). */
export async function listSubscriptionPlans(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  const rows = await SubscriptionPlan.find({ venueId }).sort({ createdAt: -1 }).lean();
  const plans = await Promise.all(rows.map(planView));
  return c.json({ data: plans });
}

/** Create a new subscription plan — also creates its first version. */
export async function createSubscriptionPlan(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await requireVenueManager(c, venueId))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  const body = createSubscriptionPlanSchema.parse(await c.req.json());
  const plan = await SubscriptionPlan.create({
    venueId,
    name: body.name,
    description: body.description ?? '',
    status: body.status ?? 'draft',
  });
  const version = await SubscriptionPlanVersion.create({
    planId: plan._id,
    versionNumber: 1,
    price: body.price,
    currency: body.currency ?? 'PHP',
    billingCycle: body.billingCycle,
    customBillingDays: body.customBillingDays ?? null,
    benefits: body.benefits ?? [],
    maxMembers: body.maxMembers ?? null,
    freeTrialDays: body.freeTrialDays ?? null,
    autoRenew: body.autoRenew ?? true,
  });
  plan.currentVersionId = version._id;
  await plan.save();
  return c.json({ data: await planView(plan.toObject()) }, 201);
}

/** Get a single subscription plan by id (owner/staff). */
export async function getSubscriptionPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId')).lean();
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (!(await requireVenueManager(c, (plan as any).venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  return c.json({ data: await planView(plan) });
}

/** Update a subscription plan. If price/billing/benefits changed, creates a new
 *  version (existing subscribers keep their version until renewal). Cosmetic
 *  changes (name, description, status) apply in-place without versioning. */
export async function updateSubscriptionPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId'));
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (!(await requireVenueManager(c, plan.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  const body = updateSubscriptionPlanSchema.parse(await c.req.json());

  // Cosmetic fields — apply directly.
  if (body.name !== undefined) plan.name = body.name;
  if (body.description !== undefined) plan.description = body.description;
  if (body.status !== undefined) plan.status = body.status;

  // Structural fields — if they changed, create a new version.
  const currentVersion = plan.currentVersionId
    ? await SubscriptionPlanVersion.findById(plan.currentVersionId).lean()
    : null;
  if (shouldCreateNewVersion(currentVersion ?? {}, body)) {
    const nextNum = currentVersion ? (currentVersion as any).versionNumber + 1 : 1;
    const version = await SubscriptionPlanVersion.create({
      planId: plan._id,
      versionNumber: nextNum,
      price: body.price ?? currentVersion?.price ?? 0,
      currency: body.currency ?? (currentVersion as any)?.currency ?? 'PHP',
      billingCycle: body.billingCycle ?? (currentVersion as any)?.billingCycle ?? 'monthly',
      customBillingDays: body.customBillingDays !== undefined ? body.customBillingDays : (currentVersion as any)?.customBillingDays ?? null,
      benefits: body.benefits ?? (currentVersion as any)?.benefits ?? [],
      maxMembers: body.maxMembers !== undefined ? body.maxMembers : (currentVersion as any)?.maxMembers ?? null,
      freeTrialDays: body.freeTrialDays !== undefined ? body.freeTrialDays : (currentVersion as any)?.freeTrialDays ?? null,
      autoRenew: body.autoRenew !== undefined ? body.autoRenew : (currentVersion as any)?.autoRenew ?? true,
    });
    plan.currentVersionId = version._id;
  }

  await plan.save();
  return c.json({ data: await planView(plan.toObject()) });
}

/** Delete a subscription plan. Only allowed if it has no active subscribers. */
export async function deleteSubscriptionPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId'));
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (!(await requireVenueManager(c, plan.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  const activeCount = await VenueSubscription.countDocuments({ planId: plan._id, status: 'active' });
  if (activeCount > 0) return c.json({ error: { code: 'CONFLICT', message: `Cannot delete — this plan has ${activeCount} active subscriber${activeCount === 1 ? '' : 's'}. Disable it instead.` } }, 409);
  await SubscriptionPlanVersion.deleteMany({ planId: plan._id });
  await SubscriptionPlan.findByIdAndDelete(plan._id);
  return c.json({ data: { message: 'Plan deleted' } });
}

/** Duplicate a subscription plan — copies the current version as version 1 of a new plan. */
export async function duplicateSubscriptionPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId'));
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (!(await requireVenueManager(c, plan.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  const curVersion = plan.currentVersionId
    ? await SubscriptionPlanVersion.findById(plan.currentVersionId).lean()
    : null;
  const dup = await SubscriptionPlan.create({
    venueId: plan.venueId,
    name: `${plan.name} (copy)`,
    description: plan.description,
    status: 'draft',
  });
  const v = curVersion as any;
  const version = await SubscriptionPlanVersion.create({
    planId: dup._id,
    versionNumber: 1,
    price: v?.price ?? 0,
    currency: v?.currency ?? 'PHP',
    billingCycle: v?.billingCycle ?? 'monthly',
    customBillingDays: v?.customBillingDays ?? null,
    benefits: v?.benefits ?? [],
    maxMembers: v?.maxMembers ?? null,
    freeTrialDays: v?.freeTrialDays ?? null,
    autoRenew: v?.autoRenew ?? true,
  });
  dup.currentVersionId = version._id;
  await dup.save();
  return c.json({ data: await planView(dup.toObject()) }, 201);
}

/** Toggle a plan between active and disabled (preserves draft). */
export async function toggleSubscriptionPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId'));
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (!(await requireVenueManager(c, plan.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner or staff can manage subscription plans' } }, 403);
  if (plan.status === 'draft') return c.json({ error: { code: 'CONFLICT', message: 'Draft plans must be saved as active first — edit the plan to change its status.' } }, 409);
  plan.status = plan.status === 'active' ? 'disabled' : 'active';
  await plan.save();
  return c.json({ data: await planView(plan.toObject()) });
}

/** Public: list active subscription plans for a venue (players browsing). */
export async function listPublicPlans(c: any) {
  const rawId = c.req.param('id');
  const venueId = await resolveVenueId(rawId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const rows = await SubscriptionPlan.find({ venueId, status: 'active' }).sort({ createdAt: -1 }).lean();
  const plans = await Promise.all(rows.map(planView));
  return c.json({ data: plans });
}

/** Self-service: a signed-in player subscribes to a plan. Links the subscription
 *  to the player's VenueMember row (joins the membership if not already a member). */
export async function subscribeToPlan(c: any) {
  const plan = await SubscriptionPlan.findById(c.req.param('planId'));
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  if (plan.status !== 'active') return c.json({ error: { code: 'FORBIDDEN', message: 'This plan is not currently available' } }, 403);
  const version = await SubscriptionPlanVersion.findById(plan.currentVersionId).lean();
  if (!version) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan version not found' } }, 404);
  const userId = c.get('user').sub;
  const venueId = plan.venueId;

  // Check member cap.
  if ((version as any).maxMembers) {
    const activeCount = await VenueSubscription.countDocuments({ planId: plan._id, status: 'active' });
    if (activeCount >= (version as any).maxMembers) return c.json({ error: { code: 'CONFLICT', message: 'This plan has reached its member limit' } }, 409);
  }

  // Upsert VenueMember row — if the player is already a member (invited or legacy),
  // reactivate it. Otherwise create a new self-join row.
  const renewalDate = computeRenewalDate((version as any).billingCycle, (version as any).customBillingDays);
  const trialEnd = (version as any).freeTrialDays
    ? new Date(Date.now() + (version as any).freeTrialDays * 86400000)
    : null;

  const existingMember = await VenueMember.findOne({ venueId, userId });
  let venueMemberId: any;
  if (existingMember) {
    existingMember.set({ status: 'active', tier: plan.name, expiresAt: trialEnd ?? renewalDate });
    await existingMember.save();
    venueMemberId = existingMember._id;
  } else {
    const member = await VenueMember.create({
      venueId, userId, tier: plan.name,
      status: 'active', expiresAt: trialEnd ?? renewalDate,
      addedByUserId: userId,
    });
    venueMemberId = member._id;
  }

  // Upsert Subscription row.
  const existingSub = await VenueSubscription.findOne({ userId, venueId });
  if (existingSub) {
    existingSub.set({
      planVersionId: version._id, planId: plan._id, venueId,
      status: 'active', startedAt: new Date(), renewalDate,
      venueMemberId,
    });
    await existingSub.save();
    if (existingMember) void sendMembershipEmail(existingMember, userId);
    return c.json({ data: { ...existingSub.toObject(), id: existingSub._id, venueMemberId } });
  }
  const sub = await VenueSubscription.create({
    userId, planVersionId: version._id, planId: plan._id, venueId,
    status: 'active', startedAt: new Date(), renewalDate,
    venueMemberId,
  });
  // Send membership email for newly created member.
  if (venueMemberId) {
    const member = await VenueMember.findById(venueMemberId);
    if (member) void sendMembershipEmail(member, userId);
  }
  return c.json({ data: { ...sub.toObject(), id: sub._id, venueMemberId } }, 201);
}

/* ─── Venue Pricing (imported data — read-only) ──────────────────── */

/** GET /venues/:id/pricing — list the imported rich pricing rows for a venue
 *  (per-audience, per-day, per-time-window). Public, read-only. */
export async function listVenuePricing(c: any) {
  const venue = await resolveVenue(c.req.param('id'));
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found.' } }, 404);
  const rows = await VenuePricing.find({ venueId: venue._id }).sort({ label: 1 }).lean();
  return c.json({ data: rows });
}
