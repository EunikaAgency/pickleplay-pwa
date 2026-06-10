import { useEffect, useMemo, useState } from 'react';
import { getVenueAvailability, type VenueAvailability } from '../lib/api';

// Live per-hour court availability for a venue/date, with the predicates the
// booking time-pickers use to grey out hours that have no free court. Shared by
// the court-booking flow and the create-a-game flow (both reserve a court).
//
// Degrades to "everything allowed" while loading or if the request fails — the
// server-side booking guard still rejects a genuine clash, so the pre-check is a
// UX nicety, never the enforcement.

/** Clock-hours a [start,end) window touches: "09:00"–"11:00" → [9,10]. Self-contained. */
function hoursTouched(start: string, end: string): number[] {
  if (!start || !end) return [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (!(e > s)) return [];
  const out: number[] = [];
  for (let h = Math.floor(s / 60); h < Math.ceil(e / 60) && h < 24; h++) out.push(h);
  return out;
}

export interface VenueAvailabilityState {
  availability: VenueAvailability | null;
  /** True for a start hour that has no free court. */
  startDisabled: (hour: number) => boolean;
  /** Given a chosen start, returns a predicate that's true for an end hour whose window hits a full hour. */
  endDisabledFor: (start: string) => (endHour: number) => boolean;
  /** Whether the chosen [start,end) window overlaps any full hour. */
  rangeBlocked: (start: string, end: string) => boolean;
}

export function useVenueAvailability(venueId: string | undefined, date: string): VenueAvailabilityState {
  // Tag the loaded data with the venue/date it's for, so a result from a
  // previous selection is ignored the instant the inputs change (no stale greying
  // while the next fetch is in flight) — and no synchronous reset in the effect.
  const [loaded, setLoaded] = useState<{ key: string; data: VenueAvailability } | null>(null);

  useEffect(() => {
    if (!venueId || !date) return;
    const key = `${venueId}|${date}`;
    let alive = true;
    getVenueAvailability(venueId, date)
      .then((a) => { if (alive) setLoaded({ key, data: a }); })
      .catch(() => { if (alive) setLoaded(null); });
    return () => { alive = false; };
  }, [venueId, date]);

  const currentKey = venueId && date ? `${venueId}|${date}` : '';
  const availability = loaded && loaded.key === currentKey ? loaded.data : null;

  const freeByHour = useMemo(() => {
    const m = new Map<number, number>();
    availability?.hours.forEach((h) => m.set(h.hour, h.free));
    return m;
  }, [availability]);

  const isFull = (h: number) => (freeByHour.get(h) ?? 0) <= 0;

  return {
    availability,
    startDisabled: (h) => availability != null && isFull(h),
    endDisabledFor: (start) => (endHour) =>
      availability != null && hoursTouched(start, `${String(endHour).padStart(2, '0')}:00`).some(isFull),
    rangeBlocked: (start, end) => availability != null && hoursTouched(start, end).some(isFull),
  };
}
