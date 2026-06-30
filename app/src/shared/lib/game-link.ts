import type { ApiGame, GameLinkCard } from './api';

/**
 * Detect a game URL in a message body and extract the game ID.
 *
 * Matches:
 *   - Full URLs:  https://pickleballers.app/games/<id>
 *   - Path-only:  /games/<id>  (same-origin shorthand)
 *   - With trailing noise:  /games/<id>?foo=bar  /games/<id>/
 *
 * Returns the first match or null.
 */

export interface GameUrlMatch {
  gameId: string;
  /** The full matched URL substring — used to strip it from the body. */
  url: string;
}

const GAME_PATH_RE = /\/games\/([a-zA-Z0-9_-]{10,36})\b/;

export function extractGameUrl(body: string): GameUrlMatch | null {
  // Match a path segment /games/<id> — works for both full URLs and bare paths
  // because the path is the same regardless of the origin.
  const m = body.match(GAME_PATH_RE);
  if (!m) return null;

  const gameId = m[1];
  const url = m[0];

  // Require at least one hex character to avoid matching /games/create, /games/search etc.
  // ObjectIds are 24 hex chars; slugs could be shorter, but they'll have at least one hex digit.
  if (!/[0-9a-f]/i.test(gameId)) return null;

  return { gameId, url };
}

/**
 * Strip a matched URL from the body text, cleaning up extra whitespace.
 * Returns the trimmed remainder — or empty string if the body was just the URL.
 */
export function stripUrl(body: string, url: string): string {
  return body.replace(url, '').replace(/\s{2,}/g, ' ').trim();
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
