import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useDemoState } from '../lib/demoState';

interface HomeScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const quickActions = [
  { id: 'create-game', label: 'Create Game', icon: 'sports_tennis', bg: 'bg-secondary-container text-on-secondary-container', iconBg: 'bg-white/40' },
  { id: 'find-games', label: 'Find Games', icon: 'search', bg: 'bg-primary-container text-on-primary-container', iconBg: 'bg-white/20' },
  { id: 'create-club', label: 'Create Club', icon: 'group_add', bg: 'bg-surface-container-high text-on-surface-variant', iconBg: 'bg-primary/10' },
  { id: 'find-courts', label: 'Find Courts', icon: 'map', bg: 'bg-surface-container-high text-on-surface-variant', iconBg: 'bg-primary/10' },
];

const demoGames = [
  {
    id: '1',
    title: 'Rookie Rally Round',
    date: 'Today, 5:30 PM',
    location: 'Central Hub • 1.2 mi',
    tag: 'Beginner',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQeWJn-7Kk1HCR-1MhQ2a4JKM3hst4f2Go13gZorz6vGn8cKEUeXpeE3gDY6v6tBlYjWFTQLGTbHGRdv10L15u0FFVQC95N5dBLo0AcLAElZTzhP_oITmJh1BoD87sRmvOYdCL5Tl_YkEJwm8DgDULjJE3S0rp_uvrsn2lH7dTUfXyr1XiZAGc5jwCgKaiuxzTtkadzvjIwWFZNW0THmQVTRB1OtQV929zAPnNs-HFJuZKa_6n7mIrR33C5eCZFcXbW-BtyYd2',
  },
  {
    id: '2',
    title: 'Competitive Singles',
    date: 'Sat, 10:00 AM',
    location: 'The Kitchen • 3.5 mi',
    tag: 'Advanced',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByMwXrWnGLq1pjWr5EGIag1wSi3z-p4GQoRUYJv2WhqBU2vdxY0RD1VzOA5nJ4uLEuUPzDdOD-Tdkl_VBMRYPg1bGQ-buq9ulGnLkArv60HQOgh6IZmShrX6KsY_FSazVPyhayDM4qTTJ10rsLpGA2kpA3PUrVSW-xpILKCC--RXHWMf0z_iHdX2OilDEMAzH69rUL53KTk5lGpJUN_xzr_-cU0NIuVDBQRdURMjAjfcJUelBEO0EP7TvyKgouywscNgA72xI-',
  },
  {
    id: '3',
    title: 'Social Mixer & Drinks',
    date: 'Sun, 4:00 PM',
    location: 'Sky Courts • 0.8 mi',
    tag: 'Mixed Level',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpfByT3q1YIF8lrRviwwRuL72MUO9nxSSrm_zzAA-UMCRtNWmMPJvsXtOm-gjNjoU9mULcsmHPtZJFw-bmPf4iT6HFrBvkN8jkcCapuLNdW-wyz2PUJ4c2K51n1bLqJcdgRc9R0c_gODV0tFxy-zXj0ondBthKQ6F42osmjp9z-atPbsTNGNniFjchTaJrVzK5ifLMQdJKlYD9B4QecTiuYPvCLgWiTPDwSI9RiW97N4sFK0l63Ojd3A6oCowgt_Ad7aWEJKsu',
  },
];

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const firstName = 'Alex';
  const cardShadow = { boxShadow: 'var(--shadow-card)' } as const;
  const { state: demoState } = useDemoState();

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none w-full min-w-0 overflow-y-auto flex-1">
        <main className="mx-auto w-full max-w-7xl px-5 pt-6 pb-28 space-y-8">

          {/* Greeting */}
          <section className="space-y-1">
            <h1 className="font-heading text-headline-xl text-on-surface">Ready to play, {firstName}?</h1>
            <p className="text-body-lg text-on-surface-variant">There are 12 open games near you today!</p>
          </section>

          {/* Quick Action Tiles */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  if (action.id === 'create-game') onNavigate('create-game');
                  else if (action.id === 'find-games') onNavigate('games');
                  else if (action.id === 'create-club') onNavigate('create-club');
                  else if (action.id === 'find-courts') onNavigate('nearby');
                }}
                className={`flex flex-col items-center justify-center rounded-[14px] p-6 transition-transform active:scale-95 ${action.bg}`}
                style={cardShadow}
              >
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${action.iconBg}`}>
                  <Icon name={action.icon} size={24} weight={600} />
                </div>
                <span className="font-heading text-body-lg font-bold">{action.label}</span>
              </button>
            ))}
          </section>

          {/* Greeting subhead with state-aware count */}
          {demoState === 'empty' ? (
            <section>
              <EmptyState
                icon="event_busy"
                title="No open games near you tonight"
                description="Be the first to post one — your neighbors are looking for partners."
                action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
              />
            </section>
          ) : demoState === 'error' ? (
            <section>
              <ErrorState
                title="Couldn't load games"
                message="We couldn't reach the courts feed right now. Pull down to retry or check back in a moment."
                onRetry={() => { /* no-op in prototype */ }}
              />
            </section>
          ) : demoState === 'loading' ? (
            <>
              <section>
                <LoadingSkeleton variant="block" count={1} />
              </section>
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <h2 className="font-heading text-headline-lg text-on-surface">Discover Games</h2>
                </div>
                <LoadingSkeleton variant="card" count={3} />
              </section>
            </>
          ) : (
          <>

          {/* Upcoming Activity Card */}
          <section>
            <div
              className="flex flex-col sm:flex-row sm:items-center overflow-hidden rounded-2xl bg-surface-container-lowest"
              style={cardShadow}
            >
              {/* Image */}
              <div className="relative w-full h-52 sm:h-64 sm:h-auto sm:w-72 shrink-0">
                <img
                  alt=""
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB74wZImg86YqASBE9mTA8ilIQtez1ABlecRRJ-hbZ_Mm2dN-gFFIH8flXECbNEFThD4jo9iJeyUIYqVODn1Y3CYEirLVSLw4XO2ZLxXnoeDNspU0-9Rtr3Le2uwzxR9AVThARneifahVE8WcplIL-u1EhxHgyHw7lNm6L7uzN_TZ7LyuQWkyXcUOowoIEodYrAU5mnPLacJP7sSYjdWW0-55C_qZ5LEcTSTk0ZaL2M8ZmIFyZRdlsKLj3tLtoWyzQDw5XJavcD"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/35" />

                {/* Badge */}
                <div className="absolute left-3 top-3 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                  Tomorrow
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col justify-center sm:justify-start p-5 sm:p-6 text-center sm:text-left">
                <h2 className="font-heading text-2xl sm:text-3xl mb-2">
                  Morning Doubles Mixer
                </h2>

                <p className="text-sm sm:text-base text-on-surface-variant mb-4">
                  Tomorrow at 9:00 AM &middot; Sunset Park Courts
                </p>

                {/* Avatars */}
                <div className="flex items-center justify-center sm:justify-start -space-x-2 mb-5">
                  <Avatar name="JD" size={32} className="border-2 border-white" />
                  <Avatar
                    name="SK"
                    size={32}
                    className="border-2 border-white bg-secondary-fixed text-on-secondary-fixed"
                  />
                  <Avatar
                    name="ML"
                    size={32}
                    className="border-2 border-white bg-tertiary-fixed text-on-tertiary-fixed"
                  />
                  <Avatar
                    name="+5"
                    size={32}
                    className="border-2 border-white bg-surface-container-highest text-on-surface-variant"
                  />
                </div>

                {/* Button */}
                <button
                  onClick={() => onNavigate('game-details', { id: '1' })}
                  className="w-full sm:w-auto md:w-fit rounded-full bg-secondary-container px-6 py-3 font-bold text-on-secondary-container transition-all hover:opacity-90 active:scale-95 self-center sm:self-start"
                >
                  View Details
                </button>
              </div>
            </div>
          </section>

          {/* Discover Games */}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-headline-lg text-on-surface">Discover Games</h2>
              <button className="font-bold text-primary hover:underline text-body-md" onClick={() => onNavigate('games')}>See All</button>
            </div>
            <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 pb-4">
              {demoGames.map((game) => (
                <div
                  key={game.id}
                  className="min-w-[280px] overflow-hidden rounded-[14px] bg-surface-container-lowest group cursor-pointer"
                  style={cardShadow}
                  onClick={() => onNavigate('game-details', { id: game.id })}
                >
                  <div className="relative h-40">
                    <img alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={game.img} />
                    {/* Black overlay */}
                    <div className="absolute inset-0 bg-black/40" />

                    <div className="absolute bottom-2 left-2 flex gap-2">
                      <span className="rounded-full bg-white/90 px-2 py-1 text-label-sm font-bold uppercase tracking-wider backdrop-blur">
                        {game.tag}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="font-heading text-body-lg font-semibold">{game.title}</h3>
                    <div className="flex items-center text-label-sm text-on-surface-variant">
                      <Icon name="schedule" size={16} className="mr-1" />
                      {game.date}
                    </div>
                    <div className="flex items-center text-label-sm text-on-surface-variant">
                      <Icon name="location_on" size={16} className="mr-1" />
                      {game.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Stats Banner */}
          <section className="flex flex-col items-center gap-6 rounded-[14px] bg-primary p-8 text-white md:flex-row md:justify-between">
            <div className="text-center md:text-left">
              <h3 className="font-heading text-headline-md">You're on a roll!</h3>
              <p className="opacity-80">You've played 4 games this week.</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="font-heading text-2xl text-secondary-fixed">12</div>
                <div className="text-label-sm font-bold uppercase tracking-widest opacity-60">Wins</div>
              </div>
              <div className="h-12 w-px bg-white/20" />
              <div className="text-center">
                <div className="font-heading text-2xl text-white">4.2</div>
                <div className="text-label-sm font-bold uppercase tracking-widest opacity-60">Rating</div>
              </div>
              <div className="h-12 w-px bg-white/20" />
              <div className="text-center">
                <div className="font-heading text-2xl text-white">158</div>
                <div className="text-label-sm font-bold uppercase tracking-widest opacity-60">Rank</div>
              </div>
            </div>
          </section>

          </>
          )}

        </main>
      </div>
    </div>
  );
}
