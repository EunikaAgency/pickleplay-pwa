import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { GameRow } from '../../shared/components/ui/GameRow';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { firstNameOf } from '../../shared/lib/permissions';
import { useAuthStore } from '../../shared/lib/authStore';

interface HomeScreenProps {
  onNavigate: Navigate;
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
  const currentUser = useAuthStore((s) => s.user);
  const firstName = firstNameOf(currentUser);
  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="greet-name">{firstName ? `Hey ${firstName} 👋` : 'Hey there 👋'}</div>
          <div className="greet-sub">12 open games near you tonight</div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => onNavigate('notifications')}
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)]"
          >
            <Icon name="bell" size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--coral)] border-2 border-[var(--surface)]" />
          </button>
          <button onClick={() => onNavigate('profile')} aria-label="Open profile" className="relative">
            <Avatar src={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'Guest'} size={40} />
          </button>
        </div>
      </div>

      <DemoBranch
        loading={
          <div className="section mt-4!">
            <LoadingSkeleton variant="block" count={1} />
            <div className="mt-3">
              <LoadingSkeleton variant="card" count={3} />
            </div>
          </div>
        }
        error={
          <ErrorState
            title="Couldn't load games"
            message="We couldn't reach the courts feed. Pull down to retry or check back in a moment."
            onRetry={() => {}}
          />
        }
        empty={
          <EmptyState
            icon="paddle"
            title="No open games tonight"
            description="Be the first to post one — your neighbors are looking for partners."
            action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
          />
        }
      >
        <>
          {/* Now-card (next game) */}
          <div className="section mt-4! p-0!">
            <button className="now-card" onClick={() => onNavigate('game-details', { id: 'g1' })}>
              <div className="deco" />
              <div className="absolute -right-2.5 -bottom-5 -rotate-[8deg] opacity-95 pointer-events-none">
                <CourtIllustration width={170} />
              </div>
              <div className="top-row relative z-[2]">
                <span className="pill">NEXT GAME · IN 4H</span>
                <span className="live-dot" />
              </div>
              <div className="relative z-[2] max-w-[70%]">
                <div className="font-heading text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">
                  Saturday<br />
                  Morning Mix-In
                </div>
                <div className="mt-3 text-[13px] opacity-90 flex items-center gap-1.5">
                  <Icon name="clock" size={14} /> 9:00 AM
                  <span className="opacity-50">·</span>
                  <Icon name="location" size={14} /> Riverside
                </div>
                <div className="mt-3.5 flex items-center gap-2.5">
                  <div className="flex">
                    {(['Coach Mike', 'Sarah K', 'Alex T'] as const).map((n, i) => (
                      <div key={n} className={i === 0 ? '' : '-ml-2.5'}>
                        <Avatar
                          name={n}
                          variant={(['blue', 'lime', 'coral'] as const)[i]}
                          size={28}
                          className="border-2 border-white"
                        />
                      </div>
                    ))}
                    <div className="-ml-2.5 w-7 h-7 rounded-[14px] bg-white/25 border-2 border-white flex items-center justify-center text-[11px] font-bold text-white">
                      +5
                    </div>
                  </div>
                  <div className="text-[12px] font-bold opacity-90">8/12 · 4 spots open</div>
                </div>
              </div>
            </button>
          </div>

          {/* Activity ticker */}
          <div className="activity mt-3.5!">
            <span className="live" />
            <div className="text">
              <strong>5 players</strong> just checked in at <strong>Riverside Courts</strong>
            </div>
            <Icon name="chevron" size={16} className="text-[var(--lime-ink)] opacity-60" />
          </div>

          {/* Calendar strip */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Your week</div>
                <div className="hd-2 mt-1">Plan your play</div>
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
                <div className="hd-2 mt-1">Hot near you</div>
              </div>
              <button className="more" onClick={() => onNavigate('games')}>
                All
              </button>
            </div>
            <div className="rail rail-desktop-grid">
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

          {/* From-your-clubs + Streak share a row on desktop. */}
          <div className="home-bottom-grid">
          {/* From your clubs */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">From your clubs</div>
                <div className="hd-2 mt-1">Don't miss out</div>
              </div>
              <button className="more" onClick={() => onNavigate('clubs')}>
                Clubs
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
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
            <div className="relative overflow-hidden rounded-[22px] p-[18px] flex items-center gap-4 bg-[var(--ink)] text-white">
              <div className="absolute -right-5 -bottom-5 opacity-10">
                <Icon name="trophy" size={140} />
              </div>
              <div className="w-14 h-14 rounded-[18px] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center shrink-0">
                <Icon name="fire" size={28} />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-60">This week</div>
                <div className="font-heading font-semibold text-[19px] mt-0.5">
                  You're on a 4-game streak 🔥
                </div>
                <div className="text-[12px] opacity-70 mt-1">Win rate up 8% vs last week</div>
              </div>
            </div>
          </div>
          </div>
        </>
      </DemoBranch>
    </div>
  );
}
