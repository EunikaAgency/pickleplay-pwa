import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LandingScreen } from './features/auth/LandingScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { OnboardingScreen } from './features/auth/OnboardingScreen';
import { SplashScreen } from './features/auth/SplashScreen';
import { HomeScreenSwitch } from './features/home/HomeScreenSwitch';
import { NearbyScreen } from './features/venues/NearbyScreen';
import { GamesScreen } from './features/games/GamesScreen';
import { ClubsScreen } from './features/clubs/ClubsScreen';
import { GameDetailsScreen } from './features/games/GameDetailsScreen';
import { CourtDetailsScreen } from './features/venues/CourtDetailsScreen';
import { ClubDetailsScreen } from './features/clubs/ClubDetailsScreen';
import { CreateGameScreen } from './features/games/CreateGameScreen';
import { MyGamesScreen } from './features/games/MyGamesScreen';
import { BookCourtScreen } from './features/bookings/BookCourtScreen';
import { MyBookingsScreen } from './features/bookings/MyBookingsScreen';
import { PaymentHistoryScreen } from './features/profile/PaymentHistoryScreen';
import { CreateClubScreen } from './features/clubs/CreateClubScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { EditProfileScreen } from './features/profile/EditProfileScreen';
import { SettingsScreen } from './features/profile/SettingsScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { InvitePlayersScreen } from './features/games/InvitePlayersScreen';
import { NotificationsScreen } from './features/profile/NotificationsScreen';
import { ConversationsScreen } from './features/messages/ConversationsScreen';
import { ChatScreen } from './features/messages/ChatScreen';
import { GameChatScreen } from './features/games/GameChatScreen';
import { OwnerVenuesScreen } from './features/owner/OwnerVenuesScreen';
import { OwnerHomeScreen } from './features/owner/OwnerHomeScreen';
import { OwnerNotificationsScreen } from './features/owner/OwnerNotificationsScreen';
import { OwnerBookingsScreen } from './features/owner/OwnerBookingsScreen';
import { OwnerInsightsScreen } from './features/owner/OwnerInsightsScreen';
import { OwnerGamesScreen } from './features/owner/OwnerGamesScreen';
import { OwnerNearbyScreen } from './features/owner/OwnerNearbyScreen';
import { OwnerVenueScreen } from './features/owner/OwnerVenueScreen';
import { OwnerNewVenueScreen } from './features/owner/OwnerNewVenueScreen';
import { OrganizerHubScreen } from './features/organizer/OrganizerHubScreen';
import { TournamentsScreen } from './features/organizer/tournaments/TournamentsScreen';
import { CreateTournamentScreen } from './features/organizer/tournaments/CreateTournamentScreen';
import { TournamentDetailScreen } from './features/organizer/tournaments/TournamentDetailScreen';
import { BracketScreen } from './features/organizer/tournaments/BracketScreen';
import { OpenPlayScreen } from './features/organizer/openplay/OpenPlayScreen';
import { SessionRosterScreen } from './features/organizer/openplay/SessionRosterScreen';
import { RostersScreen } from './features/organizer/rosters/RostersScreen';
import { RosterDetailScreen } from './features/organizer/rosters/RosterDetailScreen';
import { VenueRequestsScreen } from './features/organizer/venues/VenueRequestsScreen';
import { TabBar } from './shared/components/layout/TabBar';
import { Sidebar } from './shared/components/layout/Sidebar';
import { InstallPrompt } from './shared/components/ui/InstallPrompt';
import { OfflineBanner } from './shared/components/ui/OfflineBanner';
import { AuthPromptSheet } from './shared/components/ui/AuthPromptSheet';
import { DemoStateControl } from './shared/components/ui/DemoStateControl';
import { DemoStateProvider, useDemoState } from './shared/lib/demoState';
import { userHasPermission, type Permission } from './shared/lib/permissions';
import { useAuthStore } from './shared/lib/authStore';
import { useNotificationPolling } from './shared/hooks/useNotificationPolling';
import { useRealtimeStream } from './shared/hooks/useRealtimeStream';
import { usePlayerDesign } from './shared/lib/playerDesign';
import { useTheme } from './shared/hooks/useTheme';
import { tabScreens, pathFromScreen, screenFromLocation, deepLinkParent, type Navigate, type Screen, type ScreenId, type TabId } from './shared/lib/navigation';
// v2.1 redesign ("Pickleballers Mockup v2.1") — player-side screens + the design toggle.
import { DesignSwitch } from './features/home/DesignSwitch';
import { HomeScreenV2 } from './features/home/v2/HomeScreenV2';
import { NearbyScreenV2 } from './features/venues/v2/NearbyScreenV2';
import { GamesScreenV2 } from './features/games/v2/GamesScreenV2';
import { ClubsScreenV2 } from './features/clubs/v2/ClubsScreenV2';
import { ProfileScreenV2 } from './features/profile/v2/ProfileScreenV2';
import { SettingsScreenV2 } from './features/profile/v2/SettingsScreenV2';
import { CreateGameV2 } from './features/games/v2/CreateGameV2';
import { CreateChoiceSheet } from './features/games/v2/CreateChoiceSheet';
import { CreateClubV2 } from './features/clubs/v2/CreateClubV2';
import type { V2ScreenChrome } from './shared/components/layout/V2Chrome';

