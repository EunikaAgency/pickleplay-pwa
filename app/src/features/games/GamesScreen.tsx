import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { GameRow } from '../../shared/components/ui/GameRow';
import { Segmented } from '../../shared/components/ui/Segmented';
import { GameFilterSheet } from './GameFilterSheet';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';

interface GamesScreenProps {
  onNavigate: Navigate;
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

  const emptyState = (
    <EmptyState
      icon="paddle"
      title={view === 'mine' ? "You haven't joined any games yet" : 'No games found'}
      description={view === 'mine' ? 'Browse upcoming games near you to get on the courts.' : 'Try a different date or remove some filters.'}
      action={view === 'mine' ? { label: 'Browse games', onPress: () => setView('browse') } : undefined}
    />
  );

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
          className="relative w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)]"
        >
          <Icon name="sliders" size={18} />
          <span className="absolute top-1 right-1 bg-[var(--coral)] text-white text-[9px] font-extrabold min-w-[14px] h-[14px] rounded-[7px] flex items-center justify-center px-1 border-2 border-[var(--surface)]">
            2
          </span>
        </button>
      </div>

      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search games, courts, players…" />
        <button className="text-[var(--primary)]" aria-label="Voice search">
          <Icon name="mic" size={16} />
        </button>
      </div>

      <div className="px-4 pt-3.5">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'browse', label: 'Browse' },
            { value: 'mine', label: 'My Games' },
          ]}
        />
      </div>

      <div className="section mt-4!">
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

      <div className="section mt-3.5!">
        <div className="scroll-x flex gap-2 pb-1">
          {QUICK_CHIPS.map((c) => (
            <button key={c} className={`chip ${activeChips.has(c) ? 'lime' : ''}`} onClick={() => toggle(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="section mt-3!">
        <DemoBranch
          loading={<LoadingSkeleton variant="card" count={4} />}
          error={
            <ErrorState
              title="Couldn't load games"
              message="We couldn't reach the games feed. Pull down to retry."
              onRetry={() => {}}
            />
          }
          empty={emptyState}
        >
          {games.length === 0 ? emptyState : (
            <div className="games-grid flex flex-col gap-2.5">
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
        </DemoBranch>
      </div>

      <GameFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
