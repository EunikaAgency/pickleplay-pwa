import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { GameRow } from '../components/ui/GameRow';
import { Segmented } from '../components/ui/Segmented';
import { GameFilterSheet } from '../components/filters/GameFilterSheet';
import { useDemoState } from '../lib/demoState';

interface GamesScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

type GamesView = 'browse' | 'mine';

const CALENDAR = (() => {
  const today = new Date();
  const wdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      wd: i === 0 ? 'TODAY' : i === 1 ? 'TOM' : wdays[d.getDay()],
      dn: d.getDate(),
      has: [0, 1, 3, 6].includes(i),
      key: i,
    };
  });
})();

const QUICK_CHIPS = ['Tonight', 'Beginner', '3.0–3.5', 'Within 5 mi', 'Doubles'];

const BROWSE_GAMES = [
  { day: 'TODAY', num: '26', thumb: 'lime',  title: 'Rookie Rally Round',    time: '5:30 PM',  loc: 'Central Hub · 1.2 mi' },
  { day: 'TODAY', num: '26', thumb: 'coral', title: 'Friday Night Dinks',    time: '6:30 PM',  loc: 'Riverside · 1.2 mi' },
  { day: 'TODAY', num: '26', thumb: 'blue',  title: 'Beginner Open Play',    time: '7:00 PM',  loc: 'Central Hub · 0.8 mi' },
  { day: 'TOM',   num: '27', thumb: 'lime',  title: 'Saturday Morning Mix',  time: '9:00 AM',  loc: 'Riverside · 1.2 mi' },
  { day: 'SAT',   num: '28', thumb: 'coral', title: 'Competitive Singles',   time: '10:00 AM', loc: 'The Kitchen · 3.5 mi' },
  { day: 'SUN',   num: '29', thumb: 'blue',  title: 'Social Mixer & Drinks', time: '4:00 PM',  loc: 'Sky Courts · 0.8 mi' },
] as const;

const MINE_GAMES = [
  { day: 'SAT', num: '14', thumb: 'lime', title: 'Saturday Morning Mix-In', time: '9:00 AM', loc: 'Riverside · 1.2 mi', joined: true },
  { day: 'TUE', num: '17', thumb: 'blue', title: 'Weekly Doubles League',   time: '6:30 PM', loc: 'Central Hub · 0.8 mi', joined: true },
] as const;

export function GamesScreen({ onNavigate }: GamesScreenProps) {
  const [view, setView] = useState<GamesView>('browse');
  const [activeDay, setActiveDay] = useState(0);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(['Tonight']));
  const [filterOpen, setFilterOpen] = useState(false);
  const { state: demoState } = useDemoState();

  const toggle = (c: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const games: ReadonlyArray<typeof BROWSE_GAMES[number] | typeof MINE_GAMES[number]> =
    view === 'mine' ? MINE_GAMES : BROWSE_GAMES;
  const showEmpty = demoState === 'empty' || games.length === 0;

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div>
          <div className="greet-name">Games</div>
          <div className="greet-sub">
            {games.length} games {view === 'mine' ? 'you joined' : 'this week'}
          </div>
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
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
          <Icon name="sliders" size={18} />
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'var(--coral)',
              color: 'white',
              fontSize: 9,
              fontWeight: 800,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--surface)',
            }}
          >
            2
          </span>
        </button>
      </div>

      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search games, courts, players…" />
        <button style={{ color: 'var(--primary)' }} aria-label="Voice search">
          <Icon name="mic" size={16} />
        </button>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'browse', label: 'Browse' },
            { value: 'mine', label: 'My Games' },
          ]}
        />
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div className="cal-strip">
          {CALENDAR.map((d, i) => (
            <button
              key={d.key}
              className={`day ${activeDay === i ? 'active' : ''} ${d.has ? 'has' : ''}`}
              onClick={() => setActiveDay(i)}
            >
              <span className="wd">{d.wd}</span>
              <span className="dn">{d.dn}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section" style={{ marginTop: 14 }}>
        <div className="scroll-x" style={{ display: 'flex', gap: 8, padding: '0 0 4px' }}>
          {QUICK_CHIPS.map((c) => (
            <button key={c} className={`chip ${activeChips.has(c) ? 'lime' : ''}`} onClick={() => toggle(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="section" style={{ marginTop: 12 }}>
        {demoState === 'loading' ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : demoState === 'error' ? (
          <ErrorState
            title="Couldn't load games"
            message="We couldn't reach the games feed. Pull down to retry."
            onRetry={() => {}}
          />
        ) : showEmpty ? (
          <EmptyState
            icon="paddle"
            title={view === 'mine' ? "You haven't joined any games yet" : 'No games found'}
            description={view === 'mine' ? 'Browse upcoming games near you to get on the courts.' : 'Try a different date or remove some filters.'}
            action={view === 'mine' ? { label: 'Browse games', onPress: () => setView('browse') } : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {games.map((g, i) => (
              <GameRow
                key={i}
                day={g.day}
                num={g.num}
                thumb={g.thumb}
                title={g.title}
                time={g.time}
                loc={g.loc}
                joined={'joined' in g ? g.joined : false}
                onTap={() => onNavigate('game-details', { id: `g${i + 1}` })}
              />
            ))}
          </div>
        )}
      </div>

      <GameFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
