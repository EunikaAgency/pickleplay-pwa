export type Screen =
  | { id: 'landing' }
  | { id: 'login' }
  | { id: 'forgot-password' }
  | { id: 'reset-password'; params: { token: string } }
  | { id: 'onboarding' }
  | { id: 'home' }
  // `intent: 'lobby'` = the user came here to book a court so they can then host a
  // lobby; Nearby shows a "select a court" banner and the booking flow hands back
  // to create-game on completion.
  | { id: 'nearby'; params?: { intent?: 'lobby' } }
  | { id: 'games'; params?: { section?: 'games' | 'open-play'; view?: 'discover' | 'joined' | 'invites' | 'manage' } }
  | { id: 'booking' }
  | { id: 'tournaments' }
  | { id: 'tournament'; params: { id: string } }
  | { id: 'tournament-chat'; params: { id: string; name?: string } }
  // The Social tab — Clubs + Friends. `clubs` and `friends` survive as
  // non-tab aliases so `/clubs`, `/friends`, and every existing
  // `onNavigate('clubs'|'friends')` call site keep landing on the right panel.
  | { id: 'social'; params?: { tab?: 'clubs' | 'friends' } }
  | { id: 'clubs' }
  | { id: 'profile' }
  | { id: 'game-details'; params: { id: string } }
  | { id: 'open-play-detail'; params: { source: 'auto' | 'game' | 'session'; id: string } }
  | { id: 'court-details'; params: { id: string; intent?: 'lobby'; filterDate?: string; filterStartHour?: number; filterEndHour?: number } }
  | { id: 'club-details'; params: { id: string; invited?: boolean } }
  | { id: 'club-post'; params: { id: string; postId: string } }
  | { id: 'club-post-edit'; params: { id: string; postId: string } }
  | { id: 'club-chat'; params: { id: string; name?: string } }
  // `bookingId` = host a lobby on an already-booked court (skips the inline
  // book+pay step); the create form locks venue/date/time to that reservation.
  | { id: 'create-game'; params?: { bookingId?: string } }
  | { id: 'edit-game'; params: { id: string } }
  | { id: 'my-games' }
  | { id: 'book-court'; params: { venueId?: string; date?: string; time?: string; hours?: number; courtId?: string; intent?: 'lobby' } }
  | { id: 'my-bookings' }
  // Refund / cancel a single court booking (e.g. after a host deletes a lobby but
  // keeps the court reserved).
  | { id: 'booking-refund'; params: { bookingId: string } }
  | { id: 'payment-history' }
  | { id: 'create-club' }
  | { id: 'edit-club'; params: { id: string } }
  | { id: 'edit-profile' }
  | { id: 'settings' }
  | { id: 'test-email' }
  | { id: 'search' }
  | { id: 'invite-players'; params: { id: string } }
  | { id: 'notifications' }
  | { id: 'friends' }
  | { id: 'members' }
  | { id: 'messages' }
  | { id: 'chat'; params: { id: string; name?: string } }
  | { id: 'game-chat'; params: { id: string; name?: string } }
  | { id: 'owner-venues' }
  | { id: 'owner-venues-v2' }
  | { id: 'owner-venue'; params: { id: string; tab?: string } }
  | { id: 'owner-new-venue' }
  | { id: 'claim-venue' }
  | { id: 'owner-bookings'; params: { status?: string } }
  | { id: 'owner-front-desk'; params?: { venueId?: string } }
  | { id: 'owner-manual-reservation'; params?: { venueId?: string } }
  | { id: 'owner-calendar' }
  | { id: 'owner-pricing' }
  | { id: 'owner-partners' }
  | { id: 'owner-insights' }
  | { id: 'owner-notifications' }
  | { id: 'owner-staff' }
  | { id: 'owner-settlements' }
  | { id: 'owner-shop' }
  | { id: 'owner-subscription-plans'; params: { venueId: string; venueName?: string } }
  | { id: 'organizer-hub' }
  | { id: 'organizer-tournaments' }
  | { id: 'organizer-tournament'; params: { id: string } }
  | { id: 'organizer-tournament-new' }
  | { id: 'organizer-bracket'; params: { tournamentId: string } }
  | { id: 'organizer-open-play' }
  | { id: 'organizer-session'; params: { id: string } }
  | { id: 'organizer-rosters' }
  | { id: 'organizer-roster'; params: { id: string } }
  | { id: 'organizer-venue-requests'; params: { tournamentId?: string } }
  | { id: 'admin-claims' }
  // Open-play (V3): a courtless per-session drop-in booking at a venue.
  | { id: 'open-play-book'; params: { venueId: string } }
  // Public flowchart viewer (no auth required).
  | { id: 'flowchart' }
  // Public full-screen venue map (no auth required).
  | { id: 'map' };

