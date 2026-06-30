import { useCallback } from 'react';
import { recordDemandEvent } from '../lib/api';

/**
 * Centralised demand-signal capture for the client side.
 *
 * Nine event types feed the per-venue demand report + leakage funnel + pricing
 * suggestions. Three types (`empty_slot`, `booking_cancelled`, and the direct-
 * booking path of `booking_completed`) are captured **authoritatively server-
 * side** inside `bookings.controller.ts` — the frontend must not duplicate them.
 *
 * This hook exposes the **six client-side signals** as stable, named functions
 * so call sites are readable, typed, and easy to audit. Every call is fire-and-
 * forget (errors are silently swallowed) — demand capture never blocks the user.
 *
 * Usage:
 *   const { trackVenueView } = useDemandTracking();
 *   trackVenueView(venueId);
 */
export function useDemandTracking() {
  const trackSearch = useCallback((query: string) => {
    recordDemandEvent({ type: 'search', query });
  }, []);

  const trackVenueView = useCallback((venueId: string) => {
    recordDemandEvent({ type: 'venue_view', venueId });
  }, []);

  const trackBookingAttempt = useCallback(
    (venueId: string, courtId: string | undefined, date: string, startHour: string) => {
      recordDemandEvent({ type: 'booking_attempt', venueId, courtId, date, startHour });
    },
    [],
  );

  const trackBookingCompleted = useCallback(
    (venueId: string, courtId?: string, date?: string, startHour?: string) => {
      recordDemandEvent({ type: 'booking_completed', venueId, courtId, date, startHour });
    },
    [],
  );

  const trackCheckoutStarted = useCallback(
    (venueId: string, courtId: string | undefined, date: string, startHour: string) => {
      recordDemandEvent({ type: 'checkout_started', venueId, courtId, date, startHour });
    },
    [],
  );

  const trackCheckoutAbandoned = useCallback(
    (venueId: string, courtId: string | undefined, date: string, startHour: string) => {
      recordDemandEvent({ type: 'checkout_abandoned', venueId, courtId, date, startHour });
    },
    [],
  );

  const trackBookingLinkShared = useCallback((venueId: string) => {
    recordDemandEvent({ type: 'booking_link_shared', venueId });
  }, []);

  return {
    trackSearch,
    trackVenueView,
    trackBookingAttempt,
    trackBookingCompleted,
    trackCheckoutStarted,
    trackCheckoutAbandoned,
    trackBookingLinkShared,
  };
}
