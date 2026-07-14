// Relevance ranking for the Play tab's Discover feed — the server-side home of
// the scorer that used to run on the device (app/src/features/games/playRanking.ts).
//
// Discover merges two entity types with genuinely different shapes — venue-run
// OpenPlaySessions and player-hosted Games — into one ranked list. This module
// normalises both onto a `PlayItem` and scores it.
//
// It is deliberately pure: no Hono, no Mongoose, no `Date.now()` (the caller passes
// `now`). It consumes the SERIALIZED shapes the app already receives (games'
// `serialize()`, content's `serializeOpenPlaySession()`), not raw Mongo docs, so the
// scored item can carry the same `source` row the cards already render.
//
// Scoring is a weighted sum of subscores in [0,1]. A subscore whose *input* is
// unavailable is dropped from the sum and the remaining weights are renormalised,
// so a signed-out user with no location and no skill rating collapses cleanly to
// timeFit + fillPressure rather than to a degenerate ordering. This is the common
// case for a new user, not an edge case.
//
// TIMEZONE, load-bearing: `startAt` parses 'YYYY-MM-DDTHH:MM' with no offset, so it
// resolves in the PROCESS timezone. That is pinned to Asia/Manila in
// ecosystem.config.json, which is what makes the server's `timeFit` agree with the
// browser's for a PH player. Unpin it and every lead-time score silently shifts.

import { haversineKm, type LatLng } from '../../shared/lib/geo.js';

/* ─── Tunables ────────────────────────────────────────────────────────────── */

/** Weights are relative, not required to sum to 1 — the sum is renormalised over
 *  whichever signals are available for this user and item.
 *
 *  These now live server-side precisely so they can be retuned without shipping an
 *  app release. Section 14.7 of the 8 July minutes asks for exactly that. */
export const RANK_WEIGHTS = {
  timeFit: 0.30,
  proximity: 0.25,
  skillFit: 0.20,
  fillPressure: 0.15,
  social: 0.10,
} as const;

/** Beyond this, timeFit has decayed to ~0 and the listing is effectively unranked. */
export const HORIZON_DAYS = 14;
/** Under this much lead time you probably can't get across town in time. */
export const SOON_LEAD_HOURS = 2;
export const SOON_PENALTY = 0.4;
/** Proximity falls off linearly to zero at this distance. */
export const PROXIMITY_MAX_KM = 25;
/** A listing whose venue has no coordinates must not be punished for it. */
export const NEUTRAL_PROXIMITY = 0.5;
/** A listing with no skill band is "open to all": decent, not ideal. */
export const NEUTRAL_SKILL = 0.6;
/** Fill floor — an empty listing, and the floor for an interest-based one. */
const FILL_FLOOR = 0.35;

/* ─── The serialized rows this module ranks ───────────────────────────────── */

/** A person as the game serializer emits them. */
interface FeedPerson { id: string; displayName?: string; avatarUrl?: string | null }

/** The subset of a serialized Game the ranker reads. Structural on purpose — this
 *  module must not depend on the controller, or the controller can't import it. */
export interface FeedGame {
  id: string;
  gameType?: string | null;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  venue?: {
    displayName?: string; area?: string | null; city?: string | null;
    lat?: number | null; lng?: number | null;
    priceFromLabel?: string | null; image?: string | null;
  } | null;
  skillMin?: number | null;
  skillMax?: number | null;
  skillLabel?: string | null;
  capacity?: number | null;
  participantCount?: number | null;
  participants?: FeedPerson[];
  interestedUsers?: FeedPerson[];
  interestedCount?: number | null;
  targetPlayers?: number | null;
  creator?: { displayName?: string } | null;
  creatorId?: string | null;
  courtImage?: string | null;
  createdAt?: string | Date | null;
  [k: string]: unknown;
}

/** The subset of a serialized OpenPlaySession the ranker reads. */
export interface FeedSession {
  id: string;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  venueArea?: string | null;
  venueCity?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venueImage?: string | null;
  skillLevelMin?: number | null;
  skillLevelMax?: number | null;
  levelLabel?: string | null;
  capacity?: number | null;
  joinedCount?: number | null;
  organizerName?: string | null;
  price?: number | null;
  createdAt?: string | Date | null;
  [k: string]: unknown;
}

