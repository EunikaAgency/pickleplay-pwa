import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { getGame, joinGame, ApiError, type ApiGame } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { dayParts, gameTitle, gameTypeLabel, timeLine, gameLocation, spotsLabel } from './gameDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface GameDetailsScreenProps {
  gameId: string;
  onNavigate: Navigate;
  onBack: () => void;
  /** Soft auth gate — returns false (and prompts sign-up) for guests. */
  onRequireAuth?: (intent: string) => boolean;
}

const AVATAR_VARIANTS = ['lime', 'blue', 'coral'] as const;

export function GameDetailsScreen({ gameId, onNavigate, onBack, onRequireAuth }: GameDetailsScreenProps) {
  const me = useAuthStore((s) => s.user);
  const [game, setGame] = useState<ApiGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    getGame(gameId)
      .then((g) => { if (alive) setGame(g); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : 'Failed to load this game.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gameId, reloadKey]);

  const participants = game?.participants ?? [];
  const isJoined = !!(game && me && participants.some((p) => p.id === me.id));
  const spotsLeft = game?.spotsLeft ?? 0;

  const handleJoin = async () => {
    if (!game || isJoined || joining) return;
    // Browsing the game is free; committing to it requires an account.
    if (onRequireAuth && !onRequireAuth('join this game')) return;
    setJoining(true);
    setJoinError(null);
    try {
      const updated = await joinGame(game.id);
      setGame(updated);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Could not join this game.');
    } finally {
      setJoining(false);
    }
  };

  const isFull = spotsLeft <= 0 && !isJoined;

  return (
    <DemoBranch
      loading={
        <div className="scroll safe-top safe-bottom px-4">
          <LoadingSkeleton variant="block" count={1} />
          <div className="mt-3">
            <LoadingSkeleton variant="card" count={3} />
          </div>
        </div>
      }
      error={
        <div className="scroll safe-top safe-bottom">
          <ErrorState
            title="Couldn't load this game"
            message="We couldn't fetch this game's details. Pull down to retry."
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      }
      empty={
        <div className="scroll safe-top safe-bottom">
          <EmptyState
            icon="paddle"
            title="This game is no longer available"
            description="The organizer may have cancelled it or filled all the spots."
            action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
          />
        </div>
      }
    >
      {loading ? (
        <div className="scroll safe-top safe-bottom px-4">
          <LoadingSkeleton variant="block" count={1} />
          <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
        </div>
      ) : notFound || !game ? (
        <div className="scroll safe-top safe-bottom">
          <EmptyState
            icon="paddle"
            title="This game is no longer available"
            description="The organizer may have cancelled it or filled all the spots."
            action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
          />
        </div>
      ) : error ? (
        <div className="scroll safe-top safe-bottom">
          <ErrorState
            title="Couldn't load this game"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      ) : (
        <div className="scroll pb-[130px]">
          <div className="detail-hero">
            <div className="img bg-[linear-gradient(135deg,#0040e0_0%,#6c83ff_60%,#a5b9ff_100%)]" />
            <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
              <CourtIllustration width={240} />
            </div>
            <div className="grad" />
            <div className="top-controls">
              <button className="icon-btn" onClick={onBack} aria-label="Back">
                <Icon name="back" size={18} />
              </button>
              <div className="flex gap-2">
                <button className="icon-btn" aria-label="Share">
                  <Icon name="share" size={16} />
                </button>
                <button className="icon-btn" aria-label="Save">
                  <Icon name="heart_o" size={16} />
                </button>
              </div>
            </div>
            <div className="info">
              <div className="tag-row">
                {game.skillLabel && (
                  <button
                    type="button"
                    className="tag lime cursor-pointer inline-flex items-center gap-1"
                    onClick={() => setDuprOpen(true)}
                  >
                    {game.skillLabel} <Icon name="help" size={11} />
                  </button>
                )}
                <span className="tag">{gameTypeLabel(game)}</span>
                {game.visibility === 'invite' && <span className="tag">Invite only</span>}
              </div>
              <h1>{gameTitle(game)}</h1>
              <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
                <span className="inline-flex items-center gap-1">
                  <Icon name="clock" size={14} /> {dayParts(game).day === 'TODAY' ? 'Today' : dayParts(game).day}{timeLine(game) ? ` · ${timeLine(game)}` : ''}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="location" size={14} /> {gameLocation(game)}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-body">
            <div className="kv-grid">
              <div className="kv">
                <div className="eyebrow">Format</div>
                <div className="val">{gameTypeLabel(game)}</div>
              </div>
              <div className="kv">
                <div className="eyebrow">Skill</div>
                <div className="val">{game.skillLabel || 'Open'}</div>
              </div>
              <div className="kv">
                <div className="eyebrow">Spots</div>
                <div className={`val ${spotsLeft > 0 ? 'lime' : ''}`}>{spotsLabel(game)}</div>
              </div>
            </div>

            <div className="organizer">
              <Avatar name={game.creator?.displayName || 'Host'} size={48} variant="lime" />
              <div className="meta">
                <div className="role">Hosted by</div>
                <div className="name">{game.creator?.displayName || 'Host'}</div>
              </div>
              <div className="actions">
                <button className="icon-btn" aria-label="Message organizer">
                  <Icon name="message" size={16} />
                </button>
              </div>
            </div>

            <div className="location-card">
              <div className="map-preview">
                <div className="pin">
                  <Icon name="location" size={16} />
                </div>
              </div>
              <div className="map-info">
                <div className="text">
                  <div className="name">{game.venue?.displayName || game.venueName || 'Location TBD'}</div>
                  {game.venue && (
                    <div className="addr">{[game.venue.area, game.venue.city].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                {(game.venue?.displayName || game.venueName) && (
                  <a
                    className="directions"
                    aria-label="Get directions"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [game.venue?.displayName || game.venueName, game.venue?.area, game.venue?.city].filter(Boolean).join(' '),
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="directions" size={18} />
                  </a>
                )}
              </div>
            </div>

            <div className="about-card">
              <div className="t-eyebrow mb-1.5">About this game</div>
              <p>
                {gameTypeLabel(game)} game{game.skillLabel ? ` · ${game.skillLabel}` : ''}, hosted by{' '}
                {game.creator?.displayName || 'the host'}
                {game.durationLabel ? ` · ${game.durationLabel}` : ''}.
              </p>
              <p>
                {game.participantCount ?? participants.length} going
                {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} still open` : ' · this game is full'}.
              </p>
            </div>

            <div className="mb-[18px]">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="t-eyebrow">Players</div>
                  <div className="hd-3 mt-1">
                    {game.participantCount ?? participants.length} going{spotsLeft > 0 ? ` · ${spotsLeft} spots open` : ''}
                  </div>
                </div>
                <button className="more" onClick={() => onNavigate('invite-players', { id: game.id })}>Invite</button>
              </div>
              <div className="players-grid">
                {participants.map((p, i) => (
                  <div key={p.id} className="player">
                    <Avatar name={p.displayName || 'Player'} size={56} variant={AVATAR_VARIANTS[i % AVATAR_VARIANTS.length]} />
                    <div className="name">{me && p.id === me.id ? 'You' : (p.displayName || 'Player').split(' ')[0]}</div>
                  </div>
                ))}
                {Array.from({ length: spotsLeft }, (_, i) => (
                  <div key={`e${i}`} className="player empty">
                    <Avatar size={56} />
                    <div className="name text-[var(--muted)]!">Open</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky-cta">
            <div className="price">
              <div className="eyebrow">Open spots</div>
              <div className="amount">{spotsLeft > 0 ? spotsLeft : 'Full'}</div>
            </div>
            <button
              className={`btn-join ${isJoined ? 'joined' : ''}`}
              onClick={handleJoin}
              disabled={joining || isJoined || isFull}
            >
              {joining ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={18} />
                  </span>
                  Joining…
                </>
              ) : isJoined ? (
                <>
                  <Icon name="check" size={16} />
                  You're in!
                </>
              ) : isFull ? (
                'Game full'
              ) : (
                <>
                  <Icon name="bolt" size={16} />
                  Join Game
                </>
              )}
            </button>
          </div>

          {joinError && (
            <div className="fixed bottom-[96px] left-0 right-0 px-4 text-center text-[13px] text-[var(--coral)] font-semibold">
              {joinError}
            </div>
          )}

          <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
        </div>
      )}
    </DemoBranch>
  );
}
