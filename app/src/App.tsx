import { useEffect, useState } from 'react';
import { LandingScreen } from './features/auth/LandingScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { OnboardingScreen } from './features/auth/OnboardingScreen';
import { HomeScreenSwitch } from './features/home/HomeScreenSwitch';
import { NearbyScreen } from './features/venues/NearbyScreen';
import { GamesScreen } from './features/games/GamesScreen';
import { ClubsScreen } from './features/clubs/ClubsScreen';
import { GameDetailsScreen } from './features/games/GameDetailsScreen';
import { CourtDetailsScreen } from './features/venues/CourtDetailsScreen';
import { ClubDetailsScreen } from './features/clubs/ClubDetailsScreen';
import { CreateGameScreen } from './features/games/CreateGameScreen';
import { GameLobbyScreen } from './features/games/GameLobbyScreen';
import { MyGamesScreen } from './features/games/MyGamesScreen';
import { BookCourtScreen } from './features/bookings/BookCourtScreen';
import { MyBookingsScreen } from './features/bookings/MyBookingsScreen';
import { CreateClubScreen } from './features/clubs/CreateClubScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { EditProfileScreen } from './features/profile/EditProfileScreen';
import { SettingsScreen } from './features/profile/SettingsScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { InvitePlayersScreen } from './features/games/InvitePlayersScreen';
import { NotificationsScreen } from './features/profile/NotificationsScreen';
import { OwnerVenuesScreen } from './features/owner/OwnerVenuesScreen';
import { OwnerHomeScreen } from './features/owner/OwnerHomeScreen';
import { OwnerNotificationsScreen } from './features/owner/OwnerNotificationsScreen';
import { OwnerBookingsScreen } from './features/owner/OwnerBookingsScreen';
import { OwnerInsightsScreen } from './features/owner/OwnerInsightsScreen';
import { OwnerGamesScreen } from './features/owner/OwnerGamesScreen';
import { OwnerNearbyScreen } from './features/owner/OwnerNearbyScreen';
import { OwnerVenueScreen } from './features/owner/OwnerVenueScreen';
import { OwnerNewVenueScreen } from './features/owner/OwnerNewVenueScreen';
import { TabBar } from './shared/components/layout/TabBar';
import { Sidebar } from './shared/components/layout/Sidebar';
import { InstallPrompt } from './shared/components/ui/InstallPrompt';
import { OfflineBanner } from './shared/components/ui/OfflineBanner';
import { AuthPromptSheet } from './shared/components/ui/AuthPromptSheet';
import { DemoStateControl } from './shared/components/ui/DemoStateControl';
import { DemoStateProvider, useDemoState } from './shared/lib/demoState';
import { userHasPermission, type Permission } from './shared/lib/permissions';
import { useAuthStore } from './shared/lib/authStore';
import { useTheme } from './shared/hooks/useTheme';
import { tabScreens, type Navigate, type Screen, type ScreenId, type TabId } from './shared/lib/navigation';

const SCREEN_PERMISSIONS: Partial<Record<ScreenId, Permission>> = {
  'create-game': 'player.games.create',
  'edit-game': 'player.games.manage',
  'my-games': 'player.games.manage',
  'game-lobby': 'player.games.vote',
  'book-court': 'player.bookings.create',
  'create-club': 'player.clubs.create',
  'edit-profile': 'player.profile.manage',
  settings: 'player.profile.manage',
  notifications: 'user.notifications.manage',
  'invite-players': 'player.games.create',
  'owner-venues': 'owner.access',
  'owner-venue': 'owner.venues.manage',
  'owner-new-venue': 'owner.venues.create',
  'owner-bookings': 'owner.bookings.manage',
  'owner-insights': 'owner.analytics.view',
  'owner-notifications': 'owner.notifications.view',
};

