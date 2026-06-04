import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { GameRow } from '../../shared/components/ui/GameRow';
import { Segmented } from '../../shared/components/ui/Segmented';
import { GameFilterSheet } from './GameFilterSheet';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { listGames, type ApiGame } from '../../shared/lib/api';
import { dayParts, gameThumb, gameTitle, timeLine, gameLocation } from './gameDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface GamesScreenProps {
  onNavigate: Navigate;
}

type GamesView = 'browse' | 'mine';

/** Local YYYY-MM-DD (matches how the API computes a game's `date`). */
function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CALENDAR = (() => {
  const today = new Date();
  const wdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      wd: i === 0 ? 'TODAY' : i === 1 ? 'TOM' : wdays[d.getDay()],
      dn: d.getDate(),
      iso: localYMD(d),
      key: i,
    };
  });
})();

const QUICK_CHIPS = ['Tonight', 'Beginner', '3.0–3.5', 'Within 5 mi', 'Doubles'];

export function GamesScreen({ onNavigate }: GamesScreenProps) {
  const [view, setView] = useState<GamesView>('browse');
  // null = all upcoming days; a calendar index narrows browse to that date.
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(['Tonight']));
  const [filterOpen, setFilterOpen] = useState(false);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const dateFilter = view === 'browse' && activeDay !== null ? CALENDAR[activeDay].iso : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const params = view === 'mine' ? { mine: true } : { status: 'published', date: dateFilter };
    listGames(params)
      .then((rows) => { if (alive) setGames(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load games.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [view, dateFilter, reloadKey]);

  const refetch = () => setReloadKey((k) => k + 1);

  const toggle = (c: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const tapDay = (i: number) => setActiveDay((prev) => (prev === i ? null : i));

  const emptyState = (
    <EmptyState
      icon="paddle"
      title={view === 'mine' ? "You haven't joined any games yet" : 'No games found'}
      description={view === 'mine' ? 'Browse upcoming games near you to get on the courts.' : 'Try a different date or check back soon.'}
      action={view === 'mine' ? { label: 'Browse games', onPress: () => setView('browse') } : undefined}
    />
  );

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div>
          <div className="greet-name">Games</div>
          <div className="greet-sub">
            {games.length} {games.length === 1 ? 'game' : 'games'} {view === 'mine' ? "you're in" : 'available'}
          </div>
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          className="relative w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)]"
        >
          <Icon name="sliders" size={18} />
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

      {view === 'browse' && (
        <div className="section mt-4!">
          <div className="cal-strip">
            {CALENDAR.map((d, i) => (
              <button
                key={d.key}
                className={`day ${activeDay === i ? 'active' : ''}`}
                onClick={() => tapDay(i)}
              >
                <span className="wd">{d.wd}</span>
                <span className="dn">{d.dn}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
              onRetry={refetch}
            />
          }
          empty={emptyState}
        >
          {loading ? (
            <LoadingSkeleton variant="card" count={4} />
          ) : error ? (
            <ErrorState title="Couldn't load games" message={error} onRetry={refetch} />
          ) : games.length === 0 ? (
            emptyState
          ) : (
            <div className="games-grid flex flex-col gap-2.5">
              {games.map((g) => {
                const { day, num } = dayParts(g);
                return (
                  <GameRow
                    key={g.id}
                    day={day}
                    num={num}
                    thumb={gameThumb(g)}
                    title={gameTitle(g)}
                    time={timeLine(g)}
                    loc={gameLocation(g)}
                    joined={view === 'mine'}
                    showRsvp={false}
                    onTap={() => onNavigate('game-details', { id: g.id })}
                  />
                );
              })}
            </div>
          )}
        </DemoBranch>
      </div>

      <GameFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
