import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { GameRow } from '../components/ui/GameRow';
import { CourtIllustration } from '../components/ui/CourtIllustration';
import { useDemoState } from '../lib/demoState';

interface HomeScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const TONIGHT = [
  {
    id: 'g1',
    title: 'Friday Night Dinks',
    time: '6:30 PM',
    court: 'Riverside · 1.2 mi',
    tag: '3.0–3.5',
    img: 'linear-gradient(135deg, #0040e0 0%, #6c83ff 100%)',
    tagBg: 'rgba(255,255,255,0.92)',
    tagColor: '#0040e0',
  },
  {
    id: 'g2',
    title: 'Beginner Open Play',
    time: '7:00 PM',
    court: 'Central Hub · 0.8 mi',
    tag: 'Beginner',
    img: 'linear-gradient(135deg, #c1f100 0%, #a5d100 100%)',
    tagBg: '#001356',
    tagColor: '#fff',
  },
  {
    id: 'g3',
    title: 'Round Robin Mixer',
    time: '8:00 PM',
    court: 'Sky Courts · 2.4 mi',
    tag: 'Social',
    img: 'linear-gradient(135deg, #cf3000 0%, #ff7355 100%)',
    tagBg: 'rgba(255,255,255,0.92)',
    tagColor: '#cf3000',
  },
  {
    id: 'g4',
    title: 'Competitive 4.0+',
    time: '9:00 PM',
    court: 'The Kitchen · 3.5 mi',
    tag: '4.0+',
    img: 'linear-gradient(135deg, #1a1d24 0%, #404756 100%)',
    tagBg: '#c1f100',
    tagColor: '#001356',
  },
];

