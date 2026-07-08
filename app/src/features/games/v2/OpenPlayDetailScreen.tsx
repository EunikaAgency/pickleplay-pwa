import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { CourtIllustration } from '../../../shared/components/ui/CourtIllustration';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ShareLobbySheet } from '../../../shared/components/ui/ShareLobbySheet';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { InvitePlayersSheet } from '../InvitePlayersSheet';
import { GameDetailsScreen } from '../GameDetailsScreen';
import { type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import {
  getGame, toggleGameInterest, apiImageUrl,
  getOpenPlaySession, joinOpenPlaySession, leaveOpenPlaySession,
  type ApiGame, type ApiGamePerson, type ApiOpenPlaySession,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { money, prettyDate, to12h } from '../../bookings/bookingDisplay';
import { dayParts, gameTitle, gameTypeLabel, gameVibeLabel, gameLocation, interestLabel, interestWithTarget, timeLine } from '../gameDisplay';

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
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pb-saved-games') || '[]').includes(initialGame.id); } catch { return false; }
  });

  // Open Play is interest-based: no roster/slots, just a soft "I'm Interested" signal.
  const interested: ApiGamePerson[] = game.interestedUsers ?? [];
  const isInterested = !!(me && interested.some((p) => p.id === me.id));
  const interestedCount = game.interestedCount ?? interested.length;

  const toggleInterest = async () => {
    if (!game || busy) return;
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
              ? `${interestedCount} ${interestedCount === 1 ? 'player is' : 'players are'} interested so far — drop in if it suits you.`
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
        <button className={`btn-join ${isInterested ? 'btn-leave' : ''}`} onClick={toggleInterest} disabled={busy}>
          {busy ? (
            <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> {isInterested ? 'Removing…' : 'Saving…'}</>
          ) : isInterested ? (
            <><Icon name="check" size={16} /> Interested</>
          ) : (
            <><Icon name="bolt" size={16} /> I'm Interested</>
          )}
        </button>
      </div>

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

  const toggleInterest = async () => {
    if (!session || busy) return;
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
        <button className={`btn-join ${isInterested ? 'btn-leave' : ''}`} onClick={toggleInterest} disabled={busy}>
          {busy ? (
            <>
              <span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span>
              {isInterested ? 'Removing…' : 'Saving…'}
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
