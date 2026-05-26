import { useState } from 'react';
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
import { NearbyFiltersScreen } from './screens/NearbyFiltersScreen';
import { GameFiltersScreen } from './screens/GameFiltersScreen';
import { Icon } from './components/ui/Icon';
import { TabBar } from './components/layout/TabBar';
import { FAB } from './components/layout/FAB';

type Screen =
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
  | { id: 'notifications' }
  | { id: 'nearby-filters' }
  | { id: 'game-filters' };

const tabScreens = ['home', 'nearby', 'games', 'clubs', 'profile'] as const;
type TabId = (typeof tabScreens)[number];

function isTabScreen(id: string): id is TabId {
  return tabScreens.includes(id as TabId);
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [screen, setScreen] = useState<Screen>({ id: 'login' });
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
    setScreen({ id: 'login' });
    setHistory([]);
  };

  const handleFabClick = () => {
    navigate('create-game');
  };

  const hideChrome = ['onboarding', 'login', 'search', 'notifications', 'nearby-filters', 'game-filters'].includes(screen.id);
  const showTabBar = isLoggedIn && isTabScreen(screen.id) && !hideChrome;
  const showFab = isLoggedIn && (screen.id === 'home' || screen.id === 'games') && !hideChrome;
  const showBack = isLoggedIn && !isTabScreen(screen.id) && !hideChrome;

  const renderScreen = () => {
    if (!isLoggedIn) {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
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
      case 'nearby-filters':
        return <NearbyFiltersScreen onBack={goBack} />;
      case 'game-filters':
        return <GameFiltersScreen onBack={goBack} />;
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar */}
      {isLoggedIn && !hideChrome && (
        <header className="sticky top-0 z-40 w-full bg-surface shadow-sm" style={{ boxShadow: '0 1px 8px rgba(0,64,224,0.05)' }}>
          <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5">
            {showBack ? (
              <button onClick={goBack} className="flex items-center active:scale-95 transition-transform hover:opacity-80">
                <Icon name="arrow_back" size={24} className="text-primary" />
              </button>
            ) : (
              <h1 className="font-heading text-headline-md font-bold text-primary">PicklePlay</h1>
            )}
            <div className="flex gap-4">
              <button onClick={() => navigate('search')} className="active:scale-95 transition-transform hover:opacity-80">
                <Icon name="search" size={24} className="text-on-surface-variant" />
              </button>
              <button onClick={() => navigate('notifications')} className="active:scale-95 transition-transform hover:opacity-80">
                <Icon name="notifications" size={24} className="text-on-surface-variant" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {renderScreen()}
      </div>

      {/* FAB */}
      {showFab && <FAB onClick={handleFabClick} />}

      {/* Tab Bar */}
      {showTabBar && <TabBar activeTab={activeTab} onTabPress={handleTabPress} />}
    </div>
  );
}
