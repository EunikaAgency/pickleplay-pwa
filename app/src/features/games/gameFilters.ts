// Games filter model + predicate, shared by GamesScreen (which owns the state
// and applies it) and GameFilterSheet (which edits it). Mirrors venueFilters.ts.
// Only filters backed by real ApiGame data are offered — games carry no distance,
// so there is no radius filter here (unlike the Courts/Nearby tab).

import type { ApiGame } from '../../shared/lib/api';

export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'weekend';
export type SkillFilter = 'Any' | 'Beginner' | '2.5–3.0' | '3.0–3.5' | '3.5–4.0' | '4.0+';
export type TypeFilter = 'Any' | 'doubles' | 'singles' | 'open';

/** The applied Games filters. */
export interface GameFilters {
  when: WhenFilter;
  skill: SkillFilter;
  gameType: TypeFilter;
  /** Only games that still have a free spot (`spotsLeft > 0`). */
  openings: boolean;
}

export const WHEN_OPTIONS: { value: WhenFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
];

export const SKILL_OPTIONS: SkillFilter[] = ['Any', 'Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+'];

export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'Any', label: 'Any' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'singles', label: 'Singles' },
  { value: 'open', label: 'Open Play' },
];

/** A fresh, unfiltered filter set. */
export const makeDefaultGameFilters = (): GameFilters => ({
  when: 'any',
  skill: 'Any',
  gameType: 'Any',
  openings: false,
});

/** How many filters are currently narrowing the list (for the badge / chips). */
export function countActiveGameFilters(f: GameFilters): number {
  let n = 0;
  if (f.when !== 'any') n++;
  if (f.skill !== 'Any') n++;
  if (f.gameType !== 'Any') n++;
  if (f.openings) n++;
  return n;
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