export type ScreenId = Screen['id'];

export const tabScreens = ['home', 'nearby', 'games', 'tournaments', 'social', 'messages', 'profile', 'booking'] as const;
export type TabId = (typeof tabScreens)[number];

/**
 * Build the canonical URL path for a screen — the inverse of
 * `screenFromLocation`. Entity IDs go in the path (`/games/:id`); optional
 * modifiers (intent, tab, status, …) ride in the query string. The app is
 * URL-routed, so this is exactly what `navigate()` pushes to the History API.
 */
export function pathFromScreen(screen: Screen): string {
  const q = (obj: Record<string, string | number | boolean | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== '' && v !== false) sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
  };
  switch (screen.id) {
    case 'home': return '/';
    case 'landing': return '/welcome';
    case 'login': return '/login';
    case 'forgot-password': return '/forgot-password';
    case 'reset-password': return `/reset-password?token=${encodeURIComponent(screen.params.token)}`;
    case 'onboarding': return '/onboarding';
    case 'nearby': return `/nearby${q({ intent: screen.params?.intent })}`;
    case 'games': return `/games${q({ section: screen.params?.section, view: screen.params?.view })}`;
    case 'booking': return '/booking';
    case 'tournaments': return '/tournaments';
    case 'tournament': return `/tournaments/${screen.params.id}`;
    case 'tournament-chat': return `/tournaments/${screen.params.id}/chat${q({ name: screen.params.name })}`;
    case 'social': return `/social${q({ tab: screen.params?.tab })}`;
    case 'clubs': return '/clubs';
    case 'profile': return '/profile';
    case 'game-details': return `/games/${screen.params.id}`;
    case 'open-play-detail': return `/open-play/${screen.params.id}`;
    case 'court-details': return `/venues/${screen.params.id}${q({ intent: screen.params.intent, filterDate: screen.params.filterDate, filterStartHour: screen.params.filterStartHour, filterEndHour: screen.params.filterEndHour })}`;
    case 'club-details': return `/clubs/${screen.params.id}${q({ invited: screen.params.invited })}`;
    case 'club-post': return `/clubs/${screen.params.id}/posts/${screen.params.postId}`;
    case 'club-post-edit': return `/clubs/${screen.params.id}/posts/${screen.params.postId}/edit`;
    case 'club-chat': return `/clubs/${screen.params.id}/chat${q({ name: screen.params.name })}`;
    case 'create-game': return `/games/create${q({ bookingId: screen.params?.bookingId })}`;
    case 'edit-game': return `/games/${screen.params.id}/edit`;
    case 'my-games': return '/my-games';
    case 'book-court': return `/book${q({ venueId: screen.params.venueId, date: screen.params.date, time: screen.params.time, hours: screen.params.hours, courtId: screen.params.courtId, intent: screen.params.intent })}`;
    case 'my-bookings': return '/my-bookings';
    case 'booking-refund': return `/bookings/${screen.params.bookingId}/refund`;
    case 'payment-history': return '/payments';
    case 'create-club': return '/clubs/create';
    case 'edit-club': return `/clubs/${screen.params.id}/edit`;
    case 'edit-profile': return '/profile/edit';
    case 'settings': return '/settings';
    case 'test-email': return '/settings/test-email';
    case 'search': return '/search';
    case 'invite-players': return `/games/${screen.params.id}/invite`;
    case 'notifications': return '/notifications';
    case 'friends': return '/friends';
    case 'members': return '/owner/members';
    case 'messages': return '/messages';
    case 'chat': return `/messages/${screen.params.id}${q({ name: screen.params.name })}`;
    case 'game-chat': return `/games/${screen.params.id}/chat${q({ name: screen.params.name })}`;
    case 'owner-venues': return '/owner/venues';
    case 'owner-venues-v2': return '/owner/venues/v2';
    case 'owner-venue': return `/owner/venues/${screen.params.id}${q({ tab: screen.params.tab })}`;
    case 'owner-new-venue': return '/owner/venues/new';
    case 'claim-venue': return '/owner/venues/claim';
    case 'owner-bookings': return `/owner/reports${q({ status: screen.params?.status })}`;
    case 'owner-front-desk': return `/owner/front-desk${q({ venue: screen.params?.venueId })}`;
    case 'owner-manual-reservation': return `/owner/manual-reservation${q({ venue: screen.params?.venueId })}`;
    case 'owner-calendar': return '/owner/calendar';
    case 'owner-pricing': return '/owner/pricing';
    case 'owner-partners': return '/owner/partners';
    case 'owner-insights': return '/owner/insights';
    case 'owner-notifications': return '/owner/notifications';
    case 'owner-staff': return '/owner/staff';
    case 'owner-settlements': return '/owner/settlements';
    case 'owner-shop': return '/shop';
    case 'owner-subscription-plans': return `/owner/venues/${screen.params.venueId}/subscription-plans`;
    case 'organizer-hub': return '/organizer';
    case 'organizer-tournaments': return '/organizer/tournaments';
    case 'organizer-tournament-new': return '/organizer/tournaments/new';
    case 'organizer-tournament': return `/organizer/tournaments/${screen.params.id}`;
    case 'organizer-bracket': return `/organizer/tournaments/${screen.params.tournamentId}/bracket`;
    case 'organizer-open-play': return '/organizer/open-play';
    case 'organizer-session': return `/organizer/sessions/${screen.params.id}`;
    case 'organizer-rosters': return '/organizer/rosters';
    case 'organizer-roster': return `/organizer/rosters/${screen.params.id}`;
    case 'organizer-venue-requests': return `/organizer/venue-requests${q({ tournamentId: screen.params?.tournamentId })}`;
    case 'admin-claims': return '/admin/claims';
    case 'open-play-book': return `/venues/${screen.params.venueId}/open-play`;
    case 'flowchart': return '/flowchart';
    case 'map': return '/map';
  }
  return '/';
}

