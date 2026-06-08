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
  | { id: 'game-lobby'; params: { id: string } }
  | { id: 'court-details'; params: { id: string } }
  | { id: 'club-details'; params: { id: string } }
  | { id: 'create-game' }
  | { id: 'edit-game'; params: { id: string } }
  | { id: 'my-games' }
  | { id: 'book-court'; params: { venueId?: string; date?: string; time?: string; hours?: number; gameId?: string } }
  | { id: 'my-bookings' }
  | { id: 'create-club' }
  | { id: 'edit-profile' }
  | { id: 'settings' }
  | { id: 'search' }
  | { id: 'invite-players'; params: { id: string } }
  | { id: 'notifications' }
  | { id: 'owner-venues' }
  | { id: 'owner-venue'; params: { id: string; tab?: string } }
  | { id: 'owner-new-venue' }
  | { id: 'owner-bookings' }
  | { id: 'owner-insights' }
  | { id: 'owner-notifications' };

export type ScreenId = Screen['id'];

export const tabScreens = ['home', 'nearby', 'games', 'clubs', 'profile'] as const;
export type TabId = (typeof tabScreens)[number];

type ScreensWithParams = Extract<Screen, { params: unknown }>;
type ScreensWithoutParams = Exclude<Screen, { params: unknown }>;

export type Navigate = {
  (id: ScreensWithoutParams['id']): void;
  <K extends ScreensWithParams['id']>(
    id: K,
    params: Extract<Screen, { id: K }>['params'],
  ): void;
};
