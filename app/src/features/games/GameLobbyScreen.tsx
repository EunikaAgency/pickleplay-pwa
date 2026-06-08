import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import {
  getGame, joinGame, openVote, voteGame, resolveVote, leaveGame,
  ApiError, type ApiGame, type ApiGameVenue,
} from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import {
  gameTitle, gameTypeLabel, timeLine, dayParts,
  statusMeta, votesFor, majorityThreshold, voteTimeLeft,
} from './gameDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface GameLobbyScreenProps {
  gameId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const AVATAR_VARIANTS = ['lime', 'blue', 'coral'] as const;

// Lobby states still in flux are polled so every member sees joins + votes land.
const LIVE_STATUSES = new Set(['published', 'full', 'voting', 'vote_won', 'paying']);

const toneClass: Record<string, string> = {
  lime: 'bg-[var(--lime)] text-[var(--ink)]',
  blue: 'bg-[var(--primary)] text-white',
  coral: 'bg-[var(--coral)] text-white',
  muted: 'bg-[var(--surface-3)] text-[var(--muted)]',
};

function priceLine(v: ApiGameVenue): string {
  if (v.priceFromLabel) return v.priceFromLabel;
  if (v.priceFrom != null) return `From ₱${v.priceFrom}`;
  return 'Price TBD';
}