/**
 * Resolve the current URL to a Screen — the inverse of `pathFromScreen`, and the
 * single source of truth for which screen is shown (the app renders off the URL).
 * Drives first paint, refresh, deep links (notification/share URLs like
 * `/games/<id>` or `/clubs/<slug>`), and browser back/forward. `/venues/:id` and
 * `/nearby/:id` both open a court (deep-link aliases). Unknown paths → home.
 */
export function screenFromLocation(pathname: string, search = ''): Screen {
  const sp = new URLSearchParams(search);
  const segs = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const [a, b, c, d, e] = segs;
  const opt = (v: string | null) => (v == null || v === '' ? undefined : v);
  const lobby = sp.get('intent') === 'lobby' ? ('lobby' as const) : undefined;
  if (!a) return { id: 'home' };
  switch (a) {
    case 'home': return { id: 'home' };
    case 'welcome': return { id: 'landing' };
    case 'login': return { id: 'login' };
    case 'forgot-password': return { id: 'forgot-password' };
    case 'reset-password': return { id: 'reset-password', params: { token: sp.get('token') || '' } };
    case 'onboarding': return { id: 'onboarding' };
    case 'nearby':
      if (b) return { id: 'court-details', params: { id: b, intent: lobby, filterDate: opt(sp.get('filterDate')), filterStartHour: opt(sp.get('filterStartHour')) ? Number(sp.get('filterStartHour')) : undefined, filterEndHour: opt(sp.get('filterEndHour')) ? Number(sp.get('filterEndHour')) : undefined } };
      return { id: 'nearby', params: lobby ? { intent: lobby } : undefined };
    case 'venues':
      if (b && c === 'open-play') return { id: 'open-play-book', params: { venueId: b } };
      if (b) return { id: 'court-details', params: { id: b, intent: lobby, filterDate: opt(sp.get('filterDate')), filterStartHour: opt(sp.get('filterStartHour')) ? Number(sp.get('filterStartHour')) : undefined, filterEndHour: opt(sp.get('filterEndHour')) ? Number(sp.get('filterEndHour')) : undefined } };
      return { id: 'nearby' };
    case 'games':
      if (!b) {
        const section = sp.get('section');
        const view = sp.get('view');
        return {
          id: 'games',
          params: {
            section: section === 'open-play' ? 'open-play' : 'games',
            view: view === 'joined' || view === 'invites' || view === 'manage' ? view : 'discover',
          },
        };
      }
      if (b === 'create') return { id: 'create-game', params: opt(sp.get('bookingId')) ? { bookingId: sp.get('bookingId')! } : undefined };
      if (c === 'edit') return { id: 'edit-game', params: { id: b } };
      if (c === 'chat') return { id: 'game-chat', params: { id: b, name: opt(sp.get('name')) } };
      if (c === 'invite') return { id: 'invite-players', params: { id: b } };
      return { id: 'game-details', params: { id: b } };
    case 'booking':
      return { id: 'booking' };
    case 'tournaments':
      if (c === 'chat') return { id: 'tournament-chat', params: { id: b, name: opt(sp.get('name')) } };
      if (b) return { id: 'tournament', params: { id: b } };
      return { id: 'tournaments' };
    case 'social': {
      const t = sp.get('tab');
      return { id: 'social', params: { tab: t === 'friends' || t === 'clubs' ? t : undefined } };
    }
    case 'clubs':
      // Bare `/clubs` still works — it just lands on the Social tab's Clubs panel.
      if (!b) return { id: 'clubs' };
      if (b === 'create') return { id: 'create-club' };
      if (c === 'edit') return { id: 'edit-club', params: { id: b } };
      if (c === 'chat') return { id: 'club-chat', params: { id: b, name: opt(sp.get('name')) } };
      if (c === 'posts' && d && e === 'edit') return { id: 'club-post-edit', params: { id: b, postId: d } };
      if (c === 'posts' && d) return { id: 'club-post', params: { id: b, postId: d } };
      // A bare `/clubs/<slug>` cold-load is treated as an invite arrival (see
      // App.tsx) so the "you're invited" prompt still greets share-link visitors.
      return { id: 'club-details', params: { id: b, invited: sp.get('invited') === '1' || undefined } };
    case 'my-games': return { id: 'games', params: { section: 'open-play', view: 'manage' } };
    case 'book': return { id: 'book-court', params: { venueId: opt(sp.get('venueId')), date: opt(sp.get('date')), time: opt(sp.get('time')), hours: opt(sp.get('hours')) ? Number(sp.get('hours')) : undefined, courtId: opt(sp.get('courtId')), intent: lobby } };
    case 'my-bookings': return { id: 'games', params: { section: 'open-play', view: 'manage' } };
    case 'bookings':
      if (b && c === 'refund') return { id: 'booking-refund', params: { bookingId: b } };
      return { id: 'games', params: { section: 'open-play', view: 'manage' } };
    case 'open-play':
      if ((b === 'game' || b === 'session') && c) return { id: 'open-play-detail', params: { source: b, id: c } };
      if (b) return { id: 'open-play-detail', params: { source: 'auto', id: b } };
      return { id: 'games', params: { section: 'open-play', view: 'discover' } };
    case 'payments': return { id: 'payment-history' };
    case 'profile': return b === 'edit' ? { id: 'edit-profile' } : { id: 'profile' };
    case 'settings':
      if (b === 'test-email') return { id: 'test-email' };
      return { id: 'settings' };
    case 'search': return { id: 'search' };
    case 'notifications': return { id: 'notifications' };
    case 'friends': return { id: 'friends' };
    case 'messages': return b ? { id: 'chat', params: { id: b, name: opt(sp.get('name')) } } : { id: 'messages' };
    case 'owner':
      if (b === 'venues') {
        if (!c) return { id: 'owner-venues' };
        if (c === 'v2') return { id: 'owner-venues-v2' };
        if (c === 'new') return { id: 'owner-new-venue' };
        if (c === 'claim') return { id: 'claim-venue' };
        if (d === 'subscription-plans') return { id: 'owner-subscription-plans', params: { venueId: c } };
        return { id: 'owner-venue', params: { id: c, tab: opt(sp.get('tab')) } };
      }
      // Canonical path is /owner/reports; /owner/bookings kept as a legacy alias so old links still resolve.
      if (b === 'reports' || b === 'bookings') return { id: 'owner-bookings', params: opt(sp.get('status')) ? { status: sp.get('status')! } : {} };
      if (b === 'front-desk') return { id: 'owner-front-desk', params: opt(sp.get('venue')) ? { venueId: sp.get('venue')! } : {} };
      if (b === 'manual-reservation') return { id: 'owner-manual-reservation', params: opt(sp.get('venue')) ? { venueId: sp.get('venue')! } : {} };
      if (b === 'calendar') return { id: 'owner-calendar' };
      if (b === 'pricing') return { id: 'owner-pricing' };
      if (b === 'partners') return { id: 'owner-partners' };
      if (b === 'insights') return { id: 'owner-insights' };
      if (b === 'notifications') return { id: 'owner-notifications' };
      if (b === 'staff') return { id: 'owner-staff' };
      if (b === 'settlements') return { id: 'owner-settlements' };
      if (b === 'members') return { id: 'members' };
      return { id: 'home' };
    case 'organizer':
      if (!b) return { id: 'organizer-hub' };
      if (b === 'tournaments') {
        if (!c) return { id: 'organizer-tournaments' };
        if (c === 'new') return { id: 'organizer-tournament-new' };
        if (d === 'bracket') return { id: 'organizer-bracket', params: { tournamentId: c } };
        return { id: 'organizer-tournament', params: { id: c } };
      }
      if (b === 'open-play') return { id: 'organizer-open-play' };
      if (b === 'sessions' && c) return { id: 'organizer-session', params: { id: c } };
      if (b === 'rosters') return c ? { id: 'organizer-roster', params: { id: c } } : { id: 'organizer-rosters' };
      if (b === 'venue-requests') return { id: 'organizer-venue-requests', params: opt(sp.get('tournamentId')) ? { tournamentId: sp.get('tournamentId')! } : {} };
      return { id: 'organizer-hub' };
    case 'shop': return { id: 'owner-shop' };
    case 'flowchart': return { id: 'flowchart' };
    case 'map': return { id: 'map' };
    case 'admin':
      if (b === 'claims') return { id: 'admin-claims' };
      return { id: 'home' };
    default: return { id: 'home' };
  }
}

