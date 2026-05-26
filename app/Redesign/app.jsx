// PickleBallers — app root

const { useState, useRef, useEffect } = React;

function StatusBar({ time = '9:41' }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 54,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 30px 0',
      zIndex: 12,
      pointerEvents: 'none',
    }}>
      <span style={{
        fontFamily: '-apple-system, "SF Pro Display", system-ui',
        fontWeight: 600, fontSize: 16, color: 'var(--ink)',
      }}>{time}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink)' }}>
        <svg width="18" height="11" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="currentColor"/>
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="currentColor"/>
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="currentColor"/>
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="currentColor"/>
        </svg>
        <svg width="16" height="11" viewBox="0 0 17 12">
          <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill="currentColor"/>
          <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill="currentColor"/>
          <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor"/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.35" fill="none"/>
          <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/>
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="currentColor" fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

// Persisted tweak defaults
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "lime",
  "showStatusBar": true,
  "startScreen": "home"
}/*EDITMODE-END*/;

function App({ tweaks }) {
  const [tab, setTab] = useState(tweaks.startScreen || 'home');
  const [gameOpen, setGameOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const toastTimer = useRef(null);

  // Apply theme + accent to root whenever tweaks change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    const accents = {
      lime:   { primary: '#0040e0', accent: '#c1f100', accentInk: '#2a3700', soft: '#e8fb8a' },
      coral:  { primary: '#0040e0', accent: '#ff7355', accentInk: '#3d0a00', soft: '#ffd2c6' },
      violet: { primary: '#5b3df3', accent: '#a78bfa', accentInk: '#1e1244', soft: '#e9e2ff' },
      sun:    { primary: '#0040e0', accent: '#ffc94d', accentInk: '#3d2a00', soft: '#ffe9b3' },
    };
    const a = accents[tweaks.accent] || accents.lime;
    document.documentElement.style.setProperty('--primary', a.primary);
    document.documentElement.style.setProperty('--lime',     a.accent);
    document.documentElement.style.setProperty('--lime-ink', a.accentInk);
    document.documentElement.style.setProperty('--lime-soft', a.soft);
  }, [tweaks.theme, tweaks.accent]);

  const showToast = (message) => {
    setToast({ show: true, message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ show: false, message: '' }), 2200);
  };

  const openGame = () => setGameOpen(true);
  const closeGame = () => setGameOpen(false);

  return (
    <div className="app">
      {tweaks.showStatusBar && <StatusBar />}

      {tab === 'home'    && <HomeScreen    onOpenGame={openGame} onOpenNotifs={() => setNotifsOpen(true)} onTab={setTab} />}
      {tab === 'games'   && <GamesScreen   onOpenGame={openGame} onOpenFilters={() => setFiltersOpen(true)} />}
      {tab === 'map'     && <MapScreen     onOpenCourt={() => {}} />}
      {tab === 'clubs'   && <ClubsScreen   onOpenClub={() => {}} />}
      {tab === 'profile' && <ProfileScreen onOpenSettings={() => {}} />}

      <TabBar
        active={tab}
        onChange={setTab}
        onCreate={() => setCreateOpen(true)}
      />

      <GameDetailsScreen
        open={gameOpen}
        onClose={closeGame}
        onJoined={() => {
          setTimeout(() => {
            closeGame();
            showToast("You're in! See you on court.");
          }, 700);
        }}
      />

      <CreateGameSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={() => showToast('Game posted! Players can now join.')}
      />
      <NotificationsSheet open={notifsOpen} onClose={() => setNotifsOpen(false)} />
      <FiltersSheet       open={filtersOpen} onClose={() => setFiltersOpen(false)} />

      <Toast {...toast} />
    </div>
  );
}

// Mount: handles tweaks state + iOS device frame
const accentToHex = { lime: '#c1f100', coral: '#ff7355', violet: '#a78bfa', sun: '#ffc94d' };

function Mount() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const isDark = tweaks.theme === 'dark';
  const accentHex = accentToHex[tweaks.accent] || '#c1f100';

  return (
    <div className="stage">
      <div style={{
        width: 402, height: 874, borderRadius: 48, overflow: 'hidden',
        position: 'relative', background: isDark ? '#000' : '#1a1a1d',
        boxShadow: '0 40px 90px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 100,
        }} />
        <App tweaks={tweaks} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 18, display: 'flex', justifyContent: 'center', alignItems: 'center',
          pointerEvents: 'none', zIndex: 200,
        }}>
          <div style={{ width: 134, height: 5, borderRadius: 100, background: 'rgba(0,0,0,0.7)' }} />
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Look">
          <TweakRadio
            label="Theme"
            value={tweaks.theme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark',  label: 'Dark' },
            ]}
            onChange={v => setTweak('theme', v)}
          />
          <TweakColor
            label="Accent"
            value={accentHex}
            options={['#c1f100', '#ff7355', '#a78bfa', '#ffc94d']}
            onChange={c => {
              const map = { '#c1f100': 'lime', '#ff7355': 'coral', '#a78bfa': 'violet', '#ffc94d': 'sun' };
              setTweak('accent', map[c] || 'lime');
            }}
          />
          <TweakToggle
            label="iOS status bar"
            value={tweaks.showStatusBar}
            onChange={v => setTweak('showStatusBar', v)}
          />
        </TweakSection>
        <TweakSection title="Demo">
          <TweakSelect
            label="Start on screen"
            value={tweaks.startScreen}
            options={[
              { value: 'home',    label: 'Today (home)' },
              { value: 'games',   label: 'Games' },
              { value: 'map',     label: 'Courts map' },
              { value: 'clubs',   label: 'Clubs' },
              { value: 'profile', label: 'Profile' },
            ]}
            onChange={v => setTweak('startScreen', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Mount />);
