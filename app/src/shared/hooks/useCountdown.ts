import { useEffect, useState } from 'react';

// Re-render cadence for countdown labels. Labels are minute-resolution
// ("18 min left", "2h 15m left"), so a per-second tick would re-render a whole
// list of bookings 60× more often than the text can actually change.
const TICK_MS = 30_000;

/** A clock that advances while a deadline is pending, so `Date.now()`-derived
 *  labels stay live without the caller wiring its own interval.
 *
 *  Returns the current time in ms. Pass the deadline so the interval can stop
 *  itself once it's passed — an expired booking's label never changes again, and
 *  a list of them shouldn't keep waking the tab up.
 *
 *  Same interval + cleanup shape as `useNotificationPolling`; there is no date
 *  library in this app, so callers pair this with `countdownLabel`. */
export function useCountdown(deadline?: string | Date | null): number {
  const [now, setNow] = useState(() => Date.now());

  const target = deadline
    ? (deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime())
    : NaN;

  useEffect(() => {
    // Nothing to count down to, or it already passed — the label is static from
    // here on, so never start a timer. (Not a setState: writing state straight
    // from an effect body triggers a cascading render, and the value we'd write
    // is one the initializer already gives us.)
    if (Number.isNaN(target) || target <= Date.now()) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
      // Stop once the deadline passes. The effect itself only re-runs when
      // `target` changes, so without this the timer would keep waking the tab
      // forever on a request that has already expired.
      if (Date.now() >= target) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [target]);

  return now;
}