/* ─── The unified item ────────────────────────────────────────────────────── */

export type PlayKind = 'game' | 'session';

/** How full a listing is. The two entity types measure this incomparably:
 *  sessions and lobby games have a hard `capacity`; interest-based open games
 *  have none — only an interest count against an optional soft target. */
export type PlayFill =
  | { mode: 'capacity'; joined: number; cap: number }
  | { mode: 'interest'; count: number; target: number | null };

export interface PlayItem {
  kind: PlayKind;
  id: string;
  title: string;
  /** YYYY-MM-DD, or null when the listing has no knowable date. */
  date: string | null;
  /** 24h 'HH:MM', or null when unknown. Null sorts last within its date. */
  startTime: string | null;
  venueName: string;
  venueLoc: string;
  coords: LatLng | null;
  /** [min, max]; max is Infinity for open-ended labels like '4.0+'. Null = unset. */
  skillBand: [number, number] | null;
  skillLabel: string | null;
  fill: PlayFill;
  host: string | null;
  priceLabel: string | null;
  image: string | null;
  createdAt: string | null;
  /** The source row, for the card's navigation + type-specific rendering. */
  source: FeedGame | FeedSession;
}

export interface RankContext {
  now: Date;
  userLoc: LatLng | null;
  userSkill: number | null;
  /** Ids of the viewer's accepted friends. Empty/absent ⇒ the social signal is
   *  dropped and its weight redistributed. */
  friendIds?: Set<string>;
}

export interface ScoredPlayItem extends PlayItem {
  score: number;
  distanceKm: number | null;
  /** Short, human reasons this item ranked where it did — rendered as a card chip. */
  why: string[];
}

/* ─── Adapters ────────────────────────────────────────────────────────────── */

/** Open Play games (`gameType` 'open', including the untyped default) are
 *  interest-based and carry no capacity. Everything else is a real lobby. */
export function isInterestBased(g: FeedGame): boolean {
  return ((g.gameType || '').toLowerCase() || 'open') === 'open';
}

function bandOf(min?: number | null, max?: number | null): [number, number] | null {
  if (min == null) return null;
  // '4.0+' parses to a min with no max — treat it as open-ended upward.
  return [min, max ?? Infinity];
}

const asIso = (v: string | Date | null | undefined): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : v;

export function gameToPlayItem(g: FeedGame): PlayItem {
  const v = g.venue;
  const joined = g.participantCount ?? 0;
  const cap = g.capacity ?? 0;
  return {
    kind: 'game',
    // Coerced, not trusted: in-process the session serializer hands back a raw
    // ObjectId here (it only looks like a string once JSON has been through it),
    // and the sort's `localeCompare` tiebreak throws on one.
    id: String(g.id),
    title: (g.title && g.title.trim()) || 'Open Play',
    date: g.date ?? null,
    startTime: g.startTime ?? null,
    venueName: v?.displayName || g.venueName || 'Venue TBA',
    venueLoc: v ? [v.area, v.city].filter(Boolean).join(' · ') : '',
    coords: v?.lat != null && v?.lng != null ? [v.lat, v.lng] : null,
    skillBand: bandOf(g.skillMin, g.skillMax),
    skillLabel: g.skillLabel ?? null,
    fill: isInterestBased(g)
      ? { mode: 'interest', count: g.interestedCount ?? g.interestedUsers?.length ?? 0, target: g.targetPlayers ?? null }
      : { mode: 'capacity', joined, cap },
    host: g.creator?.displayName ?? null,
    priceLabel: v?.priceFromLabel ?? null,
    image: g.courtImage || v?.image || null,
    createdAt: asIso(g.createdAt),
    source: g,
  };
}

