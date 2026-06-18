export type Screen =
  | { id: 'landing' }
  | { id: 'login' }
  | { id: 'onboarding' }
  | { id: 'home' }
  | { id: 'nearby' }
  | { id: 'games' }
  | { id: 'clubs' }
  | { id: 'profile' }
  | { id: 'game-details'; params: { id: string } }
  | { id: 'court-details'; params: { id: string } }
  | { id: 'club-details'; params: { id: string; invited?: boolean } }
  | { id: 'create-game' }
  | { id: 'edit-game'; params: { id: string } }
  | { id: 'my-games' }
  | { id: 'book-court'; params: { venueId?: string; date?: string; time?: string; hours?: number } }
  | { id: 'my-bookings' }
  | { id: 'create-club' }
  | { id: 'edit-profile' }
  | { id: 'settings' }
  | { id: 'search' }
  | { id: 'invite-players'; params: { id: string } }
  | { id: 'notifications' }
  | { id: 'messages' }
  | { id: 'chat'; params: { id: string; name?: string } }
  | { id: 'game-chat'; params: { id: string; name?: string } }
  | { id: 'owner-venues' }
  | { id: 'owner-venue'; params: { id: string; tab?: string } }
  | { id: 'owner-new-venue' }
  | { id: 'owner-bookings'; params: { status?: string } }
  | { id: 'owner-insights' }
  | { id: 'owner-notifications' };

export type ScreenId = Screen['id'];

export const tabScreens = ['home', 'nearby', 'games', 'clubs', 'profile'] as const;
export type TabId = (typeof tabScreens)[number];

/**
 * Map a URL path to a Screen for deep links — notification clicks open the PWA at
 * paths like `/games/<id>` or `/clubs/<slug>` (see the API's `linkUrl`s), and the
 * custom screen-stack nav needs to turn that path into the right screen on load.
 * Returns null for `/` or anything without a matching screen (→ default home).
 */
export function screenFromPath(pathname: string): Screen | null {
  const [head, tail] = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (!head) return null;
  const isObjectId = (s: string | undefined): s is string => !!s && /^[0-9a-fA-F]{24}$/.test(s);
  // A game-chat message deep link is /games/<id>/chat — open the group chat.
  const seg3 = pathname.replace(/^\/+|\/+$/g, '').split('/')[2];
  switch (head) {
    case 'games':
      if (isObjectId(tail)) {
        return seg3 === 'chat' ? { id: 'game-chat', params: { id: tail } } : { id: 'game-details', params: { id: tail } };
      }
      return { id: 'games' };
    case 'clubs':
      // Clubs link by slug or id — ClubDetails resolves either via getClub().
      // Landing here from a link is an invite → flag it so the club page can
      // greet the visitor with a "you're invited" prompt.
      return tail ? { id: 'club-details', params: { id: tail, invited: true } } : { id: 'clubs' };
    case 'venues':
    case 'nearby':
      return tail ? { id: 'court-details', params: { id: tail } } : { id: 'nearby' };
    case 'notifications':
      return { id: 'notifications' };
    case 'messages':
      // A message notification deep-links to /messages/<conversationId>.
      return isObjectId(tail) ? { id: 'chat', params: { id: tail } } : { id: 'messages' };
    default:
      return null;
  }
}

/** A sensible Back target to seed history with when a deep link lands on a detail screen. */
export function deepLinkParent(id: ScreenId): Screen {
  if (id === 'club-details') return { id: 'clubs' };
  if (id === 'court-details') return { id: 'nearby' };
  if (id === 'chat') return { id: 'messages' };
  if (id === 'game-chat') return { id: 'games' };
  return { id: 'home' };
}

type ScreensWithParams = Extract<Screen, { params: unknown }>;
type ScreensWithoutParams = Exclude<Screen, { params: unknown }>;

/** Options for a navigation. `replace` swaps the current screen out of the back
 *  stack instead of pushing on top — use it after finishing a flow so backing out
 *  of the result doesn't return to the (now-stale) form. */
export interface NavigateOptions {
  replace?: boolean;
}

export type Navigate = {
  (id: ScreensWithoutParams['id'], params?: undefined, opts?: NavigateOptions): void;
  <K extends ScreensWithParams['id']>(
    id: K,
    params: Extract<Screen, { id: K }>['params'],
    opts?: NavigateOptions,
  ): void;
};
