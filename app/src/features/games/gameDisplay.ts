// Display formatters for the games screens, mirroring venueDisplay.ts. The API
// game data is real but loose (date is best-effort, venue may be a free-text
// fallback), so everything here degrades gracefully.

import type { ApiGame } from '../../shared/lib/api';

const THUMBS = ['lime', 'blue', 'coral'] as const;
export type GameThumb = (typeof THUMBS)[number];

/** Stable thumb color from the game id, so a row's color doesn't flicker on refetch. */
export function gameThumb(g: Pick<ApiGame, 'id'>): GameThumb {
  let h = 0;
  for (const ch of g.id) h = (h * 31 + ch.charCodeAt(0)) % THUMBS.length;
  return THUMBS[h];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** "TODAY"/"TOM"/weekday + day-of-month from `date`; falls back to the when label. */
export function dayParts(g: Pick<ApiGame, 'date' | 'whenLabel'>): { day: string; num: string } {
  if (!g.date) return { day: (g.whenLabel || 'SOON').toUpperCase().slice(0, 4), num: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: (g.whenLabel || 'SOON').toUpperCase().slice(0, 4), num: '' };
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const day = diff === 0 ? 'TODAY' : diff === 1 ? 'TOM' : WEEKDAYS[d.getDay()];
  return { day, num: String(d.getDate()) };
}

/** "6:30 PM" / "Tonight" / "". */
export function timeLine(g: Pick<ApiGame, 'timeLabel' | 'whenLabel'>): string {
  return g.timeLabel || g.whenLabel || '';
}

/** "Riverside · Makati" (real venue) / the free-text name / "Location TBD". */
export function gameLocation(g: Pick<ApiGame, 'venue' | 'venueName'>): string {
  if (g.venue) return [g.venue.displayName, g.venue.area || g.venue.city].filter(Boolean).join(' · ');
  return g.venueName || 'Location TBD';
}

/** The game's own title, else a derived "Doubles · 3.0–3.5"-style label. */
export function gameTitle(g: Pick<ApiGame, 'title' | 'gameType' | 'skillLabel'>): string {
  if (g.title) return g.title;
  const type = g.gameType ? g.gameType.charAt(0).toUpperCase() + g.gameType.slice(1) : 'Open';
  return g.skillLabel ? `${type} · ${g.skillLabel}` : `${type} game`;
}

/** "Doubles" / "Open" — capitalized game type, or a sensible default. */
export function gameTypeLabel(g: Pick<ApiGame, 'gameType'>): string {
  if (!g.gameType) return 'Open';
  return g.gameType.charAt(0).toUpperCase() + g.gameType.slice(1);
}

/** "3 left" / "Full". */
export function spotsLabel(g: Pick<ApiGame, 'spotsLeft'>): string {
  const n = g.spotsLeft ?? 0;
  return n > 0 ? `${n} left` : 'Full';
}
