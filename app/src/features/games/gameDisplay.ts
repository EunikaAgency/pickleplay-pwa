// Display formatters for the games screens, mirroring venueDisplay.ts. The API
// game data is real but loose (date is best-effort, venue may be a free-text
// fallback), so everything here degrades gracefully.

import type { ApiGame } from '../../shared/lib/api';
import type { Gender } from '../../shared/lib/permissions';

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
  const t = g.gameType.toLowerCase();
  if (t === 'open') return 'Open Play';
  if (t === 'public') return 'Public game';
  return g.gameType.charAt(0).toUpperCase() + g.gameType.slice(1);
}

/** A public game's competitive format label, e.g. "Round-robin". Empty for others. */
export function gameFormatLabel(g: Pick<ApiGame, 'format'>): string {
  switch (g.format) {
    case 'bracketing': return 'Bracketing';
    case 'round_robin': return 'Round-robin';
    case 'mini_tournament': return 'Mini-tournament';
    default: return '';
  }
}

/** The host-set vibe label ("Casual" / "Competitive"). Empty when unset. */
export function gameVibeLabel(g: Pick<ApiGame, 'vibe'>): string {
  if (g.vibe === 'casual') return 'Casual';
  if (g.vibe === 'competitive') return 'Competitive';
  return '';
}

/** True for an interest-based Open Play game (gameType 'open', incl. the untyped default). */
export function isOpenPlayGame(g: Pick<ApiGame, 'gameType'>): boolean {
  return ((g.gameType || '').toLowerCase() || 'open') === 'open';
}

/** "3 left" / "Full". */
export function spotsLabel(g: Pick<ApiGame, 'spotsLeft'>): string {
  const n = g.spotsLeft ?? 0;
  return n > 0 ? `${n} left` : 'Full';
}

/** Interest count for an Open Play game, e.g. "5 interested" / "No interest yet". */
export function interestCount(g: Pick<ApiGame, 'interestedCount' | 'interestedUsers'>): number {
  return g.interestedCount ?? g.interestedUsers?.length ?? 0;
}
export function interestLabel(g: Pick<ApiGame, 'interestedCount' | 'interestedUsers'>): string {
  const n = interestCount(g);
  return n > 0 ? `${n} interested` : 'No interest yet';
}

/** "5 interested · aiming for 8" when the host set a headcount target. */
export function interestWithTarget(g: Pick<ApiGame, 'interestedCount' | 'interestedUsers' | 'targetPlayers'>): string {
  const base = interestLabel(g);
  return g.targetPlayers ? `${base} · aiming for ${g.targetPlayers}` : base;
}

/* ─── Lobby leave / join timing rules ────────────────────────── */
//
// A game's roster is its "lobby". Not-full lobbies are freely leaveable, but a
// player who leaves TWICE gets a 1h re-join cooldown (server-enforced; the app
// mirrors it for UX copy). Once a lobby fills (`fullAt`), everyone gets a 1h
// window to leave freely; after it closes, leaving needs the host's approval
// (request-leave → approve-leave).
export const FULL_LOBBY_LEAVE_GRACE_MS = 3_600_000; // 1 hour

/** True once every spot is taken (the lobby is full). */
export function isLobbyFull(g: Pick<ApiGame, 'spotsLeft'>): boolean {
  return (g.spotsLeft ?? 0) <= 0;
}

/** Milliseconds left in the full lobby's free-leave window; 0 when closed/not full. */
export function freeLeaveMsLeft(g: Pick<ApiGame, 'spotsLeft' | 'fullAt'>): number {
  if (!isLobbyFull(g) || !g.fullAt) return 0;
  const elapsed = Date.now() - new Date(g.fullAt).getTime();
  return Math.max(0, FULL_LOBBY_LEAVE_GRACE_MS - elapsed);
}

/** Whether a joiner may still leave the lobby directly:
 *  - lobby not full → always leaveable (the server tracks the re-join cooldown)
 *  - lobby full and the 1h free-leave window is still open → leaveable
 *  - lobby full and the window closed → must ask the host (request-leave). */
export function canLeaveLobby(g: Pick<ApiGame, 'spotsLeft' | 'fullAt'>): boolean {
  if (!isLobbyFull(g)) return true;
  return freeLeaveMsLeft(g) > 0;
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

/* ─── Who can play (gender policy) ───────────────────────────── */

/** Badge label for a gender-restricted game; null when it's open to everyone
 *  (including games created before the field existed). */
export function genderPolicyLabel(policy?: string | null): string | null {
  if (policy === 'men') return 'Men only';
  if (policy === 'women') return 'Women only';
  return null;
}

/** Why the viewer can't take a seat in this game — null when they can (or when
 *  the game is open to all). A guest gets null: the auth sheet handles them, and
 *  we don't know their gender until they sign in. */
export function genderBlockReason(
  policy: string | null | undefined,
  viewerGender: Gender | undefined,
  isSignedIn: boolean,
): string | null {
  const label = genderPolicyLabel(policy);
  if (!label || !isSignedIn) return null;
  const wants: Gender = policy === 'women' ? 'female' : 'male';
  if (viewerGender === wants) return null;
  return viewerGender
    ? `Not eligible — ${label.toLowerCase()}`
    : 'Set your gender in your profile to join';
}
