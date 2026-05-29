import { useState } from 'react';
import { LandingScreen } from './features/auth/LandingScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { OnboardingScreen } from './features/auth/OnboardingScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { NearbyScreen } from './features/venues/NearbyScreen';
import { GamesScreen } from './features/games/GamesScreen';
import { ClubsScreen } from './features/clubs/ClubsScreen';
import { GameDetailsScreen } from './features/games/GameDetailsScreen';
import { CourtDetailsScreen } from './features/venues/CourtDetailsScreen';
import { ClubDetailsScreen } from './features/clubs/ClubDetailsScreen';
import { CreateGameScreen } from './features/games/CreateGameScreen';
import { CreateClubScreen } from './features/clubs/CreateClubScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { EditProfileScreen } from './features/profile/EditProfileScreen';
import { SettingsScreen } from './features/profile/SettingsScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { InvitePlayersScreen } from './features/games/InvitePlayersScreen';
import { NotificationsScreen } from './features/profile/NotificationsScreen';
import { TabBar } from './shared/components/layout/TabBar';
import { Sidebar } from './shared/components/layout/Sidebar';
import { InstallPrompt } from './shared/components/ui/InstallPrompt';
import { OfflineBanner } from './shared/components/ui/OfflineBanner';
import { DemoStateControl } from './shared/components/ui/DemoStateControl';
import { DemoStateProvider, useDemoState } from './shared/lib/demoState';
import { createAppUser, userHasPermission, type AppUser, type Permission } from './shared/lib/permissions';
import { useTheme } from './shared/hooks/useTheme';
import { tabScreens, type Navigate, type Screen, type ScreenId, type TabId } from './shared/lib/navigation';

const SCREEN_PERMISSIONS: Partial<Record<ScreenId, Permission>> = {
  'create-game': 'player.games.create',
  'create-club': 'player.clubs.create',
  'edit-profile': 'player.profile.manage',
  settings: 'player.profile.manage',
  notifications: 'user.notifications.manage',
  'invite-players': 'player.games.create',
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [screen, setScreen] = useState<Screen>({ id: 'landing' });
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [history, setHistory] = useState<Screen[]>([]);

  const navigate = ((id: ScreenId, params?: { id: string }) => {
    const requiredPermission = SCREEN_PERMISSIONS[id];
    if (requiredPermission && !userHasPermission(currentUser, requiredPermission)) return;

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
    setHistory((prev) => [...prev, screen]);
    setActiveTab(tab);
    setScreen({ id: tab });
  };

  const handleLoginSuccess = () => {
    setCurrentUser(createAppUser('player'));
    setIsLoggedIn(true);
    if (needsOnboarding) {
      setScreen({ id: 'onboarding' });
    } else {
      setScreen({ id: 'home' });
      setActiveTab('home');
    }
    setHistory([]);
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    setScreen({ id: 'home' });
    setActiveTab('home');
    setHistory([]);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setScreen({ id: 'landing' });
    setHistory([]);
  };

  const goToLogin = () => setScreen({ id: 'login' });
  const goToLanding = () => setScreen({ id: 'landing' });

  const canCreateGame = userHasPermission(currentUser, 'player.games.create');
  const handleCreate = () => {
    if (canCreateGame) navigate('create-game');
  };

  // `hideChrome` matters for screens reachable while logged in — i.e. `onboarding`, which runs after login success.
  const hideChrome = ['landing', 'onboarding', 'login'].includes(screen.id);
  const showTabBar = isLoggedIn && isTabScreen(screen.id);
  const showSidebar = isLoggedIn && !hideChrome;
  const frame = screen.id === 'landing' ? 'wide' : 'standard';

  const renderScreen = () => {
    if (!isLoggedIn) {
      if (screen.id === 'login') {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} onBack={goToLanding} />;
      }
      return <LandingScreen onGetStarted={goToLogin} onSignIn={goToLogin} />;
    }

    if (screen.id === 'onboarding') {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }

    switch (screen.id) {
      case 'home':
        return <HomeScreen onNavigate={navigate} />;
      case 'nearby':
        return <NearbyScreen onNavigate={navigate} />;
      case 'games':
        return <GamesScreen onNavigate={navigate} />;
      case 'clubs':
        return <ClubsScreen onNavigate={navigate} onBack={goBack} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
      case 'game-details':
        return <GameDetailsScreen onNavigate={navigate} onBack={goBack} />;
      case 'court-details':
        return <CourtDetailsScreen onNavigate={navigate} onBack={goBack} />;
      case 'club-details':
        return <ClubDetailsScreen onNavigate={navigate} onBack={goBack} />;
      case 'create-game':
        return <CreateGameScreen onNavigate={navigate} onBack={goBack} />;
      case 'create-club':
        return <CreateClubScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-profile':
        return <EditProfileScreen onBack={goBack} />;
      case 'settings':
        return <SettingsScreen onBack={goBack} onLogout={handleLogout} onNavigate={navigate} />;
      case 'search':
        return <SearchScreen onNavigate={navigate} onBack={goBack} />;
      case 'invite-players':
        return <InvitePlayersScreen onNavigate={navigate} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="app" data-frame={frame}>
      {/* Offline banner */}
      <div className="fixed left-0 right-0 top-0 z-[9999] pt-[env(safe-area-inset-top)]">
        <OfflineBanner forceShow={demoState === 'offline'} />
      </div>

      {showSidebar && (
        <Sidebar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canCreateGame} />
      )}

      <main className="app-main">{renderScreen()}</main>

      {showTabBar && (
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canCreateGame} />
      )}

      {isLoggedIn && !hideChrome && <InstallPrompt hasBottomChrome={showTabBar} />}
      <DemoStateControl />
    </div>
  );
}
