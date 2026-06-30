import type { ApiGame, GameLinkCard } from './api';

/**
 * Detect a game URL in a message body and extract the game ID.
 *
 * Matches:
 *   - Full URLs:  https://pickleballers.app/games/<id>
 *   - Bare domain:  pickleballers.app/games/<id>
 *   - Path-only:  /games/<id>  (same-origin shorthand)
 *   - With trailing noise:  /games/<id>?foo=bar  /games/<id>/
 *
 * Returns the first match or null.
 */

export interface GameUrlMatch {
  gameId: string;
  /** The full matched substring (origin + path) — used to strip it from the body. */
  url: string;
}

/** Matches an optional protocol+origin prefix followed by /games/<id> + trailing path/query. */
const GAME_URL_RE = /(?:https?:\/\/\S+?)?\/games\/([a-zA-Z0-9_-]{10,36})(?:[\/?#]\S*)?/;

export function extractGameUrl(body: string): GameUrlMatch | null {
  const m = body.match(GAME_URL_RE);
  if (!m) return null;

  const gameId = m[1];
  // Require at least one hex character to avoid matching /games/create, /games/search etc.
  if (!/[0-9a-f]/i.test(gameId)) return null;

  let url = m[0];
  const matchStart = m.index!;

  // When no protocol was captured (the URL started with /games/…), check for a
  // bare domain immediately before the path — e.g. "pickleballers.app/games/abc".
  if (url.startsWith('/games/')) {
    const before = body.slice(0, matchStart);
    const bareDomain = before.match(/([\w.-]+\.[a-z]{2,}(?::\d+)?)$/);
    if (bareDomain) {
      url = bareDomain[0] + url;
    }
  }

  return { gameId, url };
}

/**
 * Strip a matched URL from the body text, cleaning up extra whitespace
 * and orphaned trailing punctuation (e.g. "text /link. more" → "text more").
 * Returns the trimmed remainder — or empty string if the body was just the URL.
 */
export function stripUrl(body: string, url: string): string {
  return body
    .replace(url, '')
    .replace(/\s+[.,;:!](?=\s|$)/g, '') // orphaned punctuation after URL removal
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Map an ApiGame to a GameLinkCard for embedding in a club chat message. */
export function apiGameToCardData(game: ApiGame): GameLinkCard {
  const venueName = game.venue?.displayName ?? game.venueName ?? undefined;
  const imageUrl = game.courtImage ?? game.venue?.image ?? undefined;
  const dateTime = [game.whenLabel, game.timeLabel].filter(Boolean).join(' · ') || undefined;

  return {
    gameId: game.id,
    title: game.title ?? undefined,
    gameType: game.gameType ?? undefined,
    skillLabel: game.skillLabel ?? undefined,
    dateTime,
    venue: venueName,
    imageUrl,
    spotsLeft: game.spotsLeft ?? undefined,
    capacity: game.capacity ?? undefined,
  };
}
