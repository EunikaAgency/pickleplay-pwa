import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';

interface SearchScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const RECENT = ['Riverside Courts', 'Beginner games', 'Saturday mix-in', 'Downtown Volleys'];

const RESULTS = {
  Courts:  [
    { id: 'c1', name: 'Austin Smash Center', subtitle: '0.8 mi · 6 courts',  type: 'court' as const },
    { id: 'c2', name: 'Zilker Park Courts',  subtitle: '2.4 mi · 4 courts',  type: 'court' as const },
    { id: 'c3', name: 'Riverside Courts',    subtitle: '1.2 mi · 8 courts',  type: 'court' as const },
  ],
  Games:   [
    { id: 'g1', name: 'Saturday Morning Mix-In', subtitle: 'Sat 9:00 AM · 8/12', type: 'game' as const },
    { id: 'g2', name: 'Rookie Rally Round',      subtitle: 'Today 5:30 PM · 4/8', type: 'game' as const },
  ],
  Clubs:   [
    { id: 'cl1', name: 'Neon Smashers',  subtitle: 'Competitive · 128 members', type: 'club' as const },
    { id: 'cl2', name: 'Paddle Pirates', subtitle: '1.2 mi · Morning Play',     type: 'club' as const },
  ],
  Players: [
    { id: 'p1', name: 'Coach Mike', subtitle: '4.5 skill · Organizer', type: 'player' as const },
    { id: 'p2', name: 'Sarah K.',   subtitle: '3.0 skill · Downtown',  type: 'player' as const },
  ],
};

const ICONS: Record<string, string> = {
  court: 'location',
  game: 'paddle',
  club: 'groups',
  player: 'user',
};

const COLORS: Record<string, string> = {
  court: 'lime',
  game: 'blue',
  club: 'coral',
  player: 'lime',
};

export function SearchScreen({ onNavigate, onBack }: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const hasQuery = query.length > 0;

  const matched = Object.values(RESULTS).reduce(
    (acc, list) => acc + list.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).length,
    0,
  );
  const noMatch = hasQuery && matched === 0;

  const emptyState = (
    <EmptyState
      icon="search"
      title="No matches"
      description={`Nothing for "${query}". Try a different keyword.`}
    />
  );

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <div className="px-4 pt-1 pb-3.5 flex items-center gap-2.5">
        <div className="searchbar m-0! flex-1">
          <Icon name="search" size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courts, games, clubs, players…"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <button onClick={onBack} className="text-[var(--primary)] font-bold text-[13px]">
          Cancel
        </button>
      </div>

      {!hasQuery && (
        <div className="section mt-1!">
          <div className="section-head">
            <div className="hd-2">Recent</div>
          </div>
          <div className="flex flex-col gap-2">
            {RECENT.map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-left cursor-pointer"
              >
                <Icon name="clock" size={16} className="text-[var(--muted)]" />
                <span className="text-[var(--ink)] text-[14px] font-semibold">{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasQuery && (
        <DemoBranch
          loading={
            <div className="px-5">
              <LoadingSkeleton variant="list-row" count={5} />
            </div>
          }
          error={
            <ErrorState
              title="Search unavailable"
              message="We couldn't reach the search index right now. Try again in a moment."
              onRetry={() => {}}
            />
          }
          empty={emptyState}
        >
          {noMatch ? emptyState : Object.entries(RESULTS).map(([category, items]) => {
            const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
            if (!filtered.length) return null;
            return (
              <div key={category} className="section">
                <div className="section-head">
                  <div className="hd-2">{category}</div>
                </div>
                <div className="flex flex-col gap-2">
                  {filtered.map((item) => {
                    const color = COLORS[item.type];
                    const tone =
                      color === 'lime'
                        ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                        : color === 'coral'
                          ? 'bg-[var(--coral-soft)] text-[var(--coral)]'
                          : 'bg-[var(--primary-soft)] text-[var(--primary-deep)]';
                    return (
                      <button
                        key={item.id}
                        className="organizer m-0! cursor-pointer"
                        onClick={() => {
                          if (item.type === 'court') onNavigate('court-details', { id: item.id });
                          else if (item.type === 'game') onNavigate('game-details', { id: item.id });
                          else if (item.type === 'club') onNavigate('club-details', { id: item.id });
                          else onNavigate('profile');
                        }}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                          <Icon name={ICONS[item.type]} size={18} />
                        </div>
                        <div className="meta">
                          <div className="role">{item.type}</div>
                          <div className="name">{item.name}</div>
                          <div className="t-sm mt-0.5">{item.subtitle}</div>
                        </div>
                        <Icon name="chevron" size={16} className="text-[var(--surface-3)]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </DemoBranch>
      )}
    </div>
  );
}