export function sessionToPlayItem(s: FeedSession): PlayItem {
  return {
    kind: 'session',
    id: String(s.id),
    title: s.title || 'Open Play',
    date: s.date ?? null,
    startTime: s.startTime ?? null,
    venueName: s.venueName || 'Venue TBA',
    venueLoc: [s.venueArea, s.venueCity].filter(Boolean).join(' · '),
    coords: s.venueLat != null && s.venueLng != null ? [s.venueLat, s.venueLng] : null,
    skillBand: bandOf(s.skillLevelMin, s.skillLevelMax),
    skillLabel: s.levelLabel ?? null,
    // A session's `joinedCount` is an interest count, but unlike an open game it
    // has a real `capacity` to measure against.
    fill: { mode: 'capacity', joined: s.joinedCount ?? 0, cap: s.capacity ?? 0 },
    host: s.organizerName ?? null,
    priceLabel: s.price != null ? (s.price === 0 ? 'Free' : `₱${s.price}`) : null,
    image: s.venueImage ?? null,
    createdAt: asIso(s.createdAt),
    source: s,
  };
}

/* ─── Subscores ───────────────────────────────────────────────────────────── */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Local Date for a listing's start. A listing with a date but no start time is
 *  treated as ending the day (23:59) so it sorts *after* every timed listing on
 *  that date — "nulls last", expressed as data rather than as a sort special-case. */
