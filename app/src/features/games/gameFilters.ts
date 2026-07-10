// Games filter model + predicate, shared by GamesScreen (which owns the state
// and applies it) and GameFilterSheet (which edits it). Mirrors venueFilters.ts.
//
// The Play tab (v2) applies `matchesPlayFilters` to the unified PlayItem instead,
// so one predicate covers both games and Open Play sessions. `matchesGameFilters`
// remains for the legacy v1 screen.

import type { ApiGame } from '../../shared/lib/api';
import type { ScoredPlayItem } from './playRanking';

export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'weekend' | 'custom';
export type SkillFilter = 'Any' | 'Beginner' | '2.5–3.0' | '3.0–3.5' | '3.5–4.0' | '4.0+';
export type TypeFilter = 'Any' | 'doubles' | 'singles' | 'open';

/** The applied Games filters. */
export interface GameFilters {
  when: WhenFilter;
  skill: SkillFilter;
  gameType: TypeFilter;
  /** Only games that still have a free spot (`spotsLeft > 0`). */
  openings: boolean;
  /** Max distance in km. Null = no radius filter (or the user shared no location). */
  radiusKm: number | null;
  /** The day picked when `when === 'custom'` (YYYY-MM-DD). Null until one is chosen,
   *  in which case the `when` filter is inert rather than matching nothing. */
  customDate: string | null;
}

export const WHEN_OPTIONS: { value: WhenFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'custom', label: 'Pick a date' },
];

export const SKILL_OPTIONS: SkillFilter[] = ['Any', 'Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+'];

export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'singles', label: 'Singles' },
  { value: 'open', label: 'Open Play' },
];

export const RADIUS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any distance' },
  { value: 2, label: 'Within 2 km' },
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 25, label: 'Within 25 km' },
];

/** A fresh, unfiltered filter set. `radiusKm` seeds from the user's saved
 *  `preferences.searchRadiusKm` where the caller has one. */
export const makeDefaultGameFilters = (radiusKm: number | null = null): GameFilters => ({
  when: 'any',
  skill: 'Any',
  gameType: 'Any',
  openings: false,
  radiusKm,
  customDate: null,
});

/** How many filters are currently narrowing the list (for the badge / chips).
 *  Radius IS counted here, unlike venueFilters.ts. On the Courts tab a radius is
 *  always in force, so badging it would be noise. Here it is opt-in, and a
 *  distance filter can silently empty the feed — so it has to be visible. */
export function countActiveGameFilters(f: GameFilters): number {
  let n = 0;
  // 'custom' without a chosen date narrows nothing, so it doesn't earn a badge.
  if (f.when !== 'any' && !(f.when === 'custom' && !f.customDate)) n++;
  if (f.skill !== 'Any') n++;
  if (f.gameType !== 'Any') n++;
  if (f.openings) n++;
  if (f.radiusKm != null) n++;
  return n;
}

/** The numeric band a SkillFilter option covers. Null for 'Any'. */
function skillFilterBand(f: SkillFilter): [number, number] | null {
  switch (f) {
    case 'Any': return null;
    case 'Beginner': return [0, 2.5];
    case '2.5–3.0': return [2.5, 3.0];
    case '3.0–3.5': return [3.0, 3.5];
    case '3.5–4.0': return [3.5, 4.0];
    case '4.0+': return [4.0, Infinity];
  }
}

/** Which day bucket a YYYY-MM-DD falls in, relative to `now`. */
function matchesWhen(date: string | null, when: WhenFilter, customDate: string | null, now: Date): boolean {
  if (when === 'any') return true;
  // "Pick a date" with no date chosen yet is inert. Matching nothing would empty
  // the feed the instant the chip is tapped, before the calendar is even used.
  if (when === 'custom' && !customDate) return true;
  if (!date) return false;
  if (when === 'custom') return date === customDate;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (when === 'today') return diff === 0;
  if (when === 'tomorrow') return diff === 1;
  return d.getDay() === 0 || d.getDay() === 6; // weekend
}

/** Whether a unified Play item passes the active filters. Used by the v2 Play tab
 *  for both games and Open Play sessions. */
export function matchesPlayFilters(item: ScoredPlayItem, f: GameFilters, now: Date = new Date()): boolean {
  if (!matchesWhen(item.date, f.when, f.customDate, now)) return false;

  if (f.skill !== 'Any') {
    const want = skillFilterBand(f.skill)!;
    // A listing with no declared band is open to all levels — never filter it out.
    if (item.skillBand) {
      const [lo, hi] = item.skillBand;
      const overlaps = lo <= want[1] && want[0] <= hi;
      if (!overlaps) return false;
    }
  }

  if (f.gameType !== 'Any') {
    // Sessions are venue-run open play; they answer to the 'open' type.
    const type = item.kind === 'session'
      ? 'open'
      : ((item.source as { gameType?: string | null }).gameType || 'open').toLowerCase();
    if (type !== f.gameType) return false;
  }

  // Interest-based listings have no capacity, so they always have room.
  if (f.openings && item.fill.mode === 'capacity' && item.fill.cap > 0 && item.fill.joined >= item.fill.cap) {
    return false;
  }

  // A listing with no coordinates can't be excluded by distance — we don't know
  // where it is, and hiding it would silently shrink the feed.
  if (f.radiusKm != null && item.distanceKm != null && item.distanceKm > f.radiusKm) return false;

  return true;
}

/** Normalise a skill label for loose comparison ("3.0–3.5" ≈ "3.0-3.5"). */
function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
}

/** Whether a game passes the active filters. */
export function matchesGameFilters(g: ApiGame, f: GameFilters, now: Date = new Date()): boolean {
  if (f.when !== 'any') {
    if (!g.date) return false;
    const d = new Date(`${g.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (f.when === 'today' && diff !== 0) return false;
    if (f.when === 'tomorrow' && diff !== 1) return false;
    if (f.when === 'weekend' && d.getDay() !== 0 && d.getDay() !== 6) return false;
  }

  if (f.skill !== 'Any') {
    const want = normalizeSkill(f.skill);
    const have = normalizeSkill(g.skillLabel || '');
    if (!have || !(have === want || have.includes(want) || want.includes(have))) return false;
  }

  if (f.gameType !== 'Any' && (g.gameType || '').toLowerCase() !== f.gameType) return false;

  if (f.openings && (g.spotsLeft ?? 0) <= 0) return false;

  return true;
}
