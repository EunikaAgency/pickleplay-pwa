// Ordering + display helpers for the Play tab's Discover feed.
//
// SCORING NO LONGER LIVES HERE. It moved to the server (api/src/features/play/
// playRanking.ts) so that every device receives the same ordering and the weights
// can be retuned without shipping an app release — two things a device-side scorer
// could not give us. `getPlayDiscover()` returns items already scored and ranked.
//
// What stays here is the part that is genuinely the client's job: re-ordering the
// feed the server already sent when the user flips the Sort control. Those four
// alternatives (soonest / nearest / spots left / newest) are pure reorderings of a
// set we already hold, so doing them locally keeps the control instant instead of
// costing a network round-trip per tap. 'Relevance' just reads the server's score.

import type { ScoredPlayItem, PlayItem } from '../../shared/lib/api';

// The feed's shapes are wire types now — the server produces them. Re-exported so
// the cards and filters keep importing them from here.
export type { PlayKind, PlayFill, PlayItem, ScoredPlayItem } from '../../shared/lib/api';

/* ─── Sorting ─────────────────────────────────────────────────────────────── */

export type SortKey = 'best' | 'soonest' | 'nearest' | 'fill' | 'newest';

/** Attribute nouns, not superlatives. These render after a "Sort:" prefix
 *  ("Sort: Distance"), and a superlative would promise an absolute the feed
 *  can't always honour. */
export const SORT_LABELS: Record<SortKey, string> = {
  best: 'Relevance',
  soonest: 'Start time',
  nearest: 'Distance',
  fill: 'Spots left',
  newest: 'Recently added',
};

/** Local Date for a listing's start. A listing with a date but no start time is
 *  treated as ending the day (23:59) so it sorts *after* every timed listing on
 *  that date — "nulls last", expressed as data rather than as a sort special-case. */
export function startAt(item: Pick<PlayItem, 'date' | 'startTime'>): Date | null {
  if (!item.date) return null;
  const d = new Date(`${item.date}T${item.startTime || '23:59'}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Seats still open. Full lobbies and interest-based listings (which have no
 *  capacity at all) have no meaningful answer, so they sort last. */
export function spotsLeft(item: PlayItem): number {
  if (item.fill.mode !== 'capacity' || item.fill.cap <= 0) return Infinity;
  const left = item.fill.cap - item.fill.joined;
  return left > 0 ? left : Infinity;
}

/** Re-sort the ranked feed. Every comparator falls through to `id` so the order is
 *  total and stable — otherwise the feed appears to reshuffle between renders. */
export function sortScored(items: ScoredPlayItem[], key: SortKey): ScoredPlayItem[] {
  const byId = (a: ScoredPlayItem, b: ScoredPlayItem) => a.id.localeCompare(b.id);
  // Unknown values sort last regardless of direction.
  const last = <T,>(v: T | null, missing: T) => (v == null ? missing : v);

  const cmp: Record<SortKey, (a: ScoredPlayItem, b: ScoredPlayItem) => number> = {
    // The server's relevance score — this client no longer computes one.
    best: (a, b) => b.score - a.score || byId(a, b),
    soonest: (a, b) => {
      const at = last(startAt(a)?.getTime() ?? null, Infinity);
      const bt = last(startAt(b)?.getTime() ?? null, Infinity);
      return at - bt || byId(a, b);
    },
    nearest: (a, b) => last(a.distanceKm, Infinity) - last(b.distanceKm, Infinity) || byId(a, b),
    // Ascending: 1 spot left ranks above 5. Matches the "Spots left" label — unlike
    // the old fillPressure ordering, which ranked a *full* lobby near the bottom.
    fill: (a, b) => spotsLeft(a) - spotsLeft(b) || byId(a, b),
    newest: (a, b) => last(b.createdAt, '').localeCompare(last(a.createdAt, '')) || byId(a, b),
  };
  return [...items].sort(cmp[key]);
}
