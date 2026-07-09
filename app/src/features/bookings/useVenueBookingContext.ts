import { useEffect, useState } from 'react';
import {
  getVenue, getHours, listSlotOverrides,
  type ApiVenueDetail, type ApiCourt, type OwnerHourEntry, type SlotPriceOverride,
} from '../../shared/lib/api';

// One keyed hook for all the per-venue (and per-date override) data the court
// booking wizard needs, replacing four separate effects + their render-phase
// reset pairs. Stale results are ignored the instant the venue/date changes
// (mirrors useVenueAvailability's key guard), so no synchronous reset is needed.
//
// getVenue's public projection already returns full `courts` AND `viewerIsMember`
// (see api/src/features/venues/venues.controller.ts getVenue), so this collapses
// the old `listCourts` + `getVenue`-just-for-membership into a single request.
// `getHours` (structured pricing blocks) and `listSlotOverrides` are still needed
// separately — the venue-detail `hours` is only a display dict, not pricing.

export interface VenueBookingContext {
  /** Full venue detail (superset of the list ApiVenue) — null until loaded. */
  detail: ApiVenueDetail | null;
  /** Courts at the venue (from the venue-detail projection). */
  courts: ApiCourt[];
  /** Structured weekly hours + pricing blocks (operating-window math + rate engine). */
  venueHours: OwnerHourEntry[];
  /** Manual surge / slot price overrides for the selected date. */
  overrides: SlotPriceOverride[];
  /** Whether the signed-in player is a member of this venue (member pricing). */
  viewerIsMember: boolean;
  /** True while this venue's courts/hours/membership are still loading. */
  loading: boolean;
}

export function useVenueBookingContext(venueId: string | undefined, date: string): VenueBookingContext {
  // Venue-scoped: detail (courts + membership) + structured hours, tagged with the
  // venue id so a previous venue's result is ignored while the next is in flight.
  const [venueData, setVenueData] = useState<{ id: string; detail: ApiVenueDetail; hours: OwnerHourEntry[] } | null>(null);
  // Date-scoped: slot overrides for the chosen date.
  const [overrideData, setOverrideData] = useState<{ key: string; rows: SlotPriceOverride[] } | null>(null);

  useEffect(() => {
    if (!venueId) return;
    let alive = true;
    Promise.all([
      getVenue(venueId),
      getHours(venueId).catch(() => [] as OwnerHourEntry[]),
    ])
      .then(([detail, hours]) => { if (alive) setVenueData({ id: venueId, detail, hours }); })
      .catch(() => { if (alive) setVenueData(null); });
    return () => { alive = false; };
  }, [venueId]);

  useEffect(() => {
    if (!venueId || !date) return;
    const key = `${venueId}|${date}`;
    let alive = true;
    listSlotOverrides(venueId, date)
      .then((rows) => { if (alive) setOverrideData({ key, rows }); })
      .catch(() => { if (alive) setOverrideData({ key, rows: [] }); });
    return () => { alive = false; };
  }, [venueId, date]);

  const fresh = venueData && venueData.id === venueId ? venueData : null;
  const overrideKey = venueId && date ? `${venueId}|${date}` : '';
  const overrides = overrideData && overrideData.key === overrideKey ? overrideData.rows : [];

  return {
    detail: fresh?.detail ?? null,
    courts: fresh?.detail.courts ?? [],
    venueHours: fresh?.hours ?? [],
    overrides,
    viewerIsMember: !!fresh?.detail.viewerIsMember,
    loading: !!venueId && fresh == null,
  };
}