export function startAt(item: Pick<PlayItem, 'date' | 'startTime'>): Date | null {
  if (!item.date) return null;
  const d = new Date(`${item.date}T${item.startTime || '23:59'}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function timeFit(item: PlayItem, now: Date): number {
  const start = startAt(item);
  if (!start) return 0;
  const leadHours = (start.getTime() - now.getTime()) / 3_600_000;
  if (leadHours < 0) return 0; // already started
  const base = clamp01(1 - leadHours / (HORIZON_DAYS * 24));
  // Too soon to realistically get there — noise, not opportunity.
  return leadHours < SOON_LEAD_HOURS ? base * SOON_PENALTY : base;
}

export function proximity(item: PlayItem, userLoc: LatLng): number {
  if (!item.coords) return NEUTRAL_PROXIMITY;
  const km = haversineKm(userLoc, item.coords);
  return clamp01(1 - km / PROXIMITY_MAX_KM);
}

export function skillFit(item: PlayItem, userSkill: number): number {
  if (!item.skillBand) return NEUTRAL_SKILL;
  const [min, max] = item.skillBand;
  if (userSkill >= min && userSkill <= max) return 1;
  const gap = userSkill < min ? min - userSkill : userSkill - max;
  // Half a level out ≈ 0.6; a full level out ≈ 0.2; never quite zero.
  return Math.max(0.15, 1 - gap * 0.8);
}

/** Peaks at 60–90% full: enough momentum to be real, still a spot for you.
 *  Empty is a coin flip; completely full is aspirational social proof only. */
export function fillPressure(item: PlayItem): number {
  const f = item.fill;
  if (f.mode === 'capacity') {
    if (f.cap <= 0) return FILL_FLOOR;
    const r = f.joined / f.cap;
    if (r >= 1) return 0.15;
    if (r >= 0.9) return 0.8;
    if (r >= 0.6) return 1;
    return FILL_FLOOR + (r / 0.6) * (1 - FILL_FLOOR);
  }
  // Interest-based: there is no cap, so "over target" is good news, not a full
  // lobby. Never score below the floor just because the host set no target.
  if (f.target && f.target > 0) {
    return FILL_FLOOR + Math.min(1, f.count / f.target) * (1 - FILL_FLOOR);
  }
  return Math.min(0.9, FILL_FLOOR + 0.15 * Math.log2(1 + f.count));
}

export function social(item: PlayItem, friendIds: Set<string>): number {
  if (item.kind !== 'game') return 0;
  const g = item.source as FeedGame;
  if (g.creatorId && friendIds.has(g.creatorId)) return 1;
  const attending = [...(g.participants ?? []), ...(g.interestedUsers ?? [])];
  return attending.some((p) => friendIds.has(p.id)) ? 0.85 : 0;
}

/* ─── Scoring ─────────────────────────────────────────────────────────────── */

export function scoreItem(item: PlayItem, ctx: RankContext): ScoredPlayItem {
  const parts: { w: number; v: number }[] = [
    { w: RANK_WEIGHTS.timeFit, v: timeFit(item, ctx.now) },
    { w: RANK_WEIGHTS.fillPressure, v: fillPressure(item) },
  ];

  // Signals whose *input* is missing are dropped, not scored as zero — scoring a
  // missing input as zero would rank every listing identically badly and make the
  // available signals unable to separate them.
  if (ctx.userLoc) parts.push({ w: RANK_WEIGHTS.proximity, v: proximity(item, ctx.userLoc) });
  if (ctx.userSkill != null) parts.push({ w: RANK_WEIGHTS.skillFit, v: skillFit(item, ctx.userSkill) });
  if (ctx.friendIds?.size) parts.push({ w: RANK_WEIGHTS.social, v: social(item, ctx.friendIds) });

  const totalW = parts.reduce((a, p) => a + p.w, 0);
  const score = totalW > 0 ? parts.reduce((a, p) => a + p.w * p.v, 0) / totalW : 0;

  const distanceKm = ctx.userLoc && item.coords ? haversineKm(ctx.userLoc, item.coords) : null;
  return { ...item, score, distanceKm, why: explain(item, ctx, distanceKm) };
}

/** Why this surfaced. A ranked feed that can't explain itself reads as broken the
 *  first time it's wrong — and it will sometimes be wrong. */
function explain(item: PlayItem, ctx: RankContext, distanceKm: number | null): string[] {
  const why: string[] = [];

  if (ctx.friendIds?.size) {
    const s = social(item, ctx.friendIds);
    if (s === 1) why.push('A friend is hosting');
    else if (s > 0) why.push('Friends going');
  }
  if (distanceKm != null && distanceKm <= 5) why.push(`${formatDistance(distanceKm)} away`);
  if (ctx.userSkill != null && item.skillBand && skillFit(item, ctx.userSkill) === 1) why.push('Your level');

  const f = item.fill;
  if (f.mode === 'capacity' && f.cap > 0) {
    const left = f.cap - f.joined;
    if (left <= 0) why.push('Full');
    else if (left <= 2) why.push(`${left} spot${left === 1 ? '' : 's'} left`);
  } else if (f.mode === 'interest' && f.count >= 4) {
    why.push(`${f.count} interested`);
  }

  const start = startAt(item);
  if (start) {
    const leadHours = (start.getTime() - ctx.now.getTime()) / 3_600_000;
    if (leadHours >= 0 && leadHours < 6) why.push('Starting soon');
  }
  return why.slice(0, 2);
}

/** Mirrors the app's `formatDistance` so the "1.2 km away" chip reads identically
 *  whether it was built here or (historically) on the device. */
function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/* ─── Sorting ─────────────────────────────────────────────────────────────── */

export type SortKey = 'best' | 'soonest' | 'nearest' | 'fill' | 'newest';

/** Seats still open. Full lobbies and interest-based listings (which have no
 *  capacity at all) have no meaningful answer, so they sort last. */
export function spotsLeft(item: PlayItem): number {
  if (item.fill.mode !== 'capacity' || item.fill.cap <= 0) return Infinity;
  const left = item.fill.cap - item.fill.joined;
  return left > 0 ? left : Infinity;
}

/** Sort a scored list. Every comparator falls through to `id` so the order is
 *  total and stable — otherwise the feed appears to reshuffle between renders. */
export function sortScored(items: ScoredPlayItem[], key: SortKey): ScoredPlayItem[] {
  const byId = (a: ScoredPlayItem, b: ScoredPlayItem) => a.id.localeCompare(b.id);
  // Unknown values sort last regardless of direction.
  const last = <T,>(v: T | null, missing: T) => (v == null ? missing : v);

  const cmp: Record<SortKey, (a: ScoredPlayItem, b: ScoredPlayItem) => number> = {
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

/** The whole pipeline: normalise both sources, score, sort. */
export function rankPlayFeed(
  games: FeedGame[],
  sessions: FeedSession[],
  ctx: RankContext,
  sortKey: SortKey = 'best',
): ScoredPlayItem[] {
  const items = [...sessions.map(sessionToPlayItem), ...games.map(gameToPlayItem)];
  return sortScored(items.map((i) => scoreItem(i, ctx)), sortKey);
}