export function GameLobbyScreen({ gameId, onNavigate, onBack }: GameLobbyScreenProps) {
  const me = useAuthStore((s) => s.user);
  const [game, setGame] = useState<ApiGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [busy, setBusy] = useState(false);            // an action (vote/open/book) is in flight
  const [actionError, setActionError] = useState<string | null>(null);
  // Re-render the countdown each second without refetching.
  const [, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const g = await getGame(gameId);
      setGame(g);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else if (showSpinner) setError(e instanceof Error ? e.message : 'Failed to load this lobby.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { setNotFound(false); void load(true); }, [load, reloadKey]);

  // Poll while the lobby is live; tick the countdown every second.
  useEffect(() => {
    const status = game?.status ?? '';
    if (!LIVE_STATUSES.has(status)) return;
    pollRef.current = setInterval(() => { void load(false); setTick((t) => t + 1); }, 4000);
    const secondTick = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(secondTick);
    };
  }, [game?.status, load]);

  const run = async (fn: () => Promise<ApiGame>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      setGame(await fn());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (notFound || !game) {
    return (
      <div className="scroll safe-top safe-bottom">
        <EmptyState
          icon="paddle"
          title="This lobby is no longer available"
          description="It may have been cancelled."
          action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ErrorState title="Couldn't load this lobby" message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  const status = game.status ?? 'published';
  const meta = statusMeta(status);
  const participants = game.participants ?? [];
  const playerCount = game.participantCount ?? participants.length;
  const spotsLeft = game.spotsLeft ?? 0;
  const isHost = !!(me && (game.creatorId === me.id || game.creator?.id === me.id));
  const isMember = !!(me && participants.some((p) => p.id === me.id));
  const minPlayers = game.minPlayers ?? 2;
  const candidates = game.candidateVenues ?? [];
  const myVote = me ? game.votes?.find((v) => v.userId === me.id)?.venueId : undefined;
  const majority = majorityThreshold(game);
  const timeLeft = voteTimeLeft(game);

  const canOpenVote = isHost && (status === 'full' || status === 'published') && playerCount >= minPlayers;

  return (
    <div className="scroll pb-[120px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} eyebrow="Game lobby" title={gameTitle(game)} />

      <div className="px-5">
        {/* Status + schedule summary */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`chip ${toneClass[meta.tone]}`}>{meta.label}</span>
          <span className="chip">{gameTypeLabel(game)}</span>
          {game.skillLabel && <span className="chip">{game.skillLabel}</span>}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-[var(--muted)] font-semibold mb-4">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={14} /> {dayParts(game).day === 'TODAY' ? 'Today' : dayParts(game).day}{timeLine(game) ? ` · ${timeLine(game)}` : ''}
          </span>
          {game.rangeKm != null && (
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} /> Within {game.rangeKm} km
            </span>
          )}
        </div>

        {/* Stage explainer */}
        <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mb-4">
          <StageExplainer status={status} isHost={isHost} playerCount={playerCount} minPlayers={minPlayers} capacity={game.capacity ?? 0} timeLeft={timeLeft} majority={majority} winner={game.winningVenue} />
        </div>

        {/* Players */}
        <div className="field">
          <div className="lbl">Players · {playerCount}{spotsLeft > 0 ? ` · ${spotsLeft} open` : ' · full'}</div>
          <div className="players-grid">
            {participants.map((p, i) => (
              <div key={p.id} className="player">
                <Avatar name={p.displayName || 'Player'} size={52} variant={AVATAR_VARIANTS[i % AVATAR_VARIANTS.length]} />
                <div className="name">{me && p.id === me.id ? 'You' : (p.displayName || 'Player').split(' ')[0]}</div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, spotsLeft) }, (_, i) => (
              <div key={`e${i}`} className="player empty">
                <Avatar size={52} />
                <div className="name text-[var(--muted)]!">Open</div>
              </div>
            ))}
          </div>
          {(status === 'published' || status === 'full') && (
            <button className="chip mt-2" onClick={() => onNavigate('invite-players', { id: game.id })}>
              <Icon name="plus" size={12} /> Invite players
            </button>
          )}
        </div>

        {/* Ballot — the frozen vote */}
        {(status === 'voting' || status === 'vote_won' || status === 'paying' || status === 'booked') && candidates.length > 0 && (
          <div className="field">
            <div className="flex items-center justify-between">
              <div className="lbl mb-0!">Venue {status === 'voting' ? 'vote' : 'result'}</div>
              {status === 'voting' && timeLeft && (
                <span className="text-[12px] font-bold text-[var(--coral)] inline-flex items-center gap-1">
                  <Icon name="clock" size={12} /> {timeLeft}
                </span>
              )}
            </div>
            {status === 'voting' && (
              <div className="text-[12px] text-[var(--muted)] font-semibold mb-2">
                Tap a venue to vote. Needs {majority} of {playerCount} to win — booking is locked until then.
              </div>
            )}
            <div className="flex flex-col gap-2 mt-1">
              {candidates.map((v) => {
                const count = votesFor(game, v.id);
                const pct = playerCount > 0 ? Math.round((count / playerCount) * 100) : 0;
                const mine = myVote === v.id;
                const won = game.winningVenueId === v.id;
                const canVote = status === 'voting' && isMember && !busy;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!canVote}
                    onClick={() => canVote && run(() => voteGame(game.id, v.id))}
                    className={`relative overflow-hidden text-left rounded-2xl border p-3 transition ${
                      won ? 'border-[var(--lime)] bg-[var(--lime)]/10'
                        : mine ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-[var(--hairline)] bg-[var(--surface)]'
                    } ${canVote ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* vote-share bar */}
                    <div className="absolute inset-y-0 left-0 bg-[var(--primary)]/8" style={{ width: `${pct}%` }} aria-hidden />
                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-semibold text-[14px] truncate flex items-center gap-1.5">
                          {v.displayName}
                          {won && <Icon name="check" size={14} className="text-[var(--lime)]" />}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] font-semibold truncate">
                          {[v.area || v.city, priceLine(v)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-heading font-bold text-[15px] text-[var(--ink)]">{count}</div>
                        <div className="text-[10px] text-[var(--muted)] font-semibold">{count === 1 ? 'vote' : 'votes'}</div>
                      </div>
                      {mine && status === 'voting' && (
                        <span className="chip blue shrink-0"><Icon name="check" size={11} /> Your vote</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action bar — host-driven progression */}
      <div className="app-action-bar">
        {actionError && <div className="text-[13px] text-[var(--coral)] font-semibold mb-2 text-center">{actionError}</div>}

        {canOpenVote && (
          <Button fullWidth onClick={() => run(() => openVote(game.id))} disabled={busy}>
            <Icon name="bolt" size={18} /> Find venues & open vote
          </Button>
        )}

        {isHost && (status === 'published' || status === 'full') && !canOpenVote && (
          <Button fullWidth disabled>
            Need {minPlayers} players to vote ({playerCount}/{minPlayers})
          </Button>
        )}

        {isHost && status === 'voting' && (
          <Button fullWidth variant="outline" onClick={() => run(() => resolveVote(game.id))} disabled={busy}>
            Close vote &amp; pick the leader
          </Button>
        )}

        {isHost && (status === 'vote_won' || status === 'paying') && (
          <Button
            fullWidth
            onClick={() => onNavigate('book-court', {
              venueId: game.winningVenueId || game.winningVenue?.id || undefined,
              date: game.date || undefined,
              time: game.timeLabel || undefined,
              hours: game.durationLabel ? (parseFloat(game.durationLabel) || undefined) : undefined,
              gameId: game.id,
            })}
          >
            <Icon name="bolt" size={18} /> Book {game.winningVenue?.displayName || 'the winning venue'}
          </Button>
        )}

        {status === 'booked' && (
          <Button fullWidth variant="dark" onClick={() => onNavigate('my-bookings')}>
            <Icon name="check" size={18} /> Booked — view in My bookings
          </Button>
        )}

        {/* Non-member can join while the lobby is still filling */}
        {!isMember && status === 'published' && spotsLeft > 0 && (
          <Button fullWidth onClick={() => run(() => joinGame(game.id))} disabled={busy}>
            <Icon name="bolt" size={18} /> Join lobby
          </Button>
        )}
        {!isMember && status === 'published' && spotsLeft <= 0 && (
          <Button fullWidth disabled>Lobby full</Button>
        )}

        {/* Non-host member waiting states */}
        {isMember && !isHost && (status === 'published' || status === 'full') && (
          <Button fullWidth disabled>{status === 'full' ? 'Host is choosing venues…' : 'Waiting for players…'}</Button>
        )}
        {!isHost && status === 'voting' && !isMember && (
          <Button fullWidth disabled>Join the lobby to vote</Button>
        )}
        {!isHost && (status === 'vote_won' || status === 'paying') && (
          <Button fullWidth disabled>Host is booking the venue…</Button>
        )}

        {/* Leave (members who aren't the host, before booking) */}
        {isMember && !isHost && ['published', 'full', 'voting'].includes(status) && (
          <button
            className="w-full text-center text-[13px] font-semibold text-[var(--coral)] mt-2"
            onClick={() => run(async () => { const g = await leaveGame(game.id); onNavigate('games'); return g; })}
            disabled={busy}
          >
            Leave lobby
          </button>
        )}
      </div>
    </div>
  );
}

function StageExplainer({
  status, isHost, playerCount, minPlayers, capacity, timeLeft, majority, winner,
}: {
  status: string; isHost: boolean; playerCount: number; minPlayers: number;
  capacity: number; timeLeft: string; majority: number; winner?: ApiGameVenue | null;
}) {
  let title = 'Lobby';
  let body = '';
  switch (status) {
    case 'published':
      title = 'Filling the lobby';
      body = `Players within range can join. ${playerCount}/${capacity} in${playerCount < minPlayers ? ` — need ${minPlayers} to start the vote.` : ' — enough to open the vote.'}`;
      break;
    case 'full':
      title = 'Lobby full';
      body = isHost ? 'Open the venue vote so the group can pick where to play.' : 'The host is about to open the venue vote.';
      break;
    case 'voting':
      title = 'Voting on the venue';
      body = `The lobby is locked until ${majority} players agree on one venue.${timeLeft ? ` ${timeLeft}.` : ''}`;
      break;
    case 'vote_won':
      title = 'Venue picked';
      body = `${winner?.displayName || 'A venue'} won the vote. ${isHost ? 'Book it to lock the court.' : 'The host will book it next.'}`;
      break;
    case 'paying':
      title = 'Awaiting payment';
      body = isHost ? 'Finish payment to confirm the booking.' : 'The host is completing payment.';
      break;
    case 'booked':
      title = 'Court booked 🎉';
      body = `${winner?.displayName || 'Your venue'} is reserved. See you on the court!`;
      break;
    case 'cancelled':
      title = 'Lobby cancelled';
      body = 'This game was cancelled.';
      break;
  }
  return (
    <div>
      <div className="font-heading font-semibold text-[15px] text-[var(--ink)] mb-1">{title}</div>
      <div className="text-[13px] text-[var(--muted)] font-semibold leading-snug">{body}</div>
    </div>
  );
}