/** A sensible Back target to seed history with when a deep link lands on a detail screen. */
export function deepLinkParent(id: ScreenId): Screen {
  if (id === 'booking') return { id: 'home' };
  if (id === 'club-details' || id === 'edit-club' || id === 'club-post' || id === 'club-post-edit' || id === 'club-chat') return { id: 'social', params: { tab: 'clubs' } };
  if (id === 'tournament' || id === 'tournament-chat') return { id: 'tournaments' };
  if (id === 'open-play-detail') return { id: 'games', params: { section: 'open-play', view: 'discover' } };
  if (id === 'court-details') return { id: 'nearby' };
  if (id === 'booking-refund') return { id: 'my-bookings' };
  if (id === 'owner-venues-v2') return { id: 'home' };
  if (id === 'claim-venue') return { id: 'owner-venues' };
  if (id === 'owner-calendar') return { id: 'profile' };
  if (id === 'owner-manual-reservation') return { id: 'owner-pricing' };
  if (id === 'owner-partners') return { id: 'profile' };
  if (id === 'owner-staff') return { id: 'profile' };
  if (id === 'owner-shop') return { id: 'profile' };
  if (id === 'owner-subscription-plans') return { id: 'owner-venues' };
  if (id === 'owner-settlements') return { id: 'profile' };
  if (id === 'chat') return { id: 'messages' };
  if (id === 'game-chat') return { id: 'games' };
  if (id === 'organizer-tournament' || id === 'organizer-tournament-new') return { id: 'organizer-tournaments' };
  if (id === 'organizer-bracket') return { id: 'organizer-tournaments' };
  if (id === 'organizer-session') return { id: 'organizer-open-play' };
  if (id === 'organizer-roster') return { id: 'organizer-rosters' };
  if (id === 'test-email') return { id: 'settings' };
  if (id.startsWith('organizer-')) return { id: 'organizer-hub' };
  if (id === 'admin-claims') return { id: 'profile' };
  if (id === 'open-play-book') return { id: 'nearby' };
  if (id === 'flowchart') return { id: 'home' };
  if (id === 'map') return { id: 'nearby' };
  // Friends now lives in the Social tab, not behind Profile.
  if (id === 'friends' || id === 'clubs' || id === 'social') return { id: 'home' };
  if (id === 'members') return { id: 'profile' };
  return { id: 'home' };
}

