import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IVenue {
  _id: Types.ObjectId;
  slug: string;
  displayName: string;
  venueId?: string;
  venueType?: string;
  listingStatus?: string;
  isVerified?: boolean;
  alternateNames?: string[];
  ownerUserId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  /** Free-text city name — used when the city isn't one of our seeded `City` docs. */
  cityName?: string;
  area?: string;
  country?: string;
  region?: string;
  fullAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  googleMapsUrl?: string;
  directionsShort?: string;
  state?: string;
  oneLineSummary?: string;
  description?: string;
  bestFor?: string[];
  whatPlayersLike?: string[];
  thingsToKnow?: string[];
  indoorOutdoor?: string;
  coveredUncovered?: string;
  courtCount: number;
  surfaceType?: string;
  hasOpenPlay?: boolean;
  hasCoaching?: boolean;
  hasCourtRental?: boolean;
  isBeginnerFriendly?: boolean;
  hasParking?: boolean;
  hasToilets?: boolean;
  hasShowers?: boolean;
  hasFoodBeverage?: boolean;
  hasAc?: boolean;
  hasLighting?: boolean;
  hasSeating?: boolean;
  hasPaddleRental?: boolean;
  hasProShop?: boolean;
  hasDedicatedLines?: boolean;
  hasPermanentNets?: boolean;
  allowsWalkins?: boolean;
  amenityChips?: string[];
  customAmenities?: string[];
  amenityAirConditioning?: boolean;
  amenityTournamentLighting?: boolean;
  amenityParking?: boolean;
  amenityShowers?: boolean;
  amenityLockers?: boolean;
  amenitySeatingArea?: boolean;
  amenityWaterRefill?: boolean;
  amenityCafeFood?: boolean;
  amenityPaddleRental?: boolean;
  amenityProShop?: boolean;
  amenityWifi?: boolean;
  amenityCoveredTerrace?: boolean;
  priceFrom?: number;
  priceType?: string;
  priceFromLabel?: string;
  peakPrice?: number;
  offPeakPrice?: number;
  openPlayPrice?: number;
  equipmentRentalPrice?: number;
  // ── Day-based pricing (weekday/weekend/holiday) ── flat hourly rate overrides
  // applied by day type when no more-specific time-block rate covers the slot.
  weekendPrice?: number;
  holidayPrice?: number;
  // YYYY-MM-DD dates treated as holidays (holidayPrice applies).
  holidayDates?: string[];
  // ── Member pricing ── % discount off the resolved hourly rate for venue members.
  memberDiscountPercent?: number;
  statutoryDiscounts?: Array<{ category: 'senior' | 'pwd'; percent: number }>;
  // ── Per-player surcharge ── ₱ added per extra player beyond the included count.
  perPlayerFee?: number;
  // Players included in the base rate before the surcharge kicks in (default 1).
  perPlayerFeeThreshold?: number;
  priceNotes?: string;
  priceLastVerified?: string;
  primaryPricingModel?: string;
  pricingCurrency?: string;
  bookingSlotMinutes?: number;
  bookingAdvanceWindowDays?: number;
  pricingTaxLabel?: string;
  cancellationWindowHours?: number;
  refundPercent?: number;
  noShowFee?: number;
  acceptsWalkIns?: boolean;
  pricingBlocksLastVerifiedAt?: string;
  phone?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  viberUrl?: string;
  reclubUrl?: string;
  bookingUrl?: string;
  // Optional owner-chosen vanity slug for the auto-generated booking link
  // (…/venues/<bookingSlug>). Unset → the link uses the venue's system `slug`.
  bookingSlug?: string;
  externalBookingUrl?: string;
  externalBookingProvider?: string;
  lat?: number;
  lng?: number;
  googleRating?: number;
  googleReviewCount?: number;
  customTagline?: string;
  customHighlights?: string[];
  customCaveats?: string[];
  editorialNote?: string;
  mainImageUrl?: string;
  galleryImageUrls?: string[];
  imageCredits?: string[];
  sourceUrls?: string[];
  dataCompleteness?: string;
  dataQualityNotes?: string;
  lastVerifiedAt?: string;
  hoursTimezone?: string;
  hoursLastVerifiedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  _importId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const venueSchema = new Schema({
  slug:              { type: String, required: true, unique: true, maxlength: 100 },
  displayName:       { type: String, required: true, maxlength: 200 },
  venueId:           { type: String, maxlength: 100, index: true },
  venueType:         { type: String, maxlength: 30 },
  listingStatus:     { type: String, maxlength: 20 },
  // Soft delete: an owner "deletes" a venue, but we keep the record (hidden from
  // all listings/lookups except admins) for audit/recovery. Null = live.
  deletedAt:         { type: Date, default: null, index: true },
  deletedByUserId:   { type: Schema.Types.ObjectId, ref: 'User' },
  isVerified:        Boolean,
  alternateNames:    [String],
  ownerUserId:       { type: Schema.Types.ObjectId, ref: 'User' },
  cityId:            { type: Schema.Types.ObjectId, ref: 'City' },
  cityName:          { type: String, maxlength: 100 },
  area:              { type: String, maxlength: 100 },
  country:           { type: String, maxlength: 50 },
  region:            { type: String, maxlength: 100 },
  fullAddress:       String,
  addressLine1:      { type: String, maxlength: 200 },
  addressLine2:      { type: String, maxlength: 200 },
  postalCode:        { type: String, maxlength: 20 },
  googleMapsUrl:     String,
  directionsShort:   { type: String, maxlength: 200 },
  state:             { type: String, default: 'unclaimed' },
  oneLineSummary:    { type: String, maxlength: 255 },
  description:       String,
  bestFor:           [String],
  whatPlayersLike:   [String],
  thingsToKnow:      [String],
  indoorOutdoor:     { type: String, maxlength: 10 },
  coveredUncovered:  { type: String, maxlength: 15 },
  courtCount:        { type: Number, default: 0 },
  surfaceType:       { type: String, maxlength: 50 },
  hasDedicatedLines: String,
  hasPermanentNets:  String,
  hasOpenPlay:       Boolean,
  hasCoaching:       Boolean,
  hasCourtRental:    Boolean,
  isBeginnerFriendly: Boolean,
  allowsWalkins:     String,
  hasParking:        Boolean,
  hasToilets:        Boolean,
  hasShowers:        Boolean,
  hasFoodBeverage:   Boolean,
  hasAc:             Boolean,
  hasLighting:       Boolean,
  hasSeating:        Boolean,
  hasPaddleRental:   Boolean,
  hasProShop:        Boolean,
  amenityChips:      [String],
  customAmenities:   [String],
  amenityAirConditioning:   String,
  amenityTournamentLighting: String,
  amenityParking:           String,
  amenityShowers:           String,
  amenityLockers:           String,
  amenitySeatingArea:       String,
  amenityWaterRefill:       String,
  amenityCafeFood:          String,
  amenityPaddleRental:      String,
  amenityProShop:           String,
  amenityWifi:              String,
  amenityCoveredTerrace:    String,
  priceFrom:         Number,
  priceType:         { type: String, maxlength: 50 },
  priceFromLabel:    { type: String, maxlength: 50 },
  peakPrice:         Number,
  offPeakPrice:      Number,
  openPlayPrice:     Number,
  equipmentRentalPrice: Number,
  // Day-based pricing — flat hourly overrides applied by day type (weekend/holiday)
  // when no more-specific VenueHour time-block rate covers the chosen slot.
  weekendPrice:      Number,
  holidayPrice:      Number,
  holidayDates:      { type: [String], default: undefined },
  // Member pricing — % off the resolved hourly rate for venue members (0 = none).
  memberDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
  statutoryDiscounts: {
    type: [{
      category: { type: String, enum: ['senior', 'pwd'], required: true },
      percent: { type: Number, min: 0, max: 100, required: true },
      _id: false,
    }],
    default: [{ category: 'senior', percent: 20 }, { category: 'pwd', percent: 20 }],
  },
  // Per-player surcharge — ₱ per extra player beyond perPlayerFeeThreshold heads.
  perPlayerFee:      { type: Number, default: 0, min: 0 },
  perPlayerFeeThreshold: { type: Number, default: 1, min: 1 },
  priceNotes:        String,
  priceLastVerified: String,
  primaryPricingModel: { type: String, maxlength: 30 },
  pricingCurrency:     { type: String, default: 'PHP' },
  bookingSlotMinutes:  Number,
  bookingAdvanceWindowDays: { type: Number, default: 14 },
  // Opt-in: treat the venue's weekly VenueHour rows as the RECURRING schedule, so
  // a date with no SlotPriceOverride inherits that week's pattern instead of
  // reading as closed. Off by default on purpose — imported venues carry stale
  // VenueHour rows that were never meant to open anything, and flipping this for
  // them would silently put unvetted hours on sale. It turns on only when an owner
  // explicitly saves a weekly default from the pricing grid, so existing venues
  // keep today's exact behaviour until they opt in.
  useWeeklyPricingDefault: { type: Boolean, default: false },
  // When true, court bookings here land as `pending_approval` and the owner must
  // accept before the player pays (request-to-book). Default off = instant book.
  requireBookingApproval: { type: Boolean, default: false },
  // Hours a player has to pay after the owner approves, before the hold expires.
  bookingPayWindowHours: { type: Number, default: 24 },
  // Longest an unanswered request-to-book may hold a court before it auto-cancels.
  // A ceiling, not a fixed window: short-notice bookings resolve much faster (see
  // `bookings/bookingDeadlines.ts`), because the owner only ever gets a share of
  // the time until play.
  approvalWindowHours: { type: Number, default: 24, min: 1, max: 72 },
  // Which payment options the venue offers at checkout. Subset of
  // 'full' (pay the whole amount online), 'deposit' (pay a % now, the rest at the
  // venue), 'pay_at_venue' (reserve now, pay everything on arrival). Empty/unset →
  // full-payment only (the prior behaviour).
  paymentOptions:    { type: [String], default: undefined },
  // Deposit size as a % of the total, used when 'deposit' is offered.
  depositPercent:    { type: Number, default: 50, min: 1, max: 100 },
  // Pricing display convention — shown at checkout and on the public page so
  // players know whether the listed rate is tax-inclusive or exclusive.
  pricingTaxLabel:    { type: String, maxlength: 40, default: 'VAT inclusive' },
  // Cancellation & refund policy — owner-configurable per venue. A player who
  // cancels at least `cancellationWindowHours` before the booking start gets
  // `refundPercent`% back. `noShowFee` is a flat charge on top of forfeited
  // payment when the player doesn't show (0 = no extra fee, just lose the booking).
  cancellationWindowHours: { type: Number, default: 24 },
  refundPercent:       { type: Number, default: 100, min: 0, max: 100 },
  noShowFee:           { type: Number, default: 0, min: 0 },
  acceptsWalkIns:      Boolean,
  pricingBlocksLastVerifiedAt: String,
  phone:             { type: String, maxlength: 20 },
  phonePrimary:      { type: String, maxlength: 20 },
  phoneSecondary:    { type: String, maxlength: 20 },
  email:             { type: String, maxlength: 255 },
  website:           String,
  facebookUrl:       String,
  instagramUrl:      String,
  viberUrl:          String,
  reclubUrl:         String,
  bookingUrl:        String,
  bookingSlug:       { type: String, maxlength: 60, index: true },
  externalBookingUrl:   String,
  externalBookingProvider: { type: String, maxlength: 20 },
  lat:               Number,
  lng:               Number,
  googleRating:      Number,
  googleReviewCount: Number,
  customTagline:     { type: String, maxlength: 255 },
  customHighlights:  [String],
  customCaveats:     [String],
  editorialNote:     String,
  mainImageUrl:      String,
  galleryImageUrls:  [String],
  imageCredits:      [String],
  sourceUrls:        [String],
  dataCompleteness:  { type: String, maxlength: 20 },
  dataQualityNotes:  String,
  lastVerifiedAt:    String,
  hoursTimezone:     { type: String, default: 'Asia/Manila' },
  hoursLastVerifiedAt: String,
  metaTitle:         { type: String, maxlength: 70 },
  metaDescription:   { type: String, maxlength: 160 },
  _importId:         { type: String, index: true },
}, { timestamps: true });

venueSchema.index({ slug: 1 }, { unique: true });
venueSchema.index({ venueId: 1 });
venueSchema.index({ _importId: 1 });
venueSchema.index({ displayName: 'text', area: 'text', description: 'text' });

export const Venue = model('Venue', venueSchema);

const courtSchema = new Schema({
  venueId:          { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtNumber:      { type: String, required: true, maxlength: 10 },
  courtName:        { type: String, maxlength: 120 },
  // Short owner-written blurb for this specific court (per-court detail).
  description:      { type: String, maxlength: 1000 },
  surfaceType:      { type: String, maxlength: 50 },
  // Per-court hourly rate (PHP). When set, it overrides the venue's flat
  // priceFrom for bookings on this court; null/undefined falls back to the venue.
  hourlyRate:       Number,
  indoor:           Boolean,
  // Sport played on this court. Multi-sport venues can mix pickleball, tennis,
  // padel, etc. across their courts. Unset → pickleball (the product default).
  sport:            { type: String, maxlength: 30 },
  // Half-court / split-court: when true this court can be divided into
  // `splitCount` independently-playable sub-units (e.g. two mini-courts).
  isSplittable:     { type: Boolean, default: false },
  splitCount:       { type: Number, default: 2, min: 2, max: 4 },
  // Per-sub-unit hourly rates (PHP). Each sub-unit can have its own rate; the
  // court's `hourlyRate` (or venue fallback) is the default for any sub-unit
  // without an explicit rate here.
  subUnitRates:     [{ index: { type: Number, required: true }, hourlyRate: { type: Number, required: true } }],
  mainImageUrl:     String,
  galleryImageUrls: [String],
  isActive:         { type: Boolean, default: true },
  // Per-court override of the venue's booking-approval policy. 'inherit' (default)
  // follows the venue's requireBookingApproval; 'manual' forces request-to-book on
  // this court, 'auto' forces instant-book — whatever the venue is set to.
  approvalMode:     { type: String, enum: ['inherit', 'auto', 'manual'], default: 'inherit' },
  // Optional turnover/buffer (minutes) the court needs between bookings: the next
  // reservation can't start within this gap of a prior one's end. 0 = back-to-back.
  turnoverMinutes:  { type: Number, default: 0, min: 0, max: 180 },
  // ── Court profile ── owner-described physical attributes of this court, shown
  // on the public court page (the cover photo + gallery above already cover the
  // "Picture" part of the profile).
  hasAircon:           Boolean,                       // air-conditioned (indoor courts)
  highCeiling:         Boolean,                       // tall clearance for lobs
  spaceAroundCourt:    { type: String, maxlength: 30 }, // run-off / clearance, e.g. "3m"
  hasRefreshmentStand: Boolean,                       // food/drinks on site
  floorType:           { type: String, maxlength: 30 }, // e.g. "Wood" / "Professional"
  ballType:            { type: String, maxlength: 20 }, // ball used: "Indoor" / "Outdoor"
  _importId:        { type: String, index: true },
}, { timestamps: true });

courtSchema.index({ venueId: 1, courtNumber: 1 });
courtSchema.index({ _importId: 1 });

export const Court = model('Court', courtSchema);

const venueHourSchema = new Schema({
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  // Per-court hours: when set, this row is that court's own operating window. A
  // null courtId is the venue-wide default — the legacy/imported hours, and the
  // fallback a court inherits until the owner gives it its own schedule.
  courtId:       { type: Schema.Types.ObjectId, ref: 'Court', default: null, index: true },
  dayOfWeek:     { type: Number, required: true, min: 0, max: 6 },
  openTime:      String,
  closeTime:     String,
  // Per-time-block rate (PHP/hr). A day can hold MULTIPLE rows (time blocks), each
  // with its own price — e.g. 08:00–18:00 ₱200, 18:00–23:00 ₱300. Blank → the
  // court/venue rate applies for that window.
  price:         Number,
  isClosed:      { type: Boolean, default: false },
  notes:         String,
  effectiveFrom: String,
  effectiveTo:   String,
  _importId:     { type: String, index: true },
}, { timestamps: true });

venueHourSchema.index({ venueId: 1, dayOfWeek: 1 });
venueHourSchema.index({ courtId: 1, dayOfWeek: 1 });
venueHourSchema.index({ _importId: 1 });

export const VenueHour = model('VenueHour', venueHourSchema);

const faqSchema = new Schema({
  venueId:   { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  question:  { type: String, required: true },
  answer:    { type: String, required: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

faqSchema.index({ venueId: 1, sortOrder: 1 });

export const Faq = model('Faq', faqSchema);

const holidayClosureSchema = new Schema({
  venueId:        { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  closureDate:    { type: String, required: true },
  reason:         { type: String, maxlength: 200 },
  openTime:       String,
  closeTime:      String,
  isClosedAllDay: { type: Boolean, default: true },
}, { timestamps: true });

holidayClosureSchema.index({ venueId: 1, closureDate: 1 });

export const HolidayClosure = model('HolidayClosure', holidayClosureSchema);

const venueStaffSchema = new Schema({
  venueId:     { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  staffRole:   { type: String, maxlength: 30 },
  permissions: String,
  status:      { type: String, default: 'active' },
}, { timestamps: true });

venueStaffSchema.index({ venueId: 1, userId: 1, staffRole: 1 }, { unique: true });
// "Which venues does this user work?" — the venue-inbox lookup on every message
// list/send; not servable from the compound index above (wrong prefix).
venueStaffSchema.index({ userId: 1, status: 1 });

export const VenueStaff = model('VenueStaff', venueStaffSchema);

// ── Venue members ── players the owner designates as members of this venue, so
// member pricing (Venue.memberDiscountPercent) applies to their bookings. An
// owner adds/removes members from the venue's Membership tab. Distinct from the
// rolled-up "community" of everyone who's ever booked (that's derived, not stored).
const venueMemberSchema = new Schema({
  venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // Optional free-text tier label (e.g. "Gold", "Founding"), shown to the owner.
  tier:    { type: String, maxlength: 40 },
  status:  { type: String, default: 'active', maxlength: 20 },
  addedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  // When this membership expires (computed from the plan cadence: monthly/quarterly/annual).
  // Null = perpetual (owner-added members without a tier, or legacy rows).
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

venueMemberSchema.index({ venueId: 1, userId: 1 }, { unique: true });

export const VenueMember = model('VenueMember', venueMemberSchema);

// ── Manual surge / slot price override ── an owner raises or lowers the rate for
// a specific date + time window (optionally a single court). The booking flow
// uses this absolute hourly `price` instead of the resolved base/day/time rate
// when a booking's start falls inside the window. A null courtId = venue-wide.
const slotPriceOverrideSchema = new Schema({
  venueId:   { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtId:   { type: Schema.Types.ObjectId, ref: 'Court', default: null },
  date:      { type: String, required: true },           // YYYY-MM-DD
  startTime: { type: String, required: true },           // "HH:MM"
  endTime:   { type: String, required: true },           // "HH:MM"
  price:     { type: Number, required: true, min: 0 },   // absolute ₱/hr for the window
  note:      { type: String, maxlength: 200 },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

slotPriceOverrideSchema.index({ venueId: 1, date: 1 });

export const SlotPriceOverride = model('SlotPriceOverride', slotPriceOverrideSchema);

const amenitySchema = new Schema({
  slug:        { type: String, unique: true, maxlength: 50 },
  displayName: { type: String, required: true, maxlength: 100 },
  icon:        { type: String, maxlength: 50 },
  category:    { type: String, maxlength: 50 },
});

export const Amenity = model('Amenity', amenitySchema);

// ── Subscription Plans ── owner-defined membership tiers for a venue. A plan has
// one "current" version (the latest) that new subscribers get; editing a live plan
// creates a new version so existing subscribers stay on their original version
// until renewal (versioning — see SubscriptionPlanVersion).
const subscriptionPlanSchema = new Schema({
  venueId:     { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  name:        { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  status:      { type: String, default: 'draft', enum: ['active', 'draft', 'disabled'] },
  // The latest (newest) version — what new subscribers get.
  currentVersionId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanVersion', default: null },
}, { timestamps: true });

subscriptionPlanSchema.index({ venueId: 1, status: 1 });

export const SubscriptionPlan = model('SubscriptionPlan', subscriptionPlanSchema);

const subscriptionPlanVersionSchema = new Schema({
  planId:        { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  versionNumber: { type: Number, required: true },
  price:         { type: Number, required: true, min: 0 },
  currency:      { type: String, default: 'PHP', maxlength: 10 },
  billingCycle:  { type: String, required: true, enum: ['weekly', 'monthly', 'quarterly', 'semiAnnual', 'annual', 'custom'] },
  // When billingCycle is 'custom', the number of days between renewals.
  customBillingDays: { type: Number, min: 1, max: 365, default: null },
  // Rich-text / markdown list of benefit strings (e.g. "20% off every court booking").
  benefits:      [{ type: String, maxlength: 200 }],
  // Optional caps.
  maxMembers:    { type: Number, min: 0, default: null },
  freeTrialDays: { type: Number, min: 0, default: null },
  autoRenew:     { type: Boolean, default: true },
}, { timestamps: true });

subscriptionPlanVersionSchema.index({ planId: 1, versionNumber: -1 });

export const SubscriptionPlanVersion = model('SubscriptionPlanVersion', subscriptionPlanVersionSchema);

// ── Subscription (member ←→ plan version link) ── tracks which version a member
// subscribed to, so renewals can migrate them to the latest version.
const venueSubscriptionSchema = new Schema({
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  planVersionId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanVersion', required: true },
  planId:        { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  status:        { type: String, default: 'active', enum: ['active', 'cancelled', 'expired'] },
  startedAt:     { type: Date, default: Date.now },
  renewalDate:   { type: Date, default: null },
  // The VenueMember row this subscription is linked to (for member-pricing).
  venueMemberId: { type: Schema.Types.ObjectId, ref: 'VenueMember', default: null },
}, { timestamps: true });

venueSubscriptionSchema.index({ userId: 1, venueId: 1 }, { unique: true });
venueSubscriptionSchema.index({ planId: 1, status: 1 });

export const VenueSubscription = model('VenueSubscription', venueSubscriptionSchema);