// Human-readable verb phrases for the guest auth prompt ("You'll need an
// account to <intent>"). Used when a guest hits a permission-gated screen.
const SCREEN_AUTH_INTENT: Partial<Record<ScreenId, string>> = {
  'create-game': 'create a game',
  'edit-game': 'edit your game',
  'my-games': 'see your games',
  'game-lobby': 'join the game lobby',
  'book-court': 'book a court',
  'my-bookings': 'see your bookings',
  'create-club': 'start a club',
  'invite-players': 'invite players',
  'edit-profile': 'manage your profile',
  settings: 'manage your settings',
  notifications: 'see your notifications',
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

function AppInner() {
  const { state: demoState } = useDemoState();
  useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const restoreSession = useAuthStore((s) => s.restore);
  const logout = useAuthStore((s) => s.logout);
  // Cold start drops guests straight onto the home tab so they can browse.
  const [screen, setScreen] = useState<Screen>({ id: 'home' });
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  // When set, the soft auth-gate sheet is shown; the string is the verb phrase
  // describing the action the guest tried to take ("join this game", …).
  const [authIntent, setAuthIntent] = useState<string | null>(null);

  // Soft auth gate: returns true if the action may proceed, otherwise opens the
  // "create an account" sheet and returns false. Guests can browse freely — we
  // only gate the commit actions (join / create / find a match).
  const requireAuth = (intent: string): boolean => {
    if (isLoggedIn) return true;
    setAuthIntent(intent);
    return false;
  };

  const navigate = ((id: ScreenId, params?: { id: string }) => {
    const requiredPermission = SCREEN_PERMISSIONS[id];
    if (requiredPermission && !userHasPermission(currentUser, requiredPermission)) {
      // A guest hit a gated screen — prompt them to sign up instead of silently
      // dropping the tap. Logged-in users lacking the permission still no-op.
      if (!isLoggedIn) setAuthIntent(SCREEN_AUTH_INTENT[id] ?? 'do that');
      return;
    }

    setHistory((prev) => [...prev, screen]);
    if (isTabScreen(id)) {
      setActiveTab(id);
      setScreen({ id } as Screen);
    } else {
      setScreen({ id, params } as Screen);
    }
  }) as Navigate;

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      if (isTabScreen(prev.id)) setActiveTab(prev.id);
      setScreen(prev);
    }
  };

  const handleTabPress = (tab: TabId) => {
    // The "You" tab is personal — for guests it reads "Login" and goes straight
    // to the sign-in / join flow instead of opening the profile.
    if (tab === 'profile' && !isLoggedIn) {
      goToLogin();
      return;
    }
    setHistory((prev) => [...prev, screen]);
    setActiveTab(tab);
    setScreen({ id: tab });
  };

  // Restore a session on cold start: the store validates any stored token
  // against /me and rehydrates the user (incl. their `hasOnboarded` flag). A
  // stale/invalid token just falls back to guest browsing (tokens cleared).
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Called by LoginScreen after the store's `login` action has set the user.
  // Only first-time users (who haven't onboarded on this account yet) see the
  // onboarding flow; everyone else lands straight on home. Read the freshly
  // logged-in user from the store — this render's `currentUser` is still stale.
  const handleLoginSuccess = () => {
    const user = useAuthStore.getState().user;
    if (user && !user.hasOnboarded) {
      setScreen({ id: 'onboarding' });
    } else {
      setScreen({ id: 'home' });
      setActiveTab('home');
    }
    setHistory([]);
  };

  // Onboarding persists the `hasOnboarded` flag to the account itself (see
  // OnboardingScreen → completeOnboarding), so it's remembered across sessions.
  const handleOnboardingComplete = () => {
    setScreen({ id: 'home' });
    setActiveTab('home');
    setHistory([]);
  };

  const handleLogout = () => {
    // Store clears the user + tokens (best-effort server logout).
    logout();
    // Logout returns to guest browsing on the home tab, not the landing page.
    setScreen({ id: 'home' });
    setActiveTab('home');
    setHistory([]);
  };

  // Enter the sign-in / sign-up flow from a guest screen, remembering where we
  // were so the back arrow returns to browsing. Also dismisses the auth sheet.
  const goToLogin = () => {
    setHistory((prev) => [...prev, screen]);
    setScreen({ id: 'login' });
    setAuthIntent(null);
  };

  const canCreateGame = userHasPermission(currentUser, 'player.games.create');
  const handleCreate = () => {
    if (!requireAuth('create a game')) return;
    if (canCreateGame) navigate('create-game');
  };
  // Guests see an enabled create button (it opens the auth prompt); logged-in
  // users see it enabled only when their role can actually create games.
  const canShowCreate = !isLoggedIn || canCreateGame;

  // `hideChrome` matters for the auth/onboarding surfaces, which run full-bleed.
  const hideChrome = ['landing', 'onboarding', 'login'].includes(screen.id);
  // Guests get the full chrome while browsing — that's how they roam the app.
  const showTabBar = !hideChrome && isTabScreen(screen.id);
  const showSidebar = !hideChrome;
  const frame = screen.id === 'landing' ? 'wide' : 'standard';

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
        // players/guests get the normal player home.
        return userHasPermission(currentUser, 'owner.access')
          ? <OwnerHomeScreen onNavigate={navigate} />
          : <HomeScreenSwitch onNavigate={navigate} />;
      case 'nearby':
        // Owners get a local market map (their venues vs nearby competitors);
        // players/guests get the normal discover-courts-near-me view.
        return userHasPermission(currentUser, 'owner.market.view')
          ? <OwnerNearbyScreen onNavigate={navigate} />
          : <NearbyScreen onNavigate={navigate} />;
      case 'games':
        // Owners get "Your courts" (games + bookings at their venues); players
        // get the normal browse/join games view.
        return userHasPermission(currentUser, 'owner.games.view')
          ? <OwnerGamesScreen onNavigate={navigate} />
          : <GamesScreen onNavigate={navigate} />;
      case 'clubs':
        return <ClubsScreen onNavigate={navigate} onBack={goBack} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
      case 'game-details':
        return <GameDetailsScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} onRequireAuth={requireAuth} />;
      case 'game-lobby':
        return <GameLobbyScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'court-details':
        return <CourtDetailsScreen key={screen.params.id} courtId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'club-details':
        return <ClubDetailsScreen onNavigate={navigate} onBack={goBack} />;
      case 'create-game':
        return <CreateGameScreen onNavigate={navigate} onBack={goBack} />;
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
            gameId={screen.params.gameId}
            onNavigate={navigate}
            onBack={goBack}
          />
        );
      case 'my-bookings':
        return <MyBookingsScreen onNavigate={navigate} onBack={goBack} />;
      case 'create-club':
        return <CreateClubScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-profile':
        return <EditProfileScreen onBack={goBack} />;
      case 'settings':
        return <SettingsScreen onBack={goBack} onLogout={handleLogout} onNavigate={navigate} />;
      case 'search':
        return <SearchScreen onNavigate={navigate} onBack={goBack} />;
      case 'invite-players':
        return <InvitePlayersScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-venues':
        return <OwnerVenuesScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-venue':
        return <OwnerVenueScreen key={screen.params.id} venueId={screen.params.id} initialTab={screen.params.tab} onNavigate={navigate} onBack={goBack} />;
      case 'owner-new-venue':
        return <OwnerNewVenueScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-bookings':
        return <OwnerBookingsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-insights':
        return <OwnerInsightsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-notifications':
        return <OwnerNotificationsScreen onNavigate={navigate} onBack={goBack} />;
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
        <Sidebar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} isLoggedIn={isLoggedIn} />
      )}

      <main className="app-main">{renderScreen()}</main>

      {showTabBar && (
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} isLoggedIn={isLoggedIn} />
      )}

      {!hideChrome && <InstallPrompt hasBottomChrome={showTabBar} />}

      <AuthPromptSheet
        open={authIntent !== null}
        intent={authIntent ?? ''}
        onClose={() => setAuthIntent(null)}
        onContinue={goToLogin}
      />

      <DemoStateControl />
    </div>
  );
}
