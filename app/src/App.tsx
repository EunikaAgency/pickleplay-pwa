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
import { TabBar } from './components/layout/TabBar';
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
  useTheme();
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
      if (isTabScreen(prev.id)) setActiveTab(prev.id as TabId);
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

  const handleFabClick = () => navigate('create-game');

  // Tab bar is shown only on tab screens (matches Redesign behaviour).
  const hideChrome = ['landing', 'onboarding', 'login'].includes(screen.id);
  const showTabBar = isLoggedIn && isTabScreen(screen.id) && !hideChrome;

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
    <div className="app">
      {/* Offline banner */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 0, zIndex: 9999, paddingTop: 'env(safe-area-inset-top)' }}>
        <OfflineBanner forceShow={demoState === 'offline'} />
      </div>

      {renderScreen()}

      {showTabBar && (
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleFabClick} />
      )}

      {isLoggedIn && !hideChrome && <InstallPrompt hasBottomChrome={showTabBar} />}
      <DemoStateControl />
    </div>
  );
}
