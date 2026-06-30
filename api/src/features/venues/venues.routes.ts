import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import {
  listVenues, getVenue, createVenue, getVenueReviews, getVenueOpenPlay, getVenueCoaches,
  updateVenue, checkBookingSlug, deleteVenue, getVenueCourts, createCourt, updateCourt, deleteCourt,
  getVenueHours, putVenueHours, getCourtHours, putCourtHours, getVenueHolidayClosures, createHolidayClosure, deleteHolidayClosure,
  getVenueStaff, createStaff, deleteStaff,
  getVenueMembers, addVenueMember, removeVenueMember, joinVenueMembership, leaveVenueMembership, respondMembershipInvite,
  getSlotOverrides, createSlotOverride, deleteSlotOverride,
  getVenueFaqs, createFaq, updateFaq, deleteFaq,
  getVenueBookings, createVenueBooking, updateBookingStatus, getVenueAnalytics, getVenueAvailability, getVenueAvailabilityRange,
  createRecurringBooking, getRecurringBookings, cancelRecurringBooking,
  listSubscriptionPlans, createSubscriptionPlan, getSubscriptionPlan, updateSubscriptionPlan,
  deleteSubscriptionPlan, duplicateSubscriptionPlan, toggleSubscriptionPlan,
  listPublicPlans, subscribeToPlan,
} from './venues.controller.js';

const venuesRoutes = new Hono();

/* ─── List / Get ──────────────────────────────────────────────────── */

// optionalAuth so the `managedByUserId` ("venues I manage") filter can identify
// the caller; tokenless public discovery is unchanged.
venuesRoutes.get('/', optionalAuth, listVenues);
venuesRoutes.post('/', requireAuth, createVenue);
venuesRoutes.get('/:id', optionalAuth, getVenue);
venuesRoutes.get('/:id/reviews', getVenueReviews);
venuesRoutes.get('/:id/open-play', getVenueOpenPlay);
venuesRoutes.get('/:id/coaches', getVenueCoaches);

/* ─── Venue Management ────────────────────────────────────────────── */

venuesRoutes.patch('/:id', requireAuth, updateVenue);
venuesRoutes.get('/:id/booking-slug-available', requireAuth, checkBookingSlug);
venuesRoutes.delete('/:id', requireAuth, deleteVenue);

/* ─── Courts ──────────────────────────────────────────────────────── */

venuesRoutes.get('/:id/courts', getVenueCourts);
venuesRoutes.post('/:id/courts', requireAuth, createCourt);
venuesRoutes.patch('/courts/:id', requireAuth, updateCourt);
venuesRoutes.delete('/courts/:id', requireAuth, deleteCourt);
// Per-court operating hours (+ hours pricing). Inherit the venue default until set.
venuesRoutes.get('/courts/:id/hours', getCourtHours);
venuesRoutes.put('/courts/:id/hours', requireAuth, putCourtHours);

/* ─── Hours (venue-wide default) ──────────────────────────────────── */

venuesRoutes.get('/:id/hours', getVenueHours);
venuesRoutes.put('/:id/hours', requireAuth, putVenueHours);

/* ─── Holiday Closures ────────────────────────────────────────────── */

venuesRoutes.get('/:id/holiday-closures', getVenueHolidayClosures);
venuesRoutes.post('/:id/holiday-closures', requireAuth, createHolidayClosure);
venuesRoutes.delete('/holiday-closures/:id', requireAuth, deleteHolidayClosure);

/* ─── Staff ───────────────────────────────────────────────────────── */

// Staff list is gated to the owner/staff (identity-bearing) — needs auth.
venuesRoutes.get('/:id/staff', requireAuth, getVenueStaff);
venuesRoutes.post('/:id/staff', requireAuth, createStaff);
venuesRoutes.delete('/staff/:id', requireAuth, deleteStaff);

/* ─── Members (member pricing) ────────────────────────────────────── */

venuesRoutes.get('/:id/members', requireAuth, getVenueMembers);
venuesRoutes.post('/:id/members', requireAuth, addVenueMember);
venuesRoutes.delete('/:id/members/:userId', requireAuth, removeVenueMember);

// Self-service membership — a player joins/cancels their OWN membership at a venue
// (distinct from the owner-managed /members routes above).
venuesRoutes.post('/:id/membership', requireAuth, joinVenueMembership);
venuesRoutes.delete('/:id/membership', requireAuth, leaveVenueMembership);
// The invited player accepts/declines an owner-sent membership invite.
venuesRoutes.post('/:id/membership/respond', requireAuth, respondMembershipInvite);

/* ─── Subscription Plans ─────────────────────────────────────────── */

// Owner/staff CRUD for the venue's subscription plans.
venuesRoutes.get('/:id/subscription-plans', requireAuth, listSubscriptionPlans);
venuesRoutes.post('/:id/subscription-plans', requireAuth, createSubscriptionPlan);
// Standalone plan operations (not scoped under a venue — the plan id is enough).
venuesRoutes.get('/subscription-plans/:planId', requireAuth, getSubscriptionPlan);
venuesRoutes.patch('/subscription-plans/:planId', requireAuth, updateSubscriptionPlan);
venuesRoutes.delete('/subscription-plans/:planId', requireAuth, deleteSubscriptionPlan);
venuesRoutes.post('/subscription-plans/:planId/duplicate', requireAuth, duplicateSubscriptionPlan);
venuesRoutes.patch('/subscription-plans/:planId/toggle', requireAuth, toggleSubscriptionPlan);
// Public: active plans for a venue (player browse).
venuesRoutes.get('/:id/plans', listPublicPlans);
// Self-service: a signed-in player subscribes to a plan.
venuesRoutes.post('/subscription-plans/:planId/subscribe', requireAuth, subscribeToPlan);

/* ─── Slot price overrides (manual surge) ─────────────────────────── */

// Public read (optionalAuth so owners/staff also see past dates) for the booking flow.
venuesRoutes.get('/:id/slot-overrides', optionalAuth, getSlotOverrides);
venuesRoutes.post('/:id/slot-overrides', requireAuth, createSlotOverride);
venuesRoutes.delete('/slot-overrides/:id', requireAuth, deleteSlotOverride);

/* ─── FAQs ────────────────────────────────────────────────────────── */

venuesRoutes.get('/:id/faqs', getVenueFaqs);
venuesRoutes.post('/:id/faqs', requireAuth, createFaq);
venuesRoutes.patch('/faqs/:id', requireAuth, updateFaq);
venuesRoutes.delete('/faqs/:id', requireAuth, deleteFaq);

/* ─── Bookings ────────────────────────────────────────────────────── */

venuesRoutes.get('/:id/availability/range', getVenueAvailabilityRange);
venuesRoutes.get('/:id/availability', getVenueAvailability);
venuesRoutes.get('/:id/bookings', requireAuth, getVenueBookings);
// Owner/staff create a manual (off-platform) booking or block a slot.
venuesRoutes.post('/:id/bookings', requireAuth, createVenueBooking);
venuesRoutes.patch('/:id/bookings/:bookingId', requireAuth, updateBookingStatus);
// Recurring bookings (weekly regulars / leagues) — owner/staff.
venuesRoutes.get('/:id/recurring-bookings', requireAuth, getRecurringBookings);
venuesRoutes.post('/:id/recurring-bookings', requireAuth, createRecurringBooking);
venuesRoutes.delete('/recurring-bookings/:recurringId', requireAuth, cancelRecurringBooking);

/* ─── Analytics ───────────────────────────────────────────────────── */

venuesRoutes.get('/:id/analytics', requireAuth, getVenueAnalytics);

export default venuesRoutes;
