import { useState } from 'react';
import { LandingScreen } from './screens/LandingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NearbyScreen } from './screens/NearbyScreen';
import { GamesScreen } from './screens/GamesScreen';
import { ClubsScreen } from './screens/ClubsScreen';
import { GameDetailsScreen } from './screens/GameDetailsScreen';
import { CourtDetailsScreen } from './screens/CourtDetailsScreen';
import { ClubDetailsScreen } from './screens/ClubDetailsScreen';
import { CreateGameScreen } from './screens/CreateGameScreen';
import { CreateClubScreen } from './screens/CreateClubScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { InvitePlayersScreen } from './screens/InvitePlayersScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { Icon } from './components/ui/Icon';
import { TabBar } from './components/layout/TabBar';
import { Sidebar } from './components/layout/Sidebar';
import { FAB } from './components/layout/FAB';
import { InstallPrompt } from './components/ui/InstallPrompt';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { DemoStateControl } from './components/ui/DemoStateControl';
import { DemoStateProvider, useDemoState } from './lib/demoState';
import { useTheme } from './hooks/useTheme';

type Screen =
  | { id: 'landing' }
  | { id: 'login' }
  | { id: 'onboarding' }
  | { id: 'home' }
  | { id: 'nearby' }
  | { id: 'games' }
  | { id: 'clubs' }
  | { id: 'profile' }
  | { id: 'game-details'; params?: Record<string, string> }
  | { id: 'court-details'; params?: Record<string, string> }
  | { id: 'club-details'; params?: Record<string, string> }
  | { id: 'create-game' }
  | { id: 'create-club' }
  | { id: 'edit-profile' }
  | { id: 'settings' }
  | { id: 'search' }
  | { id: 'invite-players'; params?: Record<string, string> }
  | { id: 'notifications' };

const tabScreens = ['home', 'nearby', 'games', 'clubs', 'profile'] as const;
type TabId = (typeof tabScreens)[number];

function isTabScreen(id: string): id is TabId {
  return tabScreens.includes(id as TabId);
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
  useTheme(); // applies persisted theme to <html data-theme>
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [screen, setScreen] = useState<Screen>({ id: 'landing' });
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [history, setHistory] = useState<Screen[]>([]);

  const navigate = (id: string, params?: Record<string, string>) => {
    setHistory((prev) => [...prev, screen]);

    if (isTabScreen(id)) {
      setActiveTab(id);
      setScreen({ id } as Screen);
    } else {
      setScreen({ id, params } as Screen);
    }
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      if (isTabScreen(prev.id)) {
        setActiveTab(prev.id as TabId);
      }
      setScreen(prev);
    }
  };

  const handleTabPress = (tab: string) => {
    setHistory((prev) => [...prev, screen]);
    setActiveTab(tab as TabId);
    setScreen({ id: tab } as Screen);
  };

  const handleLoginSuccess = () => {
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
    setIsLoggedIn(false);
    setScreen({ id: 'landing' });
    setHistory([]);
  };

  const goToLogin = () => setScreen({ id: 'login' });
  const goToLanding = () => setScreen({ id: 'landing' });

  const handleFabClick = () => {
    navigate('create-game');
  };

  const hideChrome = ['landing', 'onboarding', 'login', 'search', 'notifications'].includes(screen.id);
  const showTabBar = isLoggedIn && isTabScreen(screen.id) && !hideChrome;
  const showSidebar = isLoggedIn && !hideChrome;
  const showFab = isLoggedIn && (screen.id === 'home' || screen.id === 'games') && !hideChrome;
  const showBack = isLoggedIn && !isTabScreen(screen.id) && !hideChrome;

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
        return <ClubsScreen onNavigate={navigate} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
      case 'game-details':
        return <GameDetailsScreen onNavigate={navigate} onBack={goBack} gameId={screen.params?.id} />;
      case 'court-details':
        return <CourtDetailsScreen onNavigate={navigate} onBack={goBack} courtId={screen.params?.id} />;
      case 'club-details':
        return <ClubDetailsScreen onNavigate={navigate} onBack={goBack} clubId={screen.params?.id} />;
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
        return <InvitePlayersScreen onNavigate={navigate} onBack={goBack} gameId={screen.params?.id} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 overflow-hidden bg-background">
      {/* Sidebar (md+ only, on logged-in tab/detail screens) */}
      {showSidebar && (
        <Sidebar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleFabClick} />
      )}

      {/* Right column: top bar + content + mobile bottom chrome */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        {isLoggedIn && !hideChrome && (
          <header
            className="sticky top-0 z-40 w-full bg-surface-container-lowest"
            style={{
              paddingTop: 'calc(0.25rem + env(safe-area-inset-top))',
              paddingBottom: '0.25rem',
            }}
          >
            <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between px-5">
              {showBack ? (
                <button
                  onClick={goBack}
                  className="flex items-center active:scale-95 transition-transform hover:opacity-80"
                  aria-label="Back"
                >
                  <Icon name="arrow_back" size={24} className="text-primary" />
                </button>
              ) : (
                <h1 className="font-heading text-headline-md font-bold text-primary md:hidden">PickleBallers</h1>
              )}
              <div className="flex gap-4 md:ml-auto">
                <button
                  onClick={() => navigate('search')}
                  className="active:scale-95 transition-transform hover:opacity-80"
                  aria-label="Search"
                >
                  <Icon name="search" size={24} className="text-on-surface-variant" />
                </button>
                <button
                  onClick={() => navigate('notifications')}
                  className="active:scale-95 transition-transform hover:opacity-80"
                  aria-label="Notifications"
                >
                  <Icon name="notifications" size={24} className="text-on-surface-variant" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <div className="flex w-full min-w-0 flex-1 overflow-hidden">
          {renderScreen()}
        </div>

        {/* FAB (mobile only via md:hidden) */}
        {showFab && <FAB onClick={handleFabClick} />}

        {/* Tab Bar (mobile only via md:hidden) */}
        {showTabBar && <TabBar activeTab={activeTab} onTabPress={handleTabPress} />}
      </div>

      {/* PWA Install Prompt — only shown once the user is logged in (the landing has its own pitch) */}
      {isLoggedIn && !hideChrome && <InstallPrompt hasBottomChrome={showTabBar || showFab} />}

      {/* Demo state control (only visible with ?demo=1) */}
      <DemoStateControl />

      {/* Offline banner — real navigator.onLine, or forced by demo state */}
      <div className="fixed left-0 right-0 top-0 z-[10000]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <OfflineBanner forceShow={demoState === 'offline'} />
      </div>
    </div>
  );
}
