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

/** "6:30 PM" → { time: "6:30", suffix: "PM" }; passthrough when there's no AM/PM. */
export function splitTime(label: string): { time: string; suffix: string } {
  const m = label.trim().match(/^(.*?)\s*(AM|PM)$/i);
  return m ? { time: m[1].trim(), suffix: m[2].toUpperCase() } : { time: label, suffix: '' };
}

/** Stable chronological key + a section header for date-grouped browse,
 *  e.g. { key: '2026-06-05', header: 'TODAY · FRI JUN 5' }. */
export function dateSectionHeader(date: string | null | undefined): { key: string; header: string } {
  if (!date) return { key: '￿', header: 'SOON' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { key: '￿', header: 'SOON' };
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const datePart = d
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
    .toUpperCase();
  if (diff === 0) return { key: date, header: `TODAY · ${datePart}` };
  if (diff === 1) return { key: date, header: `TOMORROW · ${datePart}` };
  return { key: date, header: datePart };
}

/** "Today" / "Tomorrow" / "Fri, Jun 5" — the relative day for a My-Games card. */
export function relativeDayLabel(g: Pick<ApiGame, 'date' | 'whenLabel'>): string {
  if (!g.date) return g.whenLabel || '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return g.whenLabel || '';
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Riverside · Makati" (real venue) / the free-text name / "Venue TBD". */
export function gameLocation(g: Pick<ApiGame, 'venue' | 'venueName'>): string {
  const v = g.venue;
  if (v) return [v.displayName, v.area || v.city].filter(Boolean).join(' · ');
  if (g.venueName) return g.venueName;
  return 'Venue TBD';
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

/* ─── Lobby leave / grace-period rules ───────────────────────── */
//
// A game's roster is its "lobby". Joiners can drop out freely until the lobby
// fills up; once it's FULL their spot is only refundable (i.e. leaveable) while
// the game is still comfortably in the future. Inside the grace window a full
// lobby is locked in — the host's court is committed, so the booking is final.
// Change this one constant to retune the window everywhere it's enforced.
export const LOBBY_LEAVE_GRACE_PERIOD_DAYS = 3;

/** Whole days from today (local midnight) until the game date; null when undated. */
export function daysUntilGame(g: Pick<ApiGame, 'date'>): number | null {
  if (!g.date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** True once every spot is taken (the lobby is full). */
export function isLobbyFull(g: Pick<ApiGame, 'spotsLeft'>): boolean {
  return (g.spotsLeft ?? 0) <= 0;
}

/** The game date is inside the no-refund window — within the grace period (≤ N
 *  days away, including today/overdue). An undated game can't be locked in, so
 *  it's treated as outside the window. */
export function isWithinGracePeriod(g: Pick<ApiGame, 'date'>): boolean {
  const days = daysUntilGame(g);
  return days != null && days <= LOBBY_LEAVE_GRACE_PERIOD_DAYS;
}

/** Whether a joiner may still leave the lobby:
 *  - lobby not full → always leaveable (even within the grace period)
 *  - lobby full but the game is still more than N days away → leaveable
 *  - lobby full AND within the grace period → locked in (final, non-refundable). */
export function canLeaveLobby(g: Pick<ApiGame, 'spotsLeft' | 'date'>): boolean {
  if (!isLobbyFull(g)) return true;
  return !isWithinGracePeriod(g);
}

/* ─── Status display ─────────────────────────────────────────── */

export type GameTone = 'lime' | 'blue' | 'coral' | 'muted';

/** Human label + a tone for a game's status. */
export function statusMeta(status?: string | null): { label: string; tone: GameTone } {
  switch (status) {
    case 'published': return { label: 'Filling', tone: 'blue' };
    case 'full':      return { label: 'Full', tone: 'lime' };
    case 'cancelled': return { label: 'Cancelled', tone: 'muted' };
    default:          return { label: 'Open', tone: 'blue' };
  }
}