const SCREEN_PERMISSIONS: Partial<Record<ScreenId, Permission>> = {
  'create-game': 'player.games.create',
  'edit-game': 'player.games.manage',
  'my-games': 'player.games.manage',
  'book-court': 'player.bookings.create',
  'payment-history': 'player.payments.view',
  'create-club': 'player.clubs.create',
  'edit-profile': 'player.profile.manage',
  settings: 'player.profile.manage',
  notifications: 'user.notifications.manage',
  messages: 'user.messages.send',
  chat: 'user.messages.send',
  'game-chat': 'player.games.chat',
  'invite-players': 'player.games.create',
  'owner-venues': 'owner.access',
  'owner-venue': 'owner.venues.manage',
  'owner-new-venue': 'owner.venues.create',
  'owner-bookings': 'owner.bookings.manage',
  'owner-insights': 'owner.analytics.view',
  'owner-notifications': 'owner.notifications.view',
  'organizer-hub': 'organizer.access',
  'organizer-tournaments': 'organizer.tournaments.manage',
  'organizer-tournament': 'organizer.tournaments.manage',
  'organizer-tournament-new': 'organizer.tournaments.manage',
  'organizer-bracket': 'organizer.brackets.manage',
  'organizer-open-play': 'organizer.events.manage',
  'organizer-session': 'organizer.events.manage',
  'organizer-rosters': 'organizer.events.manage',
  'organizer-roster': 'organizer.events.manage',
  'organizer-venue-requests': 'organizer.tournaments.manage',
};

// Human-readable verb phrases for the guest auth prompt ("You'll need an
// account to <intent>"). Used when a guest hits a permission-gated screen.
const SCREEN_AUTH_INTENT: Partial<Record<ScreenId, string>> = {
  'create-game': 'create a game',
  'edit-game': 'edit your game',
  'my-games': 'see your games',
  'book-court': 'book a court',
  'my-bookings': 'see your bookings',
  'payment-history': 'see your payment history',
  'create-club': 'start a club',
  'invite-players': 'invite players',
  'edit-profile': 'manage your profile',
  settings: 'manage your settings',
  notifications: 'see your notifications',
  messages: 'see your messages',
  chat: 'send a message',
  'game-chat': 'open the game chat',
  'owner-venues': 'manage your venues',
  'owner-venue': 'manage your venue',
  'owner-new-venue': 'add a venue',
  'owner-bookings': 'see your bookings',
  'owner-insights': 'see your insights',
};

function isTabScreen(id: ScreenId): id is TabId {
  return (tabScreens as readonly string[]).includes(id);
}

export default function App() {
  return (
    <DemoStateProvider>
      <AppInner />
    </DemoStateProvider>
  );
}

// ── URL routing ─────────────────────────────────────────────────────────────
// The PWA is fully URL-routed: every screen has its own path (see
// `pathFromScreen`/`screenFromLocation` in navigation.ts), so the browser
// back/forward buttons, refresh, deep links and shareable URLs all just work.
// We drive the History API directly (no router library) and surface the current
// location through `useSyncExternalStore`, so React re-renders on every push,
// replace, and popstate. The rendered screen is derived purely from the URL —
// there is no in-memory screen/history state anymore.
const NAV_EVENT = 'pb:navigate';
// Once-per-session flag so the launch splash doesn't replay on every reload.
const SPLASH_KEY = 'pb-splash-seen';

const locationKey = () => window.location.pathname + window.location.search;

function subscribeLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

