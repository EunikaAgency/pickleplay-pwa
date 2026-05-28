import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useDemoState } from '../lib/demoState';

interface SearchScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
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
  const { state: demoState } = useDemoState();
  const hasQuery = query.length > 0;

  const matched = Object.values(RESULTS).reduce(
    (acc, list) => acc + list.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).length,
    0,
  );
  const noMatch = hasQuery && matched === 0;

  return (
    <div className="scroll" style={{ paddingBottom: 40, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="searchbar" style={{ margin: 0, flex: 1 }}>
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
        <button onClick={onBack} style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>
          Cancel
        </button>
      </div>

      {!hasQuery && (
        <div className="section" style={{ marginTop: 4 }}>
          <div className="section-head">
            <div className="hd-2">Recent</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECENT.map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  border: '0.5px solid var(--hairline)',
                  borderRadius: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Icon name="clock" size={16} style={{ color: 'var(--muted)' }} />
                <span style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasQuery && demoState === 'loading' && (
        <div style={{ padding: '0 20px' }}>
          <LoadingSkeleton variant="list-row" count={5} />
        </div>
      )}

      {hasQuery && demoState === 'error' && (
        <ErrorState
          title="Search unavailable"
          message="We couldn't reach the search index right now. Try again in a moment."
          onRetry={() => {}}
        />
      )}

      {hasQuery && (noMatch || demoState === 'empty') && (
        <EmptyState
          icon="search"
          title="No matches"
          description={`Nothing for "${query}". Try a different keyword.`}
        />
      )}

      {hasQuery && demoState !== 'loading' && demoState !== 'error' && demoState !== 'empty' && !noMatch && (
        <>
          {Object.entries(RESULTS).map(([category, items]) => {
            const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
            if (!filtered.length) return null;
            return (
              <div key={category} className="section">
                <div className="section-head">
                  <div className="hd-2">{category}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      className="organizer"
                      style={{ margin: 0, cursor: 'pointer' }}
                      onClick={() => {
                        if (item.type === 'court') onNavigate('court-details', { id: item.id });
                        else if (item.type === 'game') onNavigate('game-details', { id: item.id });
                        else if (item.type === 'club') onNavigate('club-details', { id: item.id });
                        else onNavigate('profile');
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background:
                            COLORS[item.type] === 'lime'
                              ? 'var(--lime)'
                              : COLORS[item.type] === 'coral'
                                ? 'var(--coral-soft)'
                                : 'var(--primary-soft)',
                          color:
                            COLORS[item.type] === 'lime'
                              ? 'var(--lime-ink)'
                              : COLORS[item.type] === 'coral'
                                ? 'var(--coral)'
                                : 'var(--primary-deep)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={ICONS[item.type]} size={18} />
                      </div>
                      <div className="meta">
                        <div className="role">{item.type}</div>
                        <div className="name">{item.name}</div>
                        <div className="t-sm" style={{ marginTop: 2 }}>{item.subtitle}</div>
                      </div>
                      <Icon name="chevron" size={16} style={{ color: 'var(--surface-3)' }} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
