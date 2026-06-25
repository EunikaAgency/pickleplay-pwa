import { useCallback, useEffect, useMemo, useState } from 'react';
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
  /**
   * Earliest still-bookable hour on the selected date: 0 for a future date, or
   * the next whole hour from now when the date is today (so a slot that has
   * already started can't be picked). 24 means today is over — pick another day.
   */
  minBookableHour: number;
  /** True for a start hour with no free court, or one that's already in the past today. */
  startDisabled: (hour: number) => boolean;
  /** True for a start hour that's already begun today (the reason it's unpickable). */
  isPast: (hour: number) => boolean;
  /** True for a start hour with no free court (booked out) — distinct from `isPast`. */
  isFull: (hour: number) => boolean;
  /** Given a chosen start, returns a predicate that's true for an end hour whose window hits a full (or past) hour. */
  endDisabledFor: (start: string) => (endHour: number) => boolean;
  /** Whether the chosen [start,end) window overlaps any full hour. */
  rangeBlocked: (start: string, end: string) => boolean;
  /**
   * First hour (0–23) that's still free AND not in the past, searching from `from`
   * onward then wrapping (never before `minBookableHour`). Returns null when every
   * remaining hour is full / availability hasn't loaded. Bumps a start time off an
   * already-booked or elapsed hour.
   */
  firstFreeHour: (from: number) => number | null;
}

/** Local YYYY-MM-DD for "today" (matches how dates are stored/compared). */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useVenueAvailability(venueId: string | undefined, date: string, courtId?: string): VenueAvailabilityState {
  // Tag the loaded data with the venue/date/court it's for, so a result from a
  // previous selection is ignored the instant the inputs change (no stale greying
  // while the next fetch is in flight) — and no synchronous reset in the effect.
  const [loaded, setLoaded] = useState<{ key: string; data: VenueAvailability } | null>(null);

  useEffect(() => {
    if (!venueId || !date) return;
    const key = `${venueId}|${date}|${courtId ?? ''}`;
    let alive = true;
    getVenueAvailability(venueId, date, courtId)
      .then((a) => { if (alive) setLoaded({ key, data: a }); })
      .catch(() => { if (alive) setLoaded(null); });
    return () => { alive = false; };
  }, [venueId, date, courtId]);

  const currentKey = venueId && date ? `${venueId}|${date}|${courtId ?? ''}` : '';
  const availability = loaded && loaded.key === currentKey ? loaded.data : null;

  // On today, you can't book an hour that has already begun: the floor is the
  // next whole hour from now (or now's hour exactly on the hour). Future dates
  // have no floor (0). `new Date()` here recomputes per render, which is fine —
  // it only shifts at hour boundaries.
  const now = new Date();
  const isToday = !!date && date === localToday();
  const minBookableHour = isToday ? now.getHours() + (now.getMinutes() > 0 ? 1 : 0) : 0;
  const isPastHour = (h: number) => h < minBookableHour;

  const freeByHour = useMemo(() => {
    const m = new Map<number, number>();
    availability?.hours.forEach((h) => m.set(h.hour, h.free));
    return m;
  }, [availability]);

  const isFull = (h: number) => (freeByHour.get(h) ?? 0) <= 0;

  const firstFreeHour = useCallback((from: number): number | null => {
    if (!availability) return null;
    const free = (h: number) => (freeByHour.get(h) ?? 0) > 0 && h >= minBookableHour;
    const start = Math.max(from, minBookableHour);
    for (let h = start; h < 24; h++) if (free(h)) return h;
    for (let h = minBookableHour; h < start; h++) if (free(h)) return h; // wrap, but never into the past
    return null;
  }, [availability, freeByHour, minBookableHour]);

  return {
    availability,
    minBookableHour,
    isPast: isPastHour,
    // Only meaningful once availability has loaded; before that, nothing is "full".
    isFull: (h) => availability != null && isFull(h),
    startDisabled: (h) => isPastHour(h) || (availability != null && isFull(h)),
    endDisabledFor: (start) => (endHour) =>
      (isToday && endHour <= minBookableHour) ||
      (availability != null && hoursTouched(start, `${String(endHour).padStart(2, '0')}:00`).some(isFull)),
    rangeBlocked: (start, end) =>
      (isToday && Number(start.split(':')[0]) < minBookableHour) ||
      (availability != null && hoursTouched(start, end).some(isFull)),
    firstFreeHour,
  };
}