/** Options for a navigation. `replace` swaps the current screen out of the back
 *  stack instead of pushing on top — use it after finishing a flow so backing out
 *  of the result doesn't return to the (now-stale) form. */
export interface NavigateOptions {
  replace?: boolean;
}

// The params type a screen declares (or `never` if it has no params key).
type ScreenParams<S> = S extends { params?: infer P } ? P : never;

/**
 * The trailing args a given screen id accepts, derived from its `Screen` member:
 * - no `params` key  → params omitted (tab/leaf screens, e.g. `navigate('home')`)
 * - **required** `params` (`params: {…}`) → params required (e.g. `game-details`)
 * - **optional** `params?` (`params?: {…}`) → params optional, so the screen can be
 *   reached both bare and with params (e.g. `nearby` as a tab vs. with `{intent}`).
 */
type NavigateRest<K extends ScreenId, S = Extract<Screen, { id: K }>> =
  'params' extends keyof S
    // `{}` here is the standard "are all keys optional?" probe — an empty object
    // satisfies `Pick<S,'params'>` only when `params` is itself optional.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    ? {} extends Pick<S, 'params' & keyof S>
      ? [params?: ScreenParams<S>, opts?: NavigateOptions]
      : [params: ScreenParams<S>, opts?: NavigateOptions]
    : [params?: undefined, opts?: NavigateOptions];

export type Navigate = <K extends ScreenId>(id: K, ...rest: NavigateRest<K>) => void;