// In-app history depth, kept on `history.state` so it survives reload and is
// restored by the browser on back/forward. Lets `goBack` tell a deep-link
// cold-start (idx 0 → back should go to a sane parent, not off-site) from a
// screen we pushed (idx > 0 → just pop).
function historyIndex(): number {
  const s = window.history.state as { pbIdx?: number } | null;
  return typeof s?.pbIdx === 'number' ? s.pbIdx : 0;
}

// Push (or replace) a path and notify subscribers. Navigating to the path we're
// already on is a no-op so re-tapping a tab doesn't pile up history entries.
function routerNavigate(to: string, opts?: { replace?: boolean }) {
  if (to === locationKey()) return;
  const idx = historyIndex();
  if (opts?.replace) window.history.replaceState({ pbIdx: idx }, '', to);
  else window.history.pushState({ pbIdx: idx + 1 }, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

// Subscribe to the URL and resolve it to the active Screen.
function useCurrentScreen(): Screen {
  const key = useSyncExternalStore(subscribeLocation, locationKey, locationKey);
  return useMemo(() => screenFromLocation(window.location.pathname, window.location.search), [key]);
}

// Which tab to highlight for a given screen — tab screens map to themselves;
// detail/flow screens map to the tab they belong under (purely cosmetic).
function tabForScreen(id: ScreenId): TabId {
  if (isTabScreen(id)) return id;
  if (id === 'court-details' || id === 'book-court') return 'nearby';
  if (id === 'club-details' || id === 'create-club') return 'clubs';
  if (id === 'game-details' || id === 'game-chat' || id === 'create-game' || id === 'edit-game' || id === 'my-games' || id === 'invite-players') return 'games';
  return 'profile';
}

function AppInner() {
  const { state: demoState } = useDemoState();
  useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const restoreSession = useAuthStore((s) => s.restore);
  const logout = useAuthStore((s) => s.logout);
  // Keep the unread-notification badge live while signed in (polls + refreshes
  // on focus/visibility); clears on logout.
  useNotificationPolling(isLoggedIn);
  // Realtime push of new notifications + incoming messages over one SSE stream
  // (the 30s poll above stays as a fallback if the stream drops).
  useRealtimeStream(isLoggedIn);
  // A deep link (notification click / shared URL) opens the PWA at a path like
  // `/games/<id>`; resolve it to the initial screen, else cold-start on home so
  // guests can browse. Detail-screen deep links seed a Back target so the back
  // arrow returns somewhere sane instead of dead-ending.
  // The active screen is derived from the URL (single source of truth); the tab
  // to highlight and whether Back is available fall out of it. No screen/history
  // state — the browser owns history now.
  const screen = useCurrentScreen();
  const activeTab = tabForScreen(screen.id);
  const canGoBack = !isTabScreen(screen.id) || historyIndex() > 0;
  // When set, the soft auth-gate sheet is shown; the string is the verb phrase
  // describing the action the guest tried to take ("join this game", …).
  const [authIntent, setAuthIntent] = useState<string | null>(null);
  // The v2.1 "Game On" chooser (join a game vs host a lobby) — an app-level sheet
  // so every create entry point (FAB, home quick action, empty states) opens it.
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);

  // Animated launch splash — shown once per browser session on cold start, then
  // dismissed by the "Let's Play" CTA. The app mounts behind it (so session
  // restore etc. run during the intro); the splash just sits on top.
  const [showSplash, setShowSplash] = useState(() => {
    try { return sessionStorage.getItem(SPLASH_KEY) !== '1'; } catch { return true; }
  });
  const dismissSplash = () => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* private mode — splash just shows again next load */ }
    setShowSplash(false);
  };

  // Soft auth gate: returns true if the action may proceed, otherwise opens the
  // "create an account" sheet and returns false. Guests can browse freely — we
  // only gate the commit actions (join / create / find a match).
  const requireAuth = (intent: string): boolean => {
    if (isLoggedIn) return true;
    setAuthIntent(intent);
    return false;
  };

  const navigate = ((id: ScreenId, params?: Record<string, unknown>, opts?: { replace?: boolean }) => {
    const requiredPermission = SCREEN_PERMISSIONS[id];
    if (requiredPermission && !userHasPermission(currentUser, requiredPermission)) {
      // A guest hit a gated screen — prompt them to sign up instead of silently
      // dropping the tap. Logged-in users lacking the permission still no-op.
      if (!isLoggedIn) setAuthIntent(SCREEN_AUTH_INTENT[id] ?? 'do that');
      return;
    }
    // Drive the URL. `replace` swaps the current entry instead of pushing, so
    // backing out of the destination skips it — e.g. after creating a game, back
    // from the new game's details goes where the user started, not the form.
    routerNavigate(pathFromScreen({ id, params } as Screen), { replace: opts?.replace });
  }) as Navigate;

  const goBack = () => {
    // Real browser history: pop it when there's an in-app entry to return to.
    if (historyIndex() > 0) {
      window.history.back();
      return;
    }
    // Cold-start / deep-link landing (nothing to pop) — go to a sane parent
    // instead of stepping off the app entirely.
    routerNavigate(pathFromScreen(deepLinkParent(screen.id)), { replace: true });
  };

  const handleTabPress = (tab: TabId) => {
    // The "You" tab is personal — for guests it reads "Login" and goes straight
    // to the sign-in / join flow instead of opening the profile.
    if (tab === 'profile' && !isLoggedIn) {
      goToLogin();
      return;
    }
    routerNavigate(pathFromScreen({ id: tab } as Screen));
  };

  // Tracks when session restore has settled, so the route guard below doesn't
  // bounce a logged-in user off a gated deep link before their token revalidates.
  const [restored, setRestored] = useState(false);

  // Restore a session on cold start: the store validates any stored token
  // against /me and rehydrates the user (incl. their `hasOnboarded` flag). A
  // stale/invalid token just falls back to guest browsing (tokens cleared).
  useEffect(() => {
    Promise.resolve(restoreSession()).finally(() => setRestored(true));
  }, [restoreSession]);

  // Seed the in-app history index on the first entry so back/forward can tell a
  // cold-start from a screen we pushed (see `historyIndex`/`goBack`). The URL is
  // left exactly as loaded — deep links and refresh land on the right screen.
  useEffect(() => {
    const s = window.history.state as { pbIdx?: number } | null;
    if (typeof s?.pbIdx !== 'number') {
      window.history.replaceState({ ...(s ?? {}), pbIdx: 0 }, '');
    }
  }, []);

  // Route guard for direct URL loads / browser-back into a gated screen: the
  // per-tap gate in `navigate` can't catch a hard navigation straight to a
  // permissioned path, so once restore settles, redirect home (and prompt guests
  // to sign in) when the current screen needs a permission the user lacks.
  useEffect(() => {
    if (!restored) return;
    const perm = SCREEN_PERMISSIONS[screen.id];
    if (perm && !userHasPermission(currentUser, perm)) {
      if (!isLoggedIn) setAuthIntent(SCREEN_AUTH_INTENT[screen.id] ?? 'do that');
      routerNavigate('/', { replace: true });
    }
  }, [restored, screen.id, currentUser, isLoggedIn]);

  // Called by LoginScreen after the store's `login` action has set the user.
  // Only first-time users (who haven't onboarded on this account yet) see the
  // onboarding flow; everyone else lands straight on home. Read the freshly
  // logged-in user from the store — this render's `currentUser` is still stale.
  const handleLoginSuccess = () => {
    const user = useAuthStore.getState().user;
    // Replace so backing out of the destination doesn't return to the login form.
    routerNavigate(pathFromScreen({ id: user && !user.hasOnboarded ? 'onboarding' : 'home' }), { replace: true });
  };

  // Onboarding persists the `hasOnboarded` flag to the account itself (see
  // OnboardingScreen → completeOnboarding), so it's remembered across sessions.
  const handleOnboardingComplete = () => {
    routerNavigate('/', { replace: true });
  };

  const handleLogout = () => {
    // Store clears the user + tokens (best-effort server logout).
    logout();
    // Return to guest browsing on the home tab (not the landing page). Any stale
    // signed-in URL still in history is caught by the route guard above on back.
    routerNavigate('/', { replace: true });
  };

  // Enter the sign-in / sign-up flow from a guest screen. Pushed (not replaced)
  // so the back arrow returns to browsing. Also dismisses the auth sheet.
  const goToLogin = () => {
    setAuthIntent(null);
    routerNavigate(pathFromScreen({ id: 'login' }));
  };

  // Player-side design selector. v2.1 is only offered to players/guests (owners
  // keep their dedicated dashboards), so it's gated by !owner.access.
  const design = usePlayerDesign((s) => s.design);
  const isOwner = userHasPermission(currentUser, 'owner.access');
  const playerV2 = design === 'v2' && !isOwner;

  const canCreateGame = userHasPermission(currentUser, 'player.games.create');
  const handleCreate = () => {
    if (!requireAuth('create a game')) return;
    if (!canCreateGame) return;
    // v2.1: ask "join a game or host a lobby?" first. Hosting requires a booked
    // court (see CreateChoiceSheet). Classic/New designs keep the direct form.
    if (playerV2) { setCreateChoiceOpen(true); return; }
    navigate('create-game');
  };
  // Guests see an enabled create button (it opens the auth prompt); logged-in
  // users see it enabled only when their role can actually create games.
  const canShowCreate = !isLoggedIn || canCreateGame;

  // `hideChrome` matters for the auth/onboarding surfaces, which run full-bleed.
  const hideChrome = ['landing', 'onboarding', 'login'].includes(screen.id);
  // Guests get the full chrome while browsing — that's how they roam the app.
  // In v2.1 the player screens supply their own top nav + bottom tab bar, so the
  // app's mobile TabBar (and the install prompt riding above it) are suppressed.
  const showTabBar = !hideChrome && isTabScreen(screen.id) && !playerV2;
  const showSidebar = !hideChrome;
  const frame = screen.id === 'landing' ? 'wide' : 'standard';

  // The chrome/handlers every v2 player screen needs (tab bar, FAB, auth gate,
  // and the universal header back button — bound to the app's absolute history).
  const v2Chrome: V2ScreenChrome = {
    activeTab, onNavigate: navigate, onTabPress: handleTabPress,
    onCreate: handleCreate, isLoggedIn, requireAuth,
    onBack: goBack, canGoBack,
  };

  const renderScreen = () => {
    // Auth + onboarding surfaces render full-bleed regardless of login state.
    if (screen.id === 'login') {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} onBack={goBack} />;
    }
    if (screen.id === 'landing') {
      return <LandingScreen onGetStarted={goToLogin} onSignIn={goToLogin} />;
    }
    if (screen.id === 'onboarding') {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }

    // Everything below is browsable as a guest; commit actions inside each
    // screen call back through `navigate`/`requireAuth` to trigger the gate.
    switch (screen.id) {
      case 'home':
        // Owners get their dashboard on the Home tab (in the homepage design);
        // players/guests get the player home (v2.1 redesign when toggled on).
        if (userHasPermission(currentUser, 'owner.access')) return <OwnerHomeScreen onNavigate={navigate} />;
        return playerV2 ? <HomeScreenV2 {...v2Chrome} /> : <HomeScreenSwitch onNavigate={navigate} />;
      case 'nearby':
        // Owners get a local market map (their venues vs nearby competitors);
        // players/guests get the normal discover-courts-near-me view.
        if (userHasPermission(currentUser, 'owner.market.view')) return <OwnerNearbyScreen onNavigate={navigate} />;
        return playerV2 ? <NearbyScreenV2 {...v2Chrome} intent={screen.params?.intent} /> : <NearbyScreen onNavigate={navigate} />;
      case 'games':
        // Owners get "Your courts" (games + bookings at their venues); players
        // get the normal browse/join games view.
        if (userHasPermission(currentUser, 'owner.games.view')) return <OwnerGamesScreen onNavigate={navigate} />;
        return playerV2 ? <GamesScreenV2 {...v2Chrome} /> : <GamesScreen onNavigate={navigate} />;
      case 'clubs':
        return playerV2 ? <ClubsScreenV2 {...v2Chrome} /> : <ClubsScreen onNavigate={navigate} onBack={goBack} />;
      case 'profile':
        return playerV2 ? <ProfileScreenV2 {...v2Chrome} onLogout={handleLogout} /> : <ProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
      case 'game-details':
        return <GameDetailsScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} onRequireAuth={requireAuth} />;
      case 'court-details':
        return <CourtDetailsScreen key={screen.params.id} courtId={screen.params.id} intent={screen.params.intent} onNavigate={navigate} onBack={goBack} />;
      case 'club-details':
        return <ClubDetailsScreen key={screen.params.id} clubId={screen.params.id} invited={screen.params.invited} onNavigate={navigate} onBack={goBack} />;
      case 'create-game':
        return playerV2 ? <CreateGameV2 {...v2Chrome} bookingId={screen.params?.bookingId} onBack={goBack} /> : <CreateGameScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-game':
        return <CreateGameScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'my-games':
        return <MyGamesScreen onNavigate={navigate} onBack={goBack} />;
      case 'book-court':
        return (
          <BookCourtScreen
            venueId={screen.params.venueId}
            date={screen.params.date}
            time={screen.params.time}
            hours={screen.params.hours}
            intent={screen.params.intent}
            onNavigate={navigate}
            onBack={goBack}
          />
        );
      case 'my-bookings':
        return <MyBookingsScreen onNavigate={navigate} onBack={goBack} />;
      case 'payment-history':
        return <PaymentHistoryScreen onNavigate={navigate} onBack={goBack} />;
      case 'create-club':
        return playerV2 ? <CreateClubV2 {...v2Chrome} onBack={goBack} /> : <CreateClubScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-profile':
        return <EditProfileScreen onBack={goBack} />;
      case 'settings':
        return playerV2
          ? <SettingsScreenV2 {...v2Chrome} onLogout={handleLogout} />
          : <SettingsScreen onBack={goBack} onLogout={handleLogout} onNavigate={navigate} />;
      case 'search':
        return <SearchScreen onNavigate={navigate} onBack={goBack} />;
      case 'invite-players':
        return <InvitePlayersScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'messages':
        return <ConversationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'chat':
        return <ChatScreen key={screen.params.id} conversationId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'game-chat':
        return <GameChatScreen key={screen.params.id} gameId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'owner-venues':
        return <OwnerVenuesScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-venue':
        return <OwnerVenueScreen key={screen.params.id} venueId={screen.params.id} initialTab={screen.params.tab} onNavigate={navigate} onBack={goBack} />;
      case 'owner-new-venue':
        return <OwnerNewVenueScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-bookings':
        return <OwnerBookingsScreen initialStatus={screen.params?.status as 'all' | 'pending_approval' | 'confirmed' | 'cancelled' | undefined} onNavigate={navigate} onBack={goBack} />;
      case 'owner-insights':
        return <OwnerInsightsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-notifications':
        return <OwnerNotificationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-hub':
        return <OrganizerHubScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournaments':
        return <TournamentsScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournament-new':
        return <CreateTournamentScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournament':
        return <TournamentDetailScreen key={screen.params.id} tournamentId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'organizer-bracket':
        return <BracketScreen key={screen.params.tournamentId} tournamentId={screen.params.tournamentId} onBack={goBack} />;
      case 'organizer-open-play':
        return <OpenPlayScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-session':
        return <SessionRosterScreen key={screen.params.id} sessionId={screen.params.id} onBack={goBack} />;
      case 'organizer-rosters':
        return <RostersScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-roster':
        return <RosterDetailScreen key={screen.params.id} rosterId={screen.params.id} onBack={goBack} />;
      case 'organizer-venue-requests':
        return <VenueRequestsScreen tournamentId={screen.params?.tournamentId} onNavigate={navigate} onBack={goBack} />;
      default:
        return <HomeScreenSwitch onNavigate={navigate} />;
    }
  };

  return (
    <div className="app" data-frame={frame}>
      {/* Offline banner */}
      <div className="fixed left-0 right-0 top-0 z-[9999] pt-[env(safe-area-inset-top)]">
        <OfflineBanner forceShow={demoState === 'offline'} />
      </div>

      {showSidebar && (
        <Sidebar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} isLoggedIn={isLoggedIn} onBack={goBack} canGoBack={canGoBack} onOpenMessages={() => navigate('messages')} />
      )}

      <main className="app-main">{renderScreen()}</main>

      {showTabBar && (
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} isLoggedIn={isLoggedIn} isOwner={isOwner} />
      )}

      {/* Tab screens only: detail/wizard screens carry a sticky bottom CTA the
          banner would otherwise float over and intercept taps on. */}
      {showTabBar && <InstallPrompt hasBottomChrome />}

      <AuthPromptSheet
        open={authIntent !== null}
        intent={authIntent ?? ''}
        onClose={() => setAuthIntent(null)}
        onContinue={goToLogin}
      />

      {/* v2.1 "Game On" chooser — join a game vs host a lobby on a booked court. */}
      {playerV2 && (
        <CreateChoiceSheet
          open={createChoiceOpen}
          onClose={() => setCreateChoiceOpen(false)}
          onNavigate={navigate}
        />
      )}

      {/* Floating player-design toggle (New · Classic · v2.1). Owners keep their
          dashboards, so it's hidden for them and on the auth/onboarding surfaces. */}
      {!hideChrome && !isOwner && <DesignSwitch />}

      <DemoStateControl />

      {/* Animated launch splash, on top of everything (waits for the CTA tap). */}
      {showSplash && <SplashScreen onDone={dismissSplash} />}
    </div>
  );
}
