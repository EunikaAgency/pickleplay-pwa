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
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ShareLobbySheet } from '../../shared/components/ui/ShareLobbySheet';
import { getGame, joinGame, leaveGame, requestLeaveGame, approveLeaveGame, deleteGame, startConversation, ApiError, apiImageUrl, type ApiGame } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  dayParts, gameTitle, gameTypeLabel, gameFormatLabel, gameVibeLabel, timeLine, gameLocation, spotsLabel,
  isLobbyFull, freeLeaveMsLeft, canLeaveLobby,
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
  const [approvingLeave, setApprovingLeave] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Set once the host deletes the lobby — keeps the post-delete success view up
  // (with the kept booking's id, for the refund/cancel hand-off) instead of
  // bouncing straight to the games list.
  const [deleted, setDeleted] = useState<{ bookingId: string | null } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pb-saved-games') || '[]').includes(gameId); } catch { return false; }
  });

  const [prevFetchKey, setPrevFetchKey] = useState(`${gameId}|${reloadKey}`);
  const fetchKey = `${gameId}|${reloadKey}`;
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setError(null);
    setNotFound(false);
  }

  useEffect(() => {
    let alive = true;
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
  // The host can cancel (delete) their own game from inside the lobby — deleting
  // also releases the linked court reservation (handled server-side).
  const canManageGame = isHost && userHasPermission(me, 'player.games.manage');

  // Lobby / leave-policy state — all derived from the shared rules so the UI and
  // the validation never drift apart. A full lobby gives everyone a 1h window to
  // leave freely; after that, leaving needs the host's approval.
  const lobbyFull = !!game && isLobbyFull(game);
  const leaveAllowed = !!game && canLeaveLobby(game);
  const leaveMinsLeft = game ? Math.ceil(freeLeaveMsLeft(game) / 60_000) : 0;
  const pendingLeaves = game?.pendingLeaveUsers ?? [];
  const viewerPendingLeave = !!(me && pendingLeaves.some((p) => p.id === me.id));

  // Actually book the joiner in (the auth gate runs in handleJoin).
  const doJoin = async () => {
    if (!game) return;
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
    if (!game || isJoined || joining || lobbyFull) return;
    // Browsing the game is free; committing to it requires an account. The server
    // enforces the re-join cooldown (leave twice → wait 1h) and returns a clear
    // message that lands in actionError.
    if (onRequireAuth && !onRequireAuth('join this game')) return;
    void doJoin();
  };

  // Leave directly while allowed (not full, or full within the 1h window); once
  // the window closes the same button asks the host for permission instead.
  const handleLeave = async () => {
    if (!game || leaving || viewerPendingLeave) return;
    setLeaving(true);
    setActionError(null);
    try {
      const updated = leaveAllowed ? await leaveGame(game.id) : await requestLeaveGame(game.id);
      setGame(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not leave this game.');
    } finally {
      setLeaving(false);
    }
  };

  // Host approves a pending leave request — the player drops off the roster.
  const handleApproveLeave = async (userId: string) => {
    if (!game || approvingLeave) return;
    setApprovingLeave(userId);
    setActionError(null);
    try {
      const updated = await approveLeaveGame(game.id, userId);
      setGame(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not approve the request.');
    } finally {
      setApprovingLeave(null);
    }
  };

  // Host removes the lobby but keeps the court booked: the server deletes the
  // game, converts the reservation back to a normal court booking (returning its
  // id), and notifies the roster. We then show the post-delete view so the host
  // can head to the refund/cancel flow for that booking.
  const handleDelete = async () => {
    if (!game || deleting || !canManageGame) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await deleteGame(game.id, { keepBooking: true });
      setConfirmDeleteOpen(false);
      setDeleted({ bookingId: res.bookingId });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete this game.');
      setDeleting(false);
    }
  };

  // Open (or create) a DM thread with the game's host, then jump into the chat.
  const messageOrganizer = async () => {
    if (!game?.creator?.id || messaging) return;
    if (onRequireAuth && !onRequireAuth('message the organizer')) return;
    setMessaging(true);
    setActionError(null);
    try {
      const conv = await startConversation(game.creator.id);
      onNavigate('chat', { id: conv.id, name: conv.otherParticipant?.displayName ?? game.creator.displayName });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the conversation.');
    } finally {
      setMessaging(false);
    }
  };

  const isFull = spotsLeft <= 0 && !isJoined;

  const toggleSave = () => {
    if (!game) return;
    try {
      const cur: string[] = JSON.parse(localStorage.getItem('pb-saved-games') || '[]');
      const next = cur.includes(game.id) ? cur.filter((x) => x !== game.id) : [...cur, game.id];
      localStorage.setItem('pb-saved-games', JSON.stringify(next));
      setSaved(next.includes(game.id));
    } catch { /* ignore */ }
  };

  // A single leave-policy notice whose wording adapts to the viewer's state
  // (host gets the "ready to play" banner instead, so they're excluded here).
  const graceNotice: string | null = (() => {
    if (!game || isHost || !isJoined || !lobbyFull) return null;
    if (viewerPendingLeave) return 'You asked to leave — waiting for the host to approve.';
    return leaveAllowed
      ? `The lobby is full. You have about ${leaveMinsLeft} min left to leave freely — after that, leaving needs the host's permission.`
      : 'The lobby is full and the free-leave window has closed. To leave now, ask the host for permission.';
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
          <ScreenHeader onBack={onBack} title="Game" />
          <ErrorState
            title="Couldn't load this game"
            message="We couldn't fetch this game's details. Pull down to retry."
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      }
      empty={
        <div className="scroll safe-top safe-bottom">
          <ScreenHeader onBack={onBack} title="Game" />
          <EmptyState
            icon="paddle"
            title="This game is no longer available"
            description="The organizer may have cancelled it or filled all the spots."
            action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
          />
        </div>
      }
    >
      {deleted ? (
        <div className="scroll safe-top safe-bottom px-5 flex flex-col items-center justify-center text-center min-h-[78vh]">
          <div className="w-16 h-16 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center mb-4">
            <Icon name="check" size={30} />
          </div>
          <h2 className="font-heading font-bold text-[20px] text-[var(--ink)]">Lobby deleted</h2>
          <p className="text-[14px] text-[var(--ink-2)] font-semibold mt-2 max-w-[300px]">
            The game lobby is gone, but your court is still booked. You can request a refund or cancel
            the reservation — or keep it and play anyway.
          </p>
          <div className="w-full max-w-[320px] mt-6 flex flex-col gap-2.5">
            {deleted.bookingId && (
              <Button
                fullWidth
                variant="destructive"
                onClick={() => onNavigate('booking-refund', { bookingId: deleted.bookingId! }, { replace: true })}
              >
                <Icon name="logout" size={16} /> Refund or cancel booking
              </Button>
            )}
            <Button fullWidth variant="outline" onClick={() => onNavigate('games', undefined, { replace: true })}>
              Back to games
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="scroll safe-top safe-bottom px-4">
          <LoadingSkeleton variant="block" count={1} />
          <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
        </div>
      ) : notFound || !game ? (
        <div className="scroll safe-top safe-bottom">
          <ScreenHeader onBack={onBack} title="Game" />
          <EmptyState
            icon="paddle"
            title="This game is no longer available"
            description="The organizer may have cancelled it or filled all the spots."
            action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
          />
        </div>
      ) : error ? (
        <div className="scroll safe-top safe-bottom">
          <ScreenHeader onBack={onBack} title="Game" />
          <ErrorState
            title="Couldn't load this game"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      ) : (
        <div className="scroll pb-[130px]">
          <div className="detail-hero">
            <div className="img" style={{ backgroundImage: `url(${apiImageUrl(game?.courtImage) || apiImageUrl(game?.venue?.image) || '/fallback-game.png'})` }} />
            <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
              <CourtIllustration width={240} />
            </div>
            <div className="grad" />
            <div className="top-controls">
              <button className="icon-btn" onClick={onBack} aria-label="Back">
                <Icon name="back" size={18} />
              </button>
              <div className="flex gap-2">
                <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label="Share this game">
                  <Icon name="share" size={16} />
                </button>
                <button className="icon-btn" onClick={toggleSave} aria-label={saved ? 'Remove from saved' : 'Save this game'}>
                  <Icon name={saved ? 'heart' : 'heart_o'} size={16} />
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
                {gameFormatLabel(game) && <span className="tag lime">{gameFormatLabel(game)}</span>}
                {gameVibeLabel(game) && <span className="tag">{game.vibe === 'competitive' ? '🔥' : '😎'} {gameVibeLabel(game)}</span>}
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

            {/* Joiner-facing leave-policy notice (free-leave window / host approval). */}
            {graceNotice && (
              <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3 flex items-start gap-3 mb-4">
                <Icon name={leaveAllowed ? 'clock' : 'lock'} size={18} className="mt-0.5 shrink-0 text-[var(--coral)]" />
                <div>
                  <div className="text-[13px] font-bold text-[var(--coral)]">
                    {viewerPendingLeave ? 'Leave requested' : leaveAllowed ? 'Free-leave window open' : 'Lobby locked'}
                  </div>
                  {/* Use --coral (fixed dark red in both themes) not --ink-2, which
                      flips light in dark mode → unreadable on the pale coral card. */}
                  <div className="text-[12px] font-semibold text-[var(--coral)]">{graceNotice}</div>
                </div>
              </div>
            )}

            <div className="kv-grid">
              <div className="kv">
                <div className="eyebrow">Format</div>
                <div className="val">{gameFormatLabel(game) || gameTypeLabel(game)}</div>
              </div>
              <div className="kv">
                <div className="eyebrow">Skill</div>
                <div className="val">{game.skillLabel || 'Open'}</div>
              </div>
              <div className="kv">
                <div className="eyebrow">Duration</div>
                <div className="val">{game.durationLabel || '—'}</div>
              </div>
              <div className="kv">
                <div className="eyebrow">Spots</div>
                <div className={`val ${spotsLeft > 0 ? 'lime' : ''}`}>{spotsLabel(game)}</div>
              </div>
            </div>

            <div className="organizer">
              <Avatar src={game.creator?.avatarUrl} name={game.creator?.displayName || 'Host'} size={48} variant="lime" />
              <div className="meta">
                <div className="role">Hosted by</div>
                <div className="name">{game.creator?.displayName || 'Host'}</div>
              </div>
              {/* Message the host — hidden on your own game and for guests/roles
                  without messaging. */}
              {game.creator?.id && game.creator.id !== me?.id && userHasPermission(me, 'user.messages.send') && (
                <div className="actions">
                  <button
                    className="icon-btn"
                    aria-label={`Message ${game.creator.displayName || 'organizer'}`}
                    onClick={messageOrganizer}
                    disabled={messaging}
                  >
                    <Icon name="message" size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Prominent group-chat entry for roster members (host + joined). */}
            {(isJoined || isHost) && (
              <button
                onClick={() => onNavigate('game-chat', { id: game.id, name: gameTitle(game) })}
                className="w-full mb-4 flex items-center gap-3 rounded-2xl bg-[var(--primary)] text-white px-4 py-3.5 active:scale-[0.99] transition-transform"
              >
                <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="chat" size={18} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[15px] font-bold">Group chat</span>
                  <span className="block text-[12px] text-white/80">Talk with the players in this game</span>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            )}

            {/* Location — venue name/area + directions (decorative map box dropped). */}
            <div className="location-card">
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
              {game.description ? (
                <p className="whitespace-pre-wrap">{game.description}</p>
              ) : (
                <>
                  <p>
                    {gameTypeLabel(game)}{gameFormatLabel(game) ? ` · ${gameFormatLabel(game)}` : ''}{game.skillLabel ? ` · ${game.skillLabel}` : ''}, hosted by{' '}
                    {game.creator?.displayName || 'the host'}
                    {game.durationLabel ? ` · ${game.durationLabel}` : ''}.
                  </p>
                  <p>
                    {game.participantCount ?? participants.length} going
                    {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} still open` : ' · this game is full'}.
                  </p>
                </>
              )}
            </div>

            {/* Host-only: pending leave requests — approve to release the player. */}
            {isHost && pendingLeaves.length > 0 && (
              <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3.5 mb-4">
                <div className="text-[13px] font-bold text-[var(--coral)] mb-2.5">
                  {pendingLeaves.length === 1 ? 'A player wants to leave' : `${pendingLeaves.length} players want to leave`}
                </div>
                <div className="flex flex-col gap-2.5">
                  {pendingLeaves.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <Avatar src={p.avatarUrl} name={p.displayName} size={32} />
                      <div className="flex-1 text-[13px] font-semibold text-[var(--ink)]">{p.displayName}</div>
                      <Button variant="outline" onClick={() => handleApproveLeave(p.id)} disabled={approvingLeave === p.id}>
                        {approvingLeave === p.id ? 'Releasing…' : 'Let them leave'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-[18px]">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="t-eyebrow">Players</div>
                  <div className="hd-3 mt-1">
                    {game.participantCount ?? participants.length} going{spotsLeft > 0 ? ` · ${spotsLeft} spots open` : ''}
                  </div>
                </div>
              </div>
              {/* Who's joined — the roster with the host + "you" marked. */}
              {participants.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {participants.map((p) => {
                    const isHostRow = p.id === (game.creator?.id ?? game.creatorId);
                    const isMe = !!(me && p.id === me.id);
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <Avatar src={p.avatarUrl} name={p.displayName} size={36} />
                        <div className="text-[14px] font-semibold text-[var(--ink)]">
                          {p.displayName}{isMe ? ' (you)' : ''}
                        </div>
                        {isHostRow && <span className="tag lime ml-auto">Host</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="sticky-cta">
            <div className="price">
              <div className="eyebrow">{isJoined ? 'Your spot' : 'Open spots'}</div>
              <div className="amount">{isJoined ? "You're in" : spotsLeft > 0 ? (game.bookingId ? 'Free' : spotsLeft) : 'Full'}</div>
            </div>
            {isHost ? (
              canManageGame ? (
                <button
                  className="btn-join btn-leave"
                  onClick={() => { setActionError(null); setConfirmDeleteOpen(true); }}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Icon name="close" size={16} />
                      Delete lobby
                    </>
                  )}
                </button>
              ) : (
                <button className="btn-join joined" disabled>
                  <Icon name="shield" size={16} />
                  You're hosting
                </button>
              )
            ) : isJoined ? (
              viewerPendingLeave ? (
                <button className="btn-join joined" disabled title="You asked to leave — waiting for the host to approve.">
                  <Icon name="clock" size={16} />
                  Leave requested
                </button>
              ) : (
                <button className="btn-join btn-leave" onClick={handleLeave} disabled={leaving}>
                  {leaving ? (
                    <>
                      <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
                      {leaveAllowed ? 'Leaving…' : 'Asking…'}
                    </>
                  ) : leaveAllowed ? (
                    <>
                      <Icon name="logout" size={16} />
                      Leave game
                    </>
                  ) : (
                    <>
                      <Icon name="lock" size={16} />
                      Ask to leave
                    </>
                  )}
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

          {/* Host delete-lobby confirmation — removes the lobby but keeps the court booked. */}
          <BottomSheet open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Delete this lobby?">
            <div className="px-1 pb-1">
              <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3.5 flex items-start gap-3">
                <Icon name="close" size={20} className="mt-0.5 shrink-0 text-[var(--coral)]" />
                <div>
                  <div className="text-[14px] font-bold text-[var(--coral)] mb-0.5">The lobby will be removed</div>
                  <p className="text-[13px] font-semibold text-[var(--coral)] leading-snug">
                    This cancels the game for everyone in the lobby
                    {participants.length > 1 ? ' and notifies the other players' : ''}. Your court stays
                    booked — you can request a refund or cancel the reservation on the next screen.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>Keep lobby</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? (
                    <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Deleting…</>
                  ) : (
                    'Delete lobby'
                  )}
                </Button>
              </div>
            </div>
          </BottomSheet>

          <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />

          <ShareLobbySheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            gameId={game.id}
            title={gameTitle(game)}
            subtitle={[timeLine(game), gameLocation(game), spotsLabel(game)].filter(Boolean).join(' · ')}
            image={apiImageUrl(game.courtImage) || apiImageUrl(game.venue?.image) || '/fallback-game.png'}
            gameType={gameTypeLabel(game)}
            skillLabel={game.skillLabel ?? undefined}
            dateTime={[dayParts(game).day === 'TODAY' ? 'Today' : dayParts(game).day === 'TOM' ? 'Tomorrow' : dayParts(game).day, timeLine(game)].filter(Boolean).join(' · ') || undefined}
            venue={gameLocation(game)}
            spotsLeft={game.spotsLeft ?? undefined}
            capacity={game.capacity ?? undefined}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </DemoBranch>
  );
}
