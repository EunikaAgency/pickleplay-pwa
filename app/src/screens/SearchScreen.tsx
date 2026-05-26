import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface SearchScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
}

const recentSearches = ['Riverside Courts', 'Beginner games', 'Saturday mix-in', 'Downtown Volleys'];

const allResults = {
  courts: [
    { id: 'c1', name: 'Austin Smash Center', subtitle: '0.8 miles • 6 courts', type: 'court' as const },
    { id: 'c2', name: 'Zilker Park Courts', subtitle: '2.4 miles • 4 courts', type: 'court' as const },
    { id: 'c3', name: 'Riverside Courts', subtitle: '1.2 miles • 8 courts', type: 'court' as const },
  ],
  games: [
    { id: 'g1', name: 'Saturday Morning Mix-In', subtitle: 'Sat, 9:00 AM • 8/12 players', type: 'game' as const },
    { id: 'g2', name: 'Rookie Rally Round', subtitle: 'Today, 5:30 PM • 4/8 players', type: 'game' as const },
  ],
  clubs: [
    { id: 'cl1', name: 'Neon Smashers', subtitle: 'Competitive • 128 members', type: 'club' as const },
    { id: 'cl2', name: 'Paddle Pirates', subtitle: '1.2 miles • Morning Play', type: 'club' as const },
  ],
  players: [
    { id: 'p1', name: 'Coach Mike', subtitle: '4.5 skill • Organizer', type: 'player' as const },
    { id: 'p2', name: 'Sarah K.', subtitle: '3.0 skill • Downtown', type: 'player' as const },
  ],
};

const typeIcons: Record<string, string> = {
  court: 'location_on',
  game: 'sports_tennis',
  club: 'group',
  player: 'person',
};

const typeColors: Record<string, string> = {
  court: 'bg-primary/10 text-primary',
  game: 'bg-secondary-container text-on-secondary-container',
  club: 'bg-tertiary-container text-on-tertiary-container',
  player: 'bg-surface-container-high text-on-surface-variant',
};

export function SearchScreen({ onNavigate, onBack }: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const hasResults = query.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Search Bar */}
      <div className="sticky top-0 z-40 bg-background px-5 pt-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courts, games, clubs, players..."
              autoFocus
              className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
              style={cardShadow}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
          <button onClick={onBack} className="text-primary font-bold text-body-md hover:underline shrink-0">Cancel</button>
        </div>
      </div>

      <div className="scrollbar-none overflow-y-auto flex-1 px-5">
        {!hasResults ? (
          /* Recent Searches */
          <div className="space-y-4 pt-2">
            <h2 className="font-heading text-headline-md text-on-surface">Recent</h2>
            <div className="space-y-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="flex items-center gap-3 w-full p-3 hover:bg-surface-container-low rounded-[12px] transition-colors active:scale-[0.98]"
                >
                  <Icon name="history" size={20} className="text-outline" />
                  <span className="text-body-md text-on-surface">{term}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Results */
          <div className="space-y-6">
            {Object.entries(allResults).map(([category, items]) => {
              const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
              if (filtered.length === 0) return null;
              return (
                <section key={category}>
                  <h2 className="font-heading text-headline-md text-on-surface mb-2 capitalize">{category}</h2>
                  <div className="space-y-2">
                    {filtered.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 bg-surface-container-lowest rounded-[12px] p-4 cursor-pointer active:scale-[0.98] transition-transform"
                        style={cardShadow}
                        onClick={() => {
                          if (item.type === 'court') onNavigate('court-details', { id: item.id });
                          else if (item.type === 'game') onNavigate('game-details', { id: item.id });
                          else if (item.type === 'club') onNavigate('club-details', { id: item.id });
                          else if (item.type === 'player') onNavigate('profile');
                        }}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeColors[item.type]}`}>
                          <Icon name={typeIcons[item.type]} size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-heading text-body-lg font-semibold">{item.name}</p>
                          <p className="text-body-md text-on-surface-variant">{item.subtitle}</p>
                        </div>
                        <Icon name="chevron_right" size={20} className="text-outline" />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
