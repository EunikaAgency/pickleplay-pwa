import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Button } from '../../shared/components/ui/Button';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { getGame, joinGame, leaveGame, ApiError, type ApiGame } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import {
  dayParts, gameTitle, gameTypeLabel, timeLine, gameLocation, spotsLabel,
  LOBBY_LEAVE_GRACE_PERIOD_DAYS, isLobbyFull, isWithinGracePeriod, canLeaveLobby,
} from './gameDisplay';
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
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);
  // Joining inside the grace window makes the joiner acknowledge the no-refund
  // rule first; this gates the actual join behind a confirmation modal.
  const [confirmJoinOpen, setConfirmJoinOpen] = useState(false);

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
  const creatorId = game?.creatorId || game?.creator?.id;
  const isHost = !!(game && me && creatorId && me.id === creatorId);

  // Lobby / grace-period state — all derived from the shared rules so the UI and
  // the validation never drift apart.
  const lobbyFull = !!game && isLobbyFull(game);
  const withinGrace = !!game && isWithinGracePeriod(game);
  const leaveAllowed = !!game && canLeaveLobby(game);

  // Actually book the joiner in (skips the auth/grace gates, which handleJoin runs).
  const doJoin = async () => {
    if (!game) return;
    setConfirmJoinOpen(false);
    setJoining(true);
    setActionError(null);
    try {
      const updated = await joinGame(game.id);
      setGame(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not join this game.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = () => {
    if (!game || isJoined || joining) return;
    // Browsing the game is free; committing to it requires an account.
    if (onRequireAuth && !onRequireAuth('join this game')) return;
    // Joining within the grace window can lock the spot once the lobby fills, so
    // make the joiner confirm the no-refund rule before we book them in.
    if (withinGrace) { setConfirmJoinOpen(true); return; }
    void doJoin();
  };

  const handleLeave = async () => {
    if (!game || leaving || !leaveAllowed) return;
    setLeaving(true);
    setActionError(null);
    try {
      const updated = await leaveGame(game.id);
      setGame(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not leave this game.');
    } finally {
      setLeaving(false);
    }
  };

  const isFull = spotsLeft <= 0 && !isJoined;

  // A single grace-period notice whose wording adapts to the viewer's state
  // (host gets the "ready to play" banner instead, so they're excluded here).
  const graceNotice: string | null = (() => {
    if (!game || isHost || !withinGrace) return null;
    if (isJoined) {
      return leaveAllowed
        ? `This game is within ${LOBBY_LEAVE_GRACE_PERIOD_DAYS} days. You can still leave while the lobby has open spots — once it fills, your spot is final and non-refundable.`
        : `The lobby is full and the game is within ${LOBBY_LEAVE_GRACE_PERIOD_DAYS} days, so your spot is locked in — this booking is final and non-refundable.`;
    }
    // Non-joined viewer: only relevant while there's still a spot to take.
    if (lobbyFull) return null;
    return `This game is within the ${LOBBY_LEAVE_GRACE_PERIOD_DAYS}-day grace period. You can leave only while the lobby isn't full — once it fills, your booking is final and non-refundable.`;
  })();

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
            {/* Host-only: the lobby just filled — the game is ready to play. */}
            {isHost && lobbyFull && (
              <div className="rounded-2xl bg-[var(--lime)]/20 border-[0.5px] border-[var(--lime)] px-4 py-3 flex items-start gap-3 mb-4">
                <Icon name="check" size={20} className="mt-0.5 shrink-0 text-[var(--ink)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--ink)]">Your lobby is full</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">The game is ready to play — your full roster is locked in.</div>
                </div>
              </div>
            )}

            {/* Joiner-facing grace-period / no-refund notice. */}
            {graceNotice && (
              <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3 flex items-start gap-3 mb-4">
                <Icon name={leaveAllowed ? 'clock' : 'lock'} size={18} className="mt-0.5 shrink-0 text-[var(--coral)]" />
                <div>
                  <div className="text-[13px] font-bold text-[var(--coral)]">
                    {leaveAllowed ? `Within the ${LOBBY_LEAVE_GRACE_PERIOD_DAYS}-day grace period` : 'Spot locked in'}
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--ink-2)]">{graceNotice}</div>
                </div>
              </div>
            )}

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
              <div className="eyebrow">{isJoined ? 'Your spot' : 'Open spots'}</div>
              <div className="amount">{isJoined ? "You're in" : spotsLeft > 0 ? spotsLeft : 'Full'}</div>
            </div>
            {isHost ? (
              <button className="btn-join joined" disabled>
                <Icon name="shield" size={16} />
                You're hosting
              </button>
            ) : isJoined ? (
              leaveAllowed ? (
                <button className="btn-join btn-leave" onClick={handleLeave} disabled={leaving}>
                  {leaving ? (
                    <>
                      <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                      Leaving…
                    </>
                  ) : (
                    <>
                      <Icon name="logout" size={16} />
                      Leave game
                    </>
                  )}
                </button>
              ) : (
                <button className="btn-join joined" disabled title="The lobby is full and the game is within the grace period — your spot is final.">
                  <Icon name="lock" size={16} />
                  Spot locked
                </button>
              )
            ) : (
              <button className="btn-join" onClick={handleJoin} disabled={joining || isFull}>
                {joining ? (
                  <>
                    <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                    Joining…
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
            )}
          </div>

          {actionError && (
            <div className="fixed bottom-[96px] left-0 right-0 px-4 text-center text-[13px] text-[var(--coral)] font-semibold">
              {actionError}
            </div>
          )}

          {/* Booking-within-grace confirmation — explicit no-refund acknowledgement. */}
          <BottomSheet open={confirmJoinOpen} onClose={() => setConfirmJoinOpen(false)} title="Confirm your booking">
            <div className="px-1 pb-1">
              <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3.5 flex items-start gap-3">
                <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-[var(--coral)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--coral)] mb-0.5">Within the {LOBBY_LEAVE_GRACE_PERIOD_DAYS}-day grace period</div>
                  <p className="text-[13px] font-semibold text-[var(--ink-2)] leading-snug">
                    This game is within the {LOBBY_LEAVE_GRACE_PERIOD_DAYS}-day grace period. You may leave only while the
                    lobby is not full. Once the lobby becomes full, your booking is final and non-refundable.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" onClick={() => setConfirmJoinOpen(false)} disabled={joining}>Cancel</Button>
                <Button variant="dark" onClick={doJoin} disabled={joining}>
                  {joining ? (
                    <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Booking…</>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </div>
          </BottomSheet>

          <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
        </div>
      )}
    </DemoBranch>
  );
}
