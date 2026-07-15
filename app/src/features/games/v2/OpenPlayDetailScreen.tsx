import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import { CourtIllustration } from '../../../shared/components/ui/CourtIllustration';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ShareLobbySheet } from '../../../shared/components/ui/ShareLobbySheet';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { InvitePlayersSheet } from '../InvitePlayersSheet';
import { GameDetailsScreen } from '../GameDetailsScreen';
import { type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import {
  getGame, toggleGameInterest, deleteGame, apiImageUrl,
  getOpenPlaySession, joinOpenPlaySession, leaveOpenPlaySession,
  type ApiGame, type ApiGamePerson, type ApiOpenPlaySession,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { money, prettyDate, to12h } from '../../bookings/bookingDisplay';
import { dayParts, gameTitle, gameTypeLabel, gameVibeLabel, gameLocation, genderBlockReason, genderPolicyLabel, skillBlockReason, interestLabel, interestWithTarget, timeLine } from '../gameDisplay';

interface Props {
  source: 'auto' | 'game' | 'session';
  id: string;
  chrome: V2ScreenChrome;
  onBack: () => void;
}

function sessionTimeRange(s: ApiOpenPlaySession): string {
  const start = s.startTime ? to12h(s.startTime) : '';
  const end = s.endTime ? to12h(s.endTime) : '';
  return [start, end].filter(Boolean).join(' - ');
}

function sessionWhen(s: ApiOpenPlaySession): string {
  const day = prettyDate(s.date);
  const time = sessionTimeRange(s);
  if (day && time) return `${day} · ${time}`;
  return day || time || 'Schedule TBA';
}

/** Check if a game is an open-play type (player-published booking, no lobby). */
function isOpenPlayGame(g: ApiGame): boolean {
  return ((g.gameType || '').toLowerCase() || 'open') === 'open';
}

export function OpenPlayDetailScreen({ source, id, chrome, onBack }: Props) {
  if (source === 'auto') return <AutoOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
  if (source === 'game') return <GameOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
  return <OrganizerOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
}

/* ─── Auto resolver: deep links (/open-play/:id) ─── */

function AutoOpenPlayDetail({ id, chrome, onBack }: { id: string; chrome: V2ScreenChrome; onBack: () => void }) {
  const [game, setGame] = useState<ApiGame | null>(null);
  const [kind, setKind] = useState<'loading' | 'game' | 'open-game' | 'session'>('loading');

  useEffect(() => {
    let alive = true;
    setKind('loading');
    getGame(id)
      .then((g) => {
        if (!alive) return;
        setGame(g);
        setKind(isOpenPlayGame(g) ? 'open-game' : 'game');
      })
      .catch(() => { if (alive) setKind('session'); });
    return () => { alive = false; };
  }, [id]);

  if (kind === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (kind === 'game') return <GameDetailsScreen gameId={id} onNavigate={chrome.onNavigate} onBack={onBack} onRequireAuth={chrome.requireAuth} />;
  if (kind === 'open-game') return <PlayerOpenPlayGameDetail game={game!} chrome={chrome} onBack={onBack} />;
  return <OrganizerOpenPlayDetail id={id} chrome={chrome} onBack={onBack} />;
}

/* ─── source=game resolver (navigated from Open Play tab game cards) ─── */

function GameOpenPlayDetail({ id, chrome, onBack }: { id: string; chrome: V2ScreenChrome; onBack: () => void }) {
  const [game, setGame] = useState<ApiGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getGame(id)
      .then((g) => { if (alive) setGame(g); })
      .catch(() => { /* fall through to not-found */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="scroll safe-top safe-bottom">
        <div className="detail-hero" style={{ minHeight: 140 }}>
          <div className="img" style={{ backgroundImage: `url(/fallback-game.png)` }} />
          <div className="grad" />
          <div className="top-controls">
            <button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" size={18} /></button>
          </div>
        </div>
        <EmptyState icon="calendar" title="Not found" description="This Open Play may have been removed." action={{ label: 'Back to Open Play', onPress: onBack }} />
      </div>
    );
  }
  if (isOpenPlayGame(game)) return <PlayerOpenPlayGameDetail game={game} chrome={chrome} onBack={onBack} />;
  return <GameDetailsScreen gameId={id} onNavigate={chrome.onNavigate} onBack={onBack} onRequireAuth={chrome.requireAuth} />;
}

/* ─── Simple detail for open-type Games (gameType: 'open') — info + join/leave, NO lobby, NO confirmation popup ─── */

function PlayerOpenPlayGameDetail({ game: initialGame, chrome, onBack }: { game: ApiGame; chrome: V2ScreenChrome; onBack: () => void }) {
  const me = useAuthStore((s) => s.user);
  const [game, setGame] = useState<ApiGame>(initialGame);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState<{ bookingId: string | null } | null>(null);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pb-saved-games') || '[]').includes(initialGame.id); } catch { return false; }
  });

  // Open Play is interest-based: no roster/slots, just a soft "I'm Interested" signal.
  const interested: ApiGamePerson[] = game.interestedUsers ?? [];
  const isInterested = !!(me && interested.some((p) => p.id === me.id));
  const interestedCount = game.interestedCount ?? interested.length;

  // The host doesn't sign up for their own session — they cancel it. Same gate as
  // the game lobby's delete (GameDetailsScreen): host + `player.games.manage`.
  const creatorId = game.creatorId || game.creator?.id;
  const isHost = !!(me && creatorId && me.id === creatorId);
  const canManageGame = isHost && userHasPermission(me, 'player.games.manage');

  // Men-only / women-only sessions admit only a matching profile gender. Already-
  // interested players can always withdraw, so the block only guards signing up.
  const restrictedTo = genderPolicyLabel(game.genderPolicy);
  const blockedReason = isInterested
    ? null
    : genderBlockReason(game.genderPolicy, me?.gender, !!me)
      ?? skillBlockReason(game.skillMin, game.skillMax, me?.skillLevel, !!me);

  const toggleInterest = async () => {
    if (!game || busy || blockedReason || isHost) return;
    if (!isInterested && !chrome.requireAuth('show interest')) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await toggleGameInterest(game.id);
      setGame(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your interest.');
    } finally {
      setBusy(false);
    }
  };

  // Cancelling the session removes it from Open Play but leaves the court booked —
  // the host then decides on the reservation itself in the refund/cancel flow.
  const handleCancel = async () => {
    if (!game || cancelling || !canManageGame) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await deleteGame(game.id, { keepBooking: true });
      setConfirmCancelOpen(false);
      setCancelled({ bookingId: res.bookingId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel this session.');
      setCancelling(false);
    }
  };

  const toggleSave = () => {
    try {
      const cur: string[] = JSON.parse(localStorage.getItem('pb-saved-games') || '[]');
      const next = cur.includes(game.id) ? cur.filter((x) => x !== game.id) : [...cur, game.id];
      localStorage.setItem('pb-saved-games', JSON.stringify(next));
      setSaved(next.includes(game.id));
    } catch { /* ignore */ }
  };

  const title = gameTitle(game);
  const venue = game.venue?.displayName || game.venueName || 'Venue TBA';
  const when = [prettyDate(game.date), game.timeLabel || game.whenLabel].filter(Boolean).join(' · ') || 'Time TBA';
  const level = game.skillLabel || 'All levels';
  const hostName = game.creator?.displayName || 'Host';

  if (cancelled) {
    return (
      <div className="scroll safe-top safe-bottom px-5 flex flex-col items-center justify-center text-center min-h-[78vh]">
        <div className="w-16 h-16 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center mb-4">
          <Icon name="check" size={30} />
        </div>
        <h2 className="font-heading font-bold text-[20px] text-[var(--ink)]">Session cancelled</h2>
        <p className="text-[14px] text-[var(--ink-2)] font-semibold mt-2 max-w-[300px]">
          It's off Open Play and everyone who was interested has been notified. Your court is still
          booked — you can request a refund or cancel it, or keep it and play anyway.
        </p>
        <div className="w-full max-w-[320px] mt-6 flex flex-col gap-2.5">
          {cancelled.bookingId && (
            <Button
              fullWidth
              variant="destructive"
              onClick={() => chrome.onNavigate('booking-refund', { bookingId: cancelled.bookingId! }, { replace: true })}
            >
              <Icon name="logout" size={16} /> Refund or cancel booking
            </Button>
          )}
          <Button fullWidth variant="outline" onClick={() => chrome.onNavigate('games', undefined, { replace: true })}>
            Back to Open Play
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll pb-[130px]">
      {/* ── Hero ── */}
      <div className="detail-hero">
        <div className="img" style={{ backgroundImage: `url(${apiImageUrl(game.courtImage) || apiImageUrl(game.venue?.image) || '/fallback-game.png'})` }} />
        <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
          <CourtIllustration width={240} />
        </div>
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2">
            <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label="Share this Open Play">
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" onClick={toggleSave} aria-label={saved ? 'Remove from saved' : 'Save this Open Play'}>
              <Icon name={saved ? 'heart' : 'heart_o'} size={16} />
            </button>
          </div>
        </div>
        <div className="info">
          <div className="tag-row">
            {level !== 'All levels' && <span className="tag lime">{level}</span>}
            <span className="tag">Open Play</span>
            {restrictedTo && <span className="tag">{game.genderPolicy === 'women' ? '👩' : '👨'} {restrictedTo}</span>}
            {gameVibeLabel(game) && <span className="tag">{game.vibe === 'competitive' ? '🔥' : '😎'} {gameVibeLabel(game)}</span>}
          </div>
          <h1>{title}</h1>
          <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={14} /> {when}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} /> {venue}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {/* The "Type" tile was dropped — this screen only ever shows Open Play, and the
          hero already carries the Open Play tag. */}
      <div className="detail-body">
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Level</div>
            <div className="val">{level}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Interested</div>
            <div className={`val ${interestedCount > 0 ? 'lime' : ''}`}>
              {game.targetPlayers ? `${interestedCount} / ${game.targetPlayers}` : interestedCount}
            </div>
          </div>
        </div>

        {/* Host card */}
        <div className="organizer">
          <div className="meta" style={{ flex: 1 }}>
            <div className="role">Hosted by</div>
            <div className="name">{hostName}</div>
          </div>
        </div>

        {/* Location card — venue name + directions (the decorative map box was
            dropped: it never rendered a real map). */}
        <div className="location-card">
          <div className="map-info">
            <div className="text">
              <div className="name">{venue}</div>
            </div>
            <a
              className="directions"
              aria-label="Get directions"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="directions" size={18} />
            </a>
          </div>
        </div>

        {/* About */}
        <div className="about-card">
          <div className="t-eyebrow mb-1.5">About this Open Play</div>
          {game.description ? (
            <p>{game.description}</p>
          ) : (
            <p>Open Play{level !== 'All levels' ? ` · ${level}` : ''} at {venue}.</p>
          )}
          <p>
            {interestedCount > 0
              ? `${interestedCount} ${interestedCount === 1 ? 'player is' : 'players are'} interested so far${isHost ? '.' : ' — drop in if it suits you.'}`
              : isHost
                ? 'No one’s shown interest yet. Share it so players know it’s happening.'
                : 'No one’s shown interest yet. Tap “I’m Interested” to let others know you might come.'}
          </p>
        </div>

        {/* Interested people */}
        <div className="mb-[18px]">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="t-eyebrow">Interested</div>
              <div className="hd-3 mt-1">{interestWithTarget(game)}</div>
            </div>
          </div>
          {interested.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {interested.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar src={p.avatarUrl} name={p.displayName} size={36} />
                  <div className="text-[14px] font-semibold text-[var(--ink)]">
                    {p.displayName}{me && p.id === me.id ? ' (you)' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] font-semibold text-[var(--muted)]">
              Be the first to show interest.
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3 mb-4">
            <div className="text-[13px] font-bold text-[var(--coral)]">{error}</div>
          </div>
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-cta">
        <div className="price">
          <div className="eyebrow">Interested</div>
          <div className="amount">{interestedCount}</div>
        </div>
        {isHost ? (
          canManageGame ? (
            <button
              className="btn-join btn-leave"
              onClick={() => { setError(null); setConfirmCancelOpen(true); }}
              disabled={cancelling}
            >
              {cancelling ? (
                <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Cancelling…</>
              ) : (
                <><Icon name="close" size={16} /> Cancel session</>
              )}
            </button>
          ) : (
            <button className="btn-join joined" disabled>
              <Icon name="shield" size={16} /> You're hosting
            </button>
          )
        ) : (
          <button type="button" className={`btn-join ${isInterested ? 'btn-leave' : ''} ${blockedReason ? 'btn-locked' : ''}`} onClick={toggleInterest} disabled={busy || !!blockedReason}>
            {busy ? (
              <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> {isInterested ? 'Removing…' : 'Saving…'}</>
            ) : blockedReason ? (
              <><Icon name="lock" size={16} /> {blockedReason}</>
            ) : isInterested ? (
              <><Icon name="check" size={16} /> Interested</>
            ) : (
              <><Icon name="bolt" size={16} /> I'm Interested</>
            )}
          </button>
        )}
      </div>

      {canManageGame && (
      <BottomSheet open={confirmCancelOpen} onClose={() => setConfirmCancelOpen(false)} title="Cancel this Open Play?">
        <div className="px-1 pb-1">
          <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3.5 flex items-start gap-3">
            <Icon name="close" size={20} className="mt-0.5 shrink-0 text-[var(--coral)]" />
            <div>
              <div className="text-[14px] font-bold text-[var(--coral)] mb-0.5">It comes off Open Play</div>
              <p className="text-[13px] font-semibold text-[var(--coral)] leading-snug">
                {interestedCount > 0
                  ? `${interestedCount} ${interestedCount === 1 ? 'player who is' : 'players who are'} interested will be notified. Your court stays booked — you can request a refund or cancel the reservation on the next screen.`
                  : 'Your court stays booked — you can request a refund or cancel the reservation on the next screen.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)} disabled={cancelling}>Keep session</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? (
                <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Cancelling…</>
              ) : (
                'Cancel session'
              )}
            </Button>
          </div>
        </div>
      </BottomSheet>
      )}

      <ShareLobbySheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        gameId={game.id}
        title={gameTitle(game)}
        subtitle={[timeLine(game), gameLocation(game), interestLabel(game)].filter(Boolean).join(' · ')}
        image={apiImageUrl(game.courtImage) || apiImageUrl(game.venue?.image) || '/fallback-game.png'}
        gameType={gameTypeLabel(game)}
        skillLabel={game.skillLabel ?? undefined}
        dateTime={[dayParts(game).day === 'TODAY' ? 'Today' : dayParts(game).day === 'TOM' ? 'Tomorrow' : dayParts(game).day, timeLine(game)].filter(Boolean).join(' · ') || undefined}
        venue={gameLocation(game)}
        onNavigate={chrome.onNavigate}
        onInvite={() => setInviteOpen(true)}
      />
      <InvitePlayersSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        gameId={game.id}
      />
    </div>
  );
}

/* ─── Organizer-created Open Play session detail (ApiOpenPlaySession — unchanged) ─── */

function OrganizerOpenPlayDetail({ id, chrome, onBack }: { id: string; chrome: V2ScreenChrome; onBack: () => void }) {
  const me = useAuthStore((s) => s.user);
  const [session, setSession] = useState<ApiOpenPlaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pb-saved-games') || '[]').includes(id); } catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    getOpenPlaySession(id)
      .then((row) => { if (alive) setSession(row); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this Open Play session.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  // Interest-based: "registered" now means "interested" (no capacity/waitlist).
  const isInterested = session?.myRegistrationStatus === 'registered';
  const interested: ApiGamePerson[] = session?.interestedUsers ?? [];
  const interestedCount = session?.interestedCount ?? session?.joinedCount ?? interested.length;

  // Skill eligibility: a level-restricted session only admits a matching DUPR.
  // Already-interested players are past the gate (they can always withdraw).
  const blockedReason = isInterested
    ? null
    : skillBlockReason(session?.skillLevelMin, session?.skillLevelMax, me?.skillLevel, !!me);

  const toggleInterest = async () => {
    if (!session || busy || blockedReason) return;
    if (!isInterested && !chrome.requireAuth('show interest')) return;
    setBusy(true);
    setError(null);
    try {
      if (isInterested) await leaveOpenPlaySession(session.id);
      else await joinOpenPlaySession(session.id);
      // Refetch so the interested list + count stay authoritative.
      const fresh = await getOpenPlaySession(session.id);
      setSession(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your interest.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = () => {
    if (!session) return;
    try {
      const cur: string[] = JSON.parse(localStorage.getItem('pb-saved-games') || '[]');
      const next = cur.includes(session.id) ? cur.filter((x) => x !== session.id) : [...cur, session.id];
      localStorage.setItem('pb-saved-games', JSON.stringify(next));
      setSaved(next.includes(session.id));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="scroll safe-top safe-bottom">
        <div className="detail-hero" style={{ minHeight: 140 }}>
          <div className="img" style={{ backgroundImage: `url(/fallback-game.png)` }} />
          <div className="grad" />
          <div className="top-controls">
            <button className="icon-btn" onClick={onBack} aria-label="Back">
              <Icon name="back" size={18} />
            </button>
          </div>
        </div>
        <EmptyState icon="calendar" title="Open Play not found" description={error || 'This session may have been cancelled.'} action={{ label: 'Back to Open Play', onPress: onBack }} />
      </div>
    );
  }

  return (
    <div className="scroll pb-[130px]">
      {/* ── Hero ── */}
      <div className="detail-hero">
        <div className="img" style={{ backgroundImage: `url(/fallback-game.png)` }} />
        <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
          <CourtIllustration width={240} />
        </div>
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2">
            <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label="Share this Open Play">
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" onClick={toggleSave} aria-label={saved ? 'Remove from saved' : 'Save this Open Play'}>
              <Icon name={saved ? 'heart' : 'heart_o'} size={16} />
            </button>
          </div>
        </div>
        <div className="info">
          <div className="tag-row">
            {session.levelLabel && <span className="tag lime">{session.levelLabel}</span>}
            <span className="tag">Open Play</span>
          </div>
          <h1>{session.title || 'Open Play'}</h1>
          <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={14} /> {sessionWhen(session)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} /> {session.venueName || 'Venue TBA'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="detail-body">
        {/* KV grid */}
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Level</div>
            <div className="val">{session.levelLabel || 'All levels'}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Price</div>
            <div className="val">{money(Number(session.price ?? 0), 'PHP')}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Interested</div>
            <div className={`val ${interestedCount > 0 ? 'lime' : ''}`}>{interestedCount}</div>
          </div>
        </div>

        {/* Organizer card */}
        {session.organizerName && (
          <div className="organizer">
            <div className="meta" style={{ flex: 1 }}>
              <div className="role">Organized by</div>
              <div className="name">{session.organizerName}</div>
            </div>
          </div>
        )}

        {/* Location card — venue name + directions (decorative map box dropped). */}
        <div className="location-card">
          <div className="map-info">
            <div className="text">
              <div className="name">{session.venueName || 'Venue TBA'}</div>
            </div>
            {session.venueName && (
              <a
                className="directions"
                aria-label="Get directions"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.venueName)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="directions" size={18} />
              </a>
            )}
          </div>
        </div>

        {/* About */}
        <div className="about-card">
          <div className="t-eyebrow mb-1.5">About this session</div>
          {session.description ? (
            <p>{session.description}</p>
          ) : (
            <p>
              Open Play session{ session.levelLabel ? ` · ${session.levelLabel}` : ''}
              {session.venueName ? ` at ${session.venueName}` : ''}.
            </p>
          )}
          <p>
            {interestedCount > 0
              ? `${interestedCount} ${interestedCount === 1 ? 'player is' : 'players are'} interested so far.`
              : 'No one’s shown interest yet.'}
          </p>
        </div>

        {/* Interested people */}
        <div className="mb-[18px]">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="t-eyebrow">Interested</div>
              <div className="hd-3 mt-1">{interestedCount > 0 ? `${interestedCount} interested` : 'No interest yet'}</div>
            </div>
          </div>
          {interested.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {interested.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar src={p.avatarUrl} name={p.displayName} size={36} />
                  <div className="text-[14px] font-semibold text-[var(--ink)]">
                    {p.displayName}{me && p.id === me.id ? ' (you)' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] font-semibold text-[var(--muted)]">
              Be the first to show interest.
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3 mb-4">
            <div className="text-[13px] font-bold text-[var(--coral)]">{error}</div>
          </div>
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-cta">
        <div className="price">
          <div className="eyebrow">Interested</div>
          <div className="amount">{interestedCount}</div>
        </div>
        <button type="button" className={`btn-join ${isInterested ? 'btn-leave' : ''} ${blockedReason ? 'btn-locked' : ''}`} onClick={toggleInterest} disabled={busy || !!blockedReason}>
          {busy ? (
            <>
              <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
              {isInterested ? 'Removing…' : 'Saving…'}
            </>
          ) : blockedReason ? (
            <>
              <Icon name="lock" size={16} />
              {blockedReason}
            </>
          ) : isInterested ? (
            <>
              <Icon name="check" size={16} />
              Interested
            </>
          ) : (
            <>
              <Icon name="bolt" size={16} />
              I'm Interested
            </>
          )}
        </button>
      </div>

      {session && (
        <ShareLobbySheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          gameId={session.id}
          title={session.title || 'Open Play'}
          subtitle={[sessionWhen(session), session.venueName].filter(Boolean).join(' · ')}
          image="/fallback-game.png"
          gameType="Open Play"
          skillLabel={session.levelLabel ?? undefined}
          dateTime={sessionWhen(session)}
          venue={session.venueName}
          onNavigate={chrome.onNavigate}
          onInvite={() => setInviteOpen(true)}
        />
      )}
      <InvitePlayersSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        gameId={id}
      />
    </div>
  );
}
