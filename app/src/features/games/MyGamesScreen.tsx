import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { listGames, type ApiGame } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { dayParts, timeLine, gameTitle, statusMeta, type GameTone } from './gameDisplay';
import { GameManageActions } from './GameManageActions';
import type { Navigate } from '../../shared/lib/navigation';

interface MyGamesScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const toneChip: Record<GameTone, string> = {
  lime: 'bg-[var(--lime)] text-[var(--ink)]',
  blue: 'bg-[var(--primary)] text-white',
  coral: 'bg-[var(--coral)] text-white',
  muted: 'bg-[var(--surface-3)] text-[var(--muted)]',
};

export function MyGamesScreen({ onNavigate, onBack }: MyGamesScreenProps) {
  const me = useAuthStore((s) => s.user);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listGames({ mine: true });
      // `mine` returns created + joined; keep only the ones this user created.
      const mine = all.filter((g) => g.creatorId === me?.id || g.creator?.id === me?.id);
      setGames(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your games.');
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const openGame = (g: ApiGame) => onNavigate('game-details', { id: g.id });

  const dropGame = (id: string) => setGames((prev) => prev.filter((g) => g.id !== id));

  return (
    <div className="scroll pb-[40px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} backIcon="back" eyebrow="Your games" title="My games" />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState title="Couldn't load your games" message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : games.length === 0 ? (
          <EmptyState
            icon="paddle"
            title="No games yet"
            description="Games you create show up here, where you can edit or delete them."
            action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {games.map((g) => {
              const meta = statusMeta(g.status);
              const when = [dayParts(g).day === 'TODAY' ? 'Today' : dayParts(g).day, timeLine(g)].filter(Boolean).join(' · ');
              const players = `${g.participantCount ?? 0}/${g.capacity ?? 0} players`;
              return (
                <div key={g.id} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
                  <button type="button" onClick={() => openGame(g)} className="w-full text-left p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`chip ${toneChip[meta.tone]}`}>{meta.label}</span>
                      </div>
                      <div className="font-heading font-semibold text-[15px] text-[var(--ink)] truncate">{gameTitle(g)}</div>
                      <div className="text-[12px] text-[var(--muted)] font-semibold mt-0.5">{[when, players].filter(Boolean).join(' · ')}</div>
                    </div>
                    <Icon name="chevron" size={16} className="text-[var(--muted)] shrink-0 mt-1" />
                  </button>
                  <GameManageActions
                    game={g}
                    onNavigate={onNavigate}
                    onDeleted={dropGame}
                    className="px-4 py-3 border-t-[0.5px] border-[var(--hairline)]"
                  />
                </div>
              );
            })}

            <Button fullWidth variant="outline" onClick={() => onNavigate('create-game')}>
              <Icon name="plus" size={16} /> Create a game
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
