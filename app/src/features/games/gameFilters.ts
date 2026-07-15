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
/** Who a listing admits — mirrors the host's own "Who can play" picker. */
export type GenderFilter = 'Any' | 'all' | 'men' | 'women';
/** What it costs to JOIN — not what the court costs. See `ScoredPlayItem.joinFee`. */
export type CostFilter = 'Any' | 'free' | 'paid';
export type AccessFilter = 'Any' | 'public' | 'invite';
export type RepeatFilter = 'Any' | 'recurring' | 'one-time';

/** The applied Games filters. */
export interface GameFilters {
  when: WhenFilter;
  skill: SkillFilter;
  gameType: TypeFilter;
  /** Who the listing admits (men-only / women-only / open to all). */
  genderPolicy: GenderFilter;
  /** Only games that still have a free spot (`spotsLeft > 0`). */
  openings: boolean;
  /** Max distance in km. Null = no radius filter (or the user shared no location). */
  radiusKm: number | null;
  /** The day picked when `when === 'custom'` (YYYY-MM-DD). Null until one is chosen,
   *  in which case the `when` filter is inert rather than matching nothing. */
  customDate: string | null;
  /* ── §4.3 of the 8 July minutes: the filters the meeting asked for next ───── */
  /** Free to join vs carries a fee. */
  cost: CostFilter;
  /** Open to anyone vs invitation-only. */
  access: AccessFilter;
  /** Part of a weekly series vs a one-off. */
  repeat: RepeatFilter;
  /** Exact venue name. Null = any venue. */
  venue: string | null;
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

// One word each, plain text — the sheet's other rows read that way (Any /
// Doubles / Singles / Open Play), and the full phrases wrapped this row onto a
// second line. The heading above them carries the meaning.
export const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'all', label: 'Everyone' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
];

// "Free" means free TO JOIN. A player-hosted game is free even when its card shows
// the venue's ₱350 court rate — the host paid that, not the joiner.
export const COST_OPTIONS: { value: CostFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

export const ACCESS_OPTIONS: { value: AccessFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'public', label: 'Open' },
  { value: 'invite', label: 'Invite only' },
];

export const REPEAT_OPTIONS: { value: RepeatFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'recurring', label: 'Weekly' },
  { value: 'one-time', label: 'One-off' },
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
  genderPolicy: 'Any',
  openings: false,
  radiusKm,
  customDate: null,
  cost: 'Any',
  access: 'Any',
  repeat: 'Any',
  venue: null,
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
  if (f.genderPolicy !== 'Any') n++;
  if (f.openings) n++;
  if (f.radiusKm != null) n++;
  if (f.cost !== 'Any') n++;
  if (f.access !== 'Any') n++;
  if (f.repeat !== 'Any') n++;
  if (f.venue) n++;
  return n;
}

/** Who a listing admits. Venue-run sessions carry no policy, and a game created
 *  before the field has none either — both read as open to everyone. */
function policyOf(item: ScoredPlayItem): 'all' | 'men' | 'women' {
  if (item.kind === 'session') return 'all';
  const p = (item.source as { genderPolicy?: string | null }).genderPolicy;
  return p === 'men' || p === 'women' ? p : 'all';
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
      // The bands tile the skill axis and SHARE endpoints (…3.0–3.5, 3.5–4.0…),
      // so treat them as half-open [lo, hi): a listing that merely TOUCHES the
      // selected band at a shared boundary is a different band, not a match.
      // Closed-interval overlap (`<=`) leaked every adjacent band in — e.g. a
      // 3.5–4.0 play showed up under the 3.0–3.5 filter because both touch 3.5.
      const overlaps = lo < want[1] && want[0] < hi;
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

  if (f.genderPolicy !== 'Any' && policyOf(item) !== f.genderPolicy) return false;

  // Cost is what it takes to JOIN, and `joinFee` is the only field that knows.
  // A game's `priceLabel` is the VENUE's hourly rate — the host paid it, so filtering
  // "Free" on the label would hide games that are, in fact, free to join.
  if (f.cost === 'free' && !(item.joinFee == null || item.joinFee === 0)) return false;
  if (f.cost === 'paid' && !(item.joinFee != null && item.joinFee > 0)) return false;

  if (f.access !== 'Any' && item.visibility !== f.access) return false;

  if (f.repeat === 'recurring' && !item.isRecurring) return false;
  if (f.repeat === 'one-time' && item.isRecurring) return false;

  if (f.venue && item.venueName !== f.venue) return false;

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