const CALENDAR = (() => {
  const today = new Date();
  const wdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      wd: i === 0 ? 'TODAY' : wdays[d.getDay()],
      dn: d.getDate(),
      has: [0, 1, 3, 6, 8, 10].includes(i),
      key: i,
    };
  });
})();

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { state: demoState } = useDemoState();

  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="greet-name">Hey Riley 👋</div>
          <div className="greet-sub">12 open games near you tonight</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => onNavigate('notifications')}
            aria-label="Notifications"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
              border: '0.5px solid var(--hairline)',
              position: 'relative',
            }}
          >
            <Icon name="bell" size={18} />
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 4,
                background: 'var(--coral)',
                border: '2px solid var(--surface)',
              }}
            />
          </button>
          <button onClick={() => onNavigate('profile')} aria-label="Open profile" style={{ position: 'relative' }}>
            <Avatar name="Riley Pickler" size={40} />
          </button>
        </div>
      </div>

      {demoState === 'loading' && (
        <div className="section" style={{ marginTop: 16 }}>
          <LoadingSkeleton variant="block" count={1} />
          <div style={{ marginTop: 12 }}>
            <LoadingSkeleton variant="card" count={3} />
          </div>
        </div>
      )}

      {demoState === 'error' && (
        <ErrorState
          title="Couldn't load games"
          message="We couldn't reach the courts feed. Pull down to retry or check back in a moment."
          onRetry={() => {}}
        />
      )}

      {demoState === 'empty' && (
        <EmptyState
          icon="paddle"
          title="No open games tonight"
          description="Be the first to post one — your neighbors are looking for partners."
          action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
        />
      )}

      {(demoState === 'normal' || demoState === 'offline') && (
        <>
          {/* Now-card (next game) */}
          <div className="section" style={{ marginTop: 16, padding: 0 }}>
            <button className="now-card" onClick={() => onNavigate('game-details', { id: 'g1' })}>
              <div className="deco" />
              <div
                style={{
                  position: 'absolute',
                  right: -10,
                  bottom: -20,
                  transform: 'rotate(-8deg)',
                  opacity: 0.95,
                  pointerEvents: 'none',
                }}
              >
                <CourtIllustration width={170} />
              </div>
              <div className="top-row" style={{ position: 'relative', zIndex: 2 }}>
                <span className="pill">NEXT GAME · IN 4H</span>
                <span className="live-dot" />
              </div>
              <div style={{ position: 'relative', zIndex: 2, maxWidth: '70%' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 26,
                    fontWeight: 600,
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Saturday<br />
                  Morning Mix-In
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    opacity: 0.9,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="clock" size={14} /> 9:00 AM
                  <span style={{ opacity: 0.5 }}>·</span>
                  <Icon name="location" size={14} /> Riverside
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex' }}>
                    {(['Coach Mike', 'Sarah K', 'Alex T'] as const).map((n, i) => (
                      <div key={n} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                        <Avatar
                          name={n}
                          variant={(['blue', 'lime', 'coral'] as const)[i]}
                          size={28}
                          style={{ border: '2px solid white' }}
                        />
                      </div>
                    ))}
                    <div
                      style={{
                        marginLeft: -10,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.25)',
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'white',
                      }}
                    >
                      +5
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>8/12 · 4 spots open</div>
                </div>
              </div>
            </button>
          </div>

          {/* Activity ticker */}
          <div className="activity" style={{ marginTop: 14 }}>
            <span className="live" />
            <div className="text">
              <strong>5 players</strong> just checked in at <strong>Riverside Courts</strong>
            </div>
            <Icon name="chevron" size={16} style={{ color: 'var(--lime-ink)', opacity: 0.6 }} />
          </div>

          {/* Calendar strip */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Your week</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  Plan your play
                </div>
              </div>
              <button className="more" onClick={() => onNavigate('games')}>
                See schedule →
              </button>
            </div>
            <div className="cal-strip">
              {CALENDAR.map((d, i) => (
                <button key={d.key} className={`day ${i === 0 ? 'active' : ''} ${d.has ? 'has' : ''}`}>
                  <span className="wd">{d.wd}</span>
                  <span className="dn">{d.dn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tonight rail */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Tonight</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  Hot near you
                </div>
              </div>
              <button className="more" onClick={() => onNavigate('games')}>
                All
              </button>
            </div>
            <div className="rail">
              {TONIGHT.map((g) => (
                <button
                  key={g.id}
                  className="tonight-card"
                  onClick={() => onNavigate('game-details', { id: g.id })}
                >
                  <div className="img" style={{ background: g.img }}>
                    <div className="overlay" />
                    <span className="badge" style={{ background: g.tagBg, color: g.tagColor }}>
                      {g.tag}
                    </span>
                    <span className="time">{g.time}</span>
                  </div>
                  <div className="body">
                    <div className="title">{g.title}</div>
                    <div className="meta">
                      <Icon name="location" size={11} />
                      {g.court}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* From your clubs */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">From your clubs</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  Don't miss out
                </div>
              </div>
              <button className="more" onClick={() => onNavigate('clubs')}>
                Clubs
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GameRow
                day="SAT"
                num="14"
                thumb="lime"
                title="Neon Smashers · Weekly Doubles"
                time="6:30 PM"
                loc="Central Hub · 0.8 mi"
                onTap={() => onNavigate('game-details', { id: 'g5' })}
              />
              <GameRow
                day="SUN"
                num="15"
                thumb="blue"
                title="Downtown Volleys · Social Mixer"
                time="4:00 PM"
                loc="Sky Courts · 2.4 mi"
                onTap={() => onNavigate('game-details', { id: 'g6' })}
              />
            </div>
          </div>

          {/* Streak card */}
          <div className="section">
            <div
              style={{
                background: 'var(--ink)',
                color: 'white',
                borderRadius: 22,
                padding: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }}>
                <Icon name="trophy" size={140} />
              </div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'var(--lime)',
                  color: 'var(--lime-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="fire" size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: 0.6,
                  }}
                >
                  This week
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: 19,
                    marginTop: 2,
                  }}
                >
                  You're on a 4-game streak 🔥
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Win rate up 8% vs last week</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
