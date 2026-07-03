import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import {
  apiImageUrl, deleteGame, leaveGame, listBookings, listGames,
  listMyOpenPlayRegistrations, listMyTournamentRegistrations,
  listOpenPlaySessions, listPublicTournaments,
  type ApiBooking, type ApiGame, type ApiOpenPlaySession, type ApiTournament,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { prettyDate, timeRange as bookingTimeRange, to12h, money } from '../../bookings/bookingDisplay';
import { canLeaveLobby } from '../gameDisplay';

type Section = 'games' | 'open-play' | 'booked';
type View = 'discover' | 'joined' | 'manage';

interface GamesScreenV2Props extends V2ScreenChrome {
  initialSection?: Section;
  initialView?: View;
}

function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}
function gameTitle(g: ApiGame): string { return (g.title && g.title.trim()) || 'Open Play'; }
function gameVenue(g: ApiGame): string { return g.venue?.displayName || g.venueName || 'Venue TBA'; }
function gameWhen(g: ApiGame): string {
  return [prettyDate(g.date), g.timeLabel || g.whenLabel].filter(Boolean).join(' · ') || 'Time TBA';
}
function gameVenueLoc(g: ApiGame): string {
  const v = g.venue;
  return v ? [v.area, v.city].filter(Boolean).join(' · ') : '';
}
function typeBadge(g: ApiGame): { cls: string; label: string } {
  const t = (g.gameType || '').toLowerCase();
  if (t === 'doubles') return { cls: 'badge-competitive', label: 'Doubles' };
  if (t === 'singles') return { cls: 'badge-social', label: 'Singles' };
  return { cls: 'badge-open', label: 'Open Play' };
}
function slots(g: ApiGame): { joined: number; cap: number; pct: number; almost: boolean } {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct, almost: cap > 0 && g.spotsLeft != null && g.spotsLeft <= 1 };
}
function tournamentTitle(t: ApiTournament): string { return t.name || 'Organizer game'; }
function tournamentWhen(t: ApiTournament): string {
  return [prettyDate(t.startDate), t.startTime ? to12h(t.startTime) : null].filter(Boolean).join(' · ') || 'Schedule TBA';
}
function tournamentMeta(t: ApiTournament): string {
  return [t.format || t.tournamentType || 'Tournament', t.venueName].filter(Boolean).join(' · ') || 'Venue TBA';
}
function tournamentSlots(t: ApiTournament): { registered: number; max: number; pct: number } {
  const max = Number(t.maxPlayers ?? 0);
  const registered = Number(t.registeredCount ?? t.registeredPlayers ?? 0);
  const pct = max > 0 ? Math.min(100, Math.round((registered / max) * 100)) : 0;
  return { registered, max, pct };
}
function sessionWhen(s: ApiOpenPlaySession): string {
  return [prettyDate(s.date), s.startTime ? to12h(s.startTime) : null].filter(Boolean).join(' · ') || 'Schedule TBA';
}
function sessionMeta(s: ApiOpenPlaySession): string {
  return [s.venueName, s.levelLabel, money(Number(s.price ?? 0), 'PHP')].filter(Boolean).join(' · ');
}
function sessionSlots(s: ApiOpenPlaySession): { joined: number; cap: number; pct: number } {
  const cap = s.capacity ?? 0;
  const joined = s.joinedCount ?? 0;
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct };
}
function bookingTitle(b: ApiBooking): string { return b.venueName || 'Booked court'; }
function canPublishBooking(b: ApiBooking): boolean {
  const status = (b.status || '').toLowerCase();
  return status === 'confirmed' || status === 'paid';
}
function isActiveTournament(t: ApiTournament): boolean {
  return !['completed', 'cancelled', 'closed'].includes(String(t.status || '').toLowerCase());
}

export function GamesScreenV2(chrome: GamesScreenV2Props) {
  const { onNavigate, isLoggedIn, initialSection = 'games', initialView = 'discover' } = chrome;
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? null;

  const [section, setSection] = useState<Section>(initialSection);
  const [view, setView] = useState<View>(initialSection === 'booked' ? 'manage' : initialView);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [tournamentRegs, setTournamentRegs] = useState<Set<string>>(new Set());
  const [openSessions, setOpenSessions] = useState<ApiOpenPlaySession[]>([]);
  const [openSessionRegs, setOpenSessionRegs] = useState<Set<string>>(new Set());
  const [publicGames, setPublicGames] = useState<ApiGame[]>([]);
  const [mineGames, setMineGames] = useState<ApiGame[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);

  useEffect(() => {
    setSection(initialSection);
    setView(initialSection === 'booked' ? 'manage' : initialView);
  }, [initialSection, initialView]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      listPublicTournaments().catch(() => [] as ApiTournament[]),
      listOpenPlaySessions().catch(() => [] as ApiOpenPlaySession[]),
      listGames({ status: 'published' }).catch(() => [] as ApiGame[]),
      isLoggedIn ? listGames({ mine: true }).catch(() => [] as ApiGame[]) : Promise.resolve([] as ApiGame[]),
      isLoggedIn ? listBookings().catch(() => [] as ApiBooking[]) : Promise.resolve([] as ApiBooking[]),
      isLoggedIn ? listMyTournamentRegistrations().catch(() => []) : Promise.resolve([]),
      isLoggedIn ? listMyOpenPlayRegistrations().catch(() => []) : Promise.resolve([]),
    ]).then(([ts, sessions, games, mine, bks, tRegs, sRegs]) => {
      if (!alive) return;
      setTournaments(ts);
      setOpenSessions(sessions);
      setPublicGames(games);
      setMineGames(mine);
      setBookings(bks);
      setTournamentRegs(new Set(tRegs.map((r) => r.tournamentId).filter(Boolean)));
      setOpenSessionRegs(new Set(sRegs.map((r) => r.sessionId).filter(Boolean)));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  const createdOpenGames = useMemo(() => mineGames.filter((g) => !!myId && g.creatorId === myId), [mineGames, myId]);
  const joinedOpenGames = useMemo(() => mineGames.filter((g) => !(myId && g.creatorId === myId)), [mineGames, myId]);
  const mineGameIds = useMemo(() => new Set(mineGames.map((g) => g.id)), [mineGames]);

  const gamesDiscover = useMemo(() => publicGames.filter((g) => !mineGameIds.has(g.id)), [publicGames, mineGameIds]);
  const gamesJoined = useMemo(() => joinedOpenGames, [joinedOpenGames]);
  const openDiscoverGames = useMemo(() => publicGames.filter((g) => !mineGameIds.has(g.id)), [publicGames, mineGameIds]);
  const openDiscoverSessions = useMemo(() => openSessions.filter((s) => !openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const openJoinedSessions = useMemo(() => openSessions.filter((s) => openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const privateBookings = useMemo(() => bookings.filter((b) => b.bookingType !== 'open_play'), [bookings]);

  const selectSection = (next: Section) => {
    setSection(next);
    setView(next === 'booked' ? 'manage' : 'discover');
  };
  const selectView = (next: View) => setView(next);

  // Persist the active tab in the URL so it survives browser Back from a detail page.
  useEffect(() => {
    const params = new URLSearchParams();
    if (section !== 'games' || view !== 'discover') {
      params.set('section', section);
      if (view !== 'discover') params.set('view', view);
    }
    const qs = params.toString();
    const url = `/games${qs ? `?${qs}` : ''}`;
    if (window.location.pathname + window.location.search !== url) {
      window.history.replaceState({ ...window.history.state }, '', url);
    }
  }, [section, view]);

  const leaveOpenGame = async (g: ApiGame) => {
    if (!canLeaveLobby(g)) return;
    setActionId(g.id);
    setActionError(null);
    try {
      await leaveGame(g.id);
      setMineGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not leave this Open Play.');
    } finally {
      setActionId(null);
    }
  };
  const deleteOpenGame = async (g: ApiGame) => {
    setActionId(g.id);
    setActionError(null);
    try {
      await deleteGame(g.id, { keepBooking: true });
      setMineGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not remove this Open Play.');
    } finally {
      setActionId(null);
    }
  };

  const subheading = section === 'games'
    ? 'Player-created open play games. Book a court first, then host.'
    : section === 'open-play'
      ? 'Public sessions and player bookings other players can join.'
      : 'Your private court and venue bookings.';

  return (
    <V2Shell screen="v2-games" chrome={chrome}>
      <div className="page-content">
        <div className="games-intro">
          <h1 className="games-heading">Games</h1>
          <p className="games-subheading">{subheading}</p>
        </div>

        <div className="tab-group-row">
          <div className="tab-group" role="tablist" aria-label="Games sections">
            {(['games', 'open-play', 'booked'] as Section[]).map((key) => (
              <button key={key} className={'seg-btn' + (section === key ? ' active' : '')} role="tab" aria-selected={section === key} onClick={() => selectSection(key)}>
                {key === 'games' ? 'Games' : key === 'open-play' ? 'Open Play' : 'Booked'}
              </button>
            ))}
          </div>
        </div>

        {section !== 'booked' && (
          <div className="tab-group-row">
            <div className="tab-group" role="tablist" aria-label="Games view">
              {(section === 'games' ? ['discover', 'joined', 'manage'] : ['discover', 'joined', 'manage'] as View[]).map((key) => (
                <button key={key} className={'seg-btn' + (view === key ? ' active' : '')} role="tab" aria-selected={view === key} onClick={() => selectView(key as View)}>
                  {key === 'discover' ? 'Discover' : key === 'joined' ? 'Joined' : 'Manage'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="games-list-scroll">
          {loading ? <V2Skeleton variant="game-list" count={5} /> : null}
          {!loading && section === 'games' && view === 'discover' && (
            gamesDiscover.length === 0
              ? <Empty text="No open games available." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />
              : gamesDiscover.map((g) => <GameCard key={'discover-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} />)
          )}
          {!loading && section === 'games' && view === 'joined' && (
            gamesJoined.length === 0
              ? <Empty text="Games you join show up here." />
              : gamesJoined.map((g) => <GameCard key={'joined-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={canLeaveLobby(g) ? { label: actionId === g.id ? 'Leaving...' : 'Leave', onClick: () => leaveOpenGame(g) } : { label: 'Spot locked', onClick: () => undefined }} />)
          )}
          {!loading && section === 'games' && view === 'manage' && (
            createdOpenGames.length === 0
              ? <Empty text="Games you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />
              : createdOpenGames.map((g) => <GameCard key={'manage-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={{ label: actionId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => deleteOpenGame(g) }} />)
          )}
          {!loading && section === 'open-play' && view === 'discover' && (
            <OpenPlayDiscover games={openDiscoverGames} sessions={openDiscoverSessions} onNavigate={onNavigate} />
          )}
          {!loading && section === 'open-play' && view === 'joined' && (
            <OpenPlayJoined games={joinedOpenGames} sessions={openJoinedSessions} onNavigate={onNavigate} onLeave={leaveOpenGame} busyId={actionId} />
          )}
          {!loading && section === 'open-play' && view === 'manage' && (
            <OpenPlayManage games={createdOpenGames} onNavigate={onNavigate} onDelete={deleteOpenGame} busyId={actionId} />
          )}
          {!loading && section === 'booked' && (
            <BookedManage bookings={privateBookings} onNavigate={onNavigate} />
          )}
          {actionError && <div className="vis-help" style={{ color: 'var(--warning)' }} role="alert">{actionError}</div>}
        </div>
      </div>
    </V2Shell>
  );
}

function Empty({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-ring">🎾</div>
      <h3>No items here yet</h3>
      <p>{text}</p>
      {action && <button className="empty-cta" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card components — rich layout matching the original v2 game-card   */
/* design: 112px thumb + badge, SVG icons in meta rows, fill track    */
/* for capacity, and a bordered action strip at the bottom.           */
/* ------------------------------------------------------------------ */

const CLOCK_SVG = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const PIN_SVG = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;

function TournamentList({ rows, empty, onOpen }: { rows: ApiTournament[]; empty: string; onOpen: (t: ApiTournament) => void }) {
  if (!rows.length) return <Empty text={empty} />;
  return <>{rows.map((t) => {
    const s = tournamentSlots(t);
    return (
      <button key={t.id} className="game-card" type="button" onClick={() => onOpen(t)}>
        <div className="game-thumb">
          <span className="game-type-badge badge-competitive">Games</span>
        </div>
        <div className="game-body">
          <div className="game-title">{tournamentTitle(t)}</div>
          <div className="game-meta">
            <div className="game-meta-row">{CLOCK_SVG}{tournamentWhen(t)}</div>
            <div className="game-meta-row">{PIN_SVG}{tournamentMeta(t)}</div>
          </div>
          {s.max > 0 && (
            <div className="players-row">
              <div className="fill-track"><div className="fill-bar" style={{ width: `${s.pct}%` }} /></div>
              <span className={`players-label${s.pct >= 95 ? ' near-full' : ''}`}>{s.registered}/{s.max}</span>
            </div>
          )}
        </div>
      </button>
    );
  })}</>;
}

function SessionCard({ session, onClick }: { session: ApiOpenPlaySession; onClick: () => void }) {
  const s = sessionSlots(session);
  return (
    <button className="game-card" type="button" onClick={onClick}>
      <div className="game-thumb">
        <span className="game-type-badge badge-open">Open Play</span>
      </div>
      <div className="game-body">
        <div className="game-title">{session.title || 'Open Play'}</div>
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{sessionWhen(session)}</div>
          <div className="game-meta-row">{PIN_SVG}{sessionMeta(session)}</div>
        </div>
        {s.cap > 0 && (
          <div className="players-row">
            <div className="fill-track"><div className="fill-bar" style={{ width: `${s.pct}%` }} /></div>
            <span className={`players-label${s.pct >= 95 ? ' near-full' : ''}`}>{s.joined}/{s.cap}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function GameCard({ game, onClick, action }: { game: ApiGame; onClick: () => void; action?: { label: string; onClick: () => void } }) {
  const img = gameImage(game);
  const badge = typeBadge(game);
  const s = slots(game);
  return (
    <article className="game-card" role="button" tabIndex={0} onClick={onClick}>
      <div className="game-thumb" style={img ? { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <span className={`game-type-badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="game-body">
        <div className="game-title">{gameTitle(game)}</div>
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{gameWhen(game)}</div>
          <div className="game-meta-row">{PIN_SVG}{gameVenue(game)}</div>
          {gameVenueLoc(game) && <div className="game-meta-loc">{gameVenueLoc(game)}</div>}
        </div>
        {s.cap > 0 && (
          <div className="players-row">
            <div className="fill-track"><div className={`fill-bar${s.almost ? ' near-full' : ''}`} style={{ width: `${s.pct}%` }} /></div>
            <span className={`players-label${s.almost ? ' near-full' : ''}`}>{s.joined}/{s.cap}</span>
          </div>
        )}
        {action && (
          <div className="game-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="game-action-btn" onClick={action.onClick}>{action.label}</button>
          </div>
        )}
      </div>
    </article>
  );
}

function OpenPlayDiscover({ games, sessions, onNavigate }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate'] }) {
  if (!games.length && !sessions.length) return <Empty text="No Open Play sessions available." />;
  return <>{sessions.map((s) => <SessionCard key={'session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'game-' + g.id} game={g} onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} />)}</>;
}
function OpenPlayJoined({ games, sessions, onNavigate, onLeave, busyId }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate']; onLeave: (g: ApiGame) => void; busyId: string | null }) {
  if (!games.length && !sessions.length) return <Empty text="Open Play sessions you join show up here." />;
  return <>{sessions.map((s) => <SessionCard key={'joined-session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'joined-game-' + g.id} game={g} onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={canLeaveLobby(g) ? { label: busyId === g.id ? 'Leaving...' : 'Leave', onClick: () => onLeave(g) } : { label: 'Spot locked', onClick: () => undefined }} />)}</>;
}
function OpenPlayManage({ games, onNavigate, onDelete, busyId }: { games: ApiGame[]; onNavigate: V2ScreenChrome['onNavigate']; onDelete: (g: ApiGame) => void; busyId: string | null }) {
  if (!games.length) return <Empty text="Open Play sessions you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />;
  return <>{games.map((g) => <GameCard key={'manage-game-' + g.id} game={g} onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={{ label: busyId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => onDelete(g) }} />)}</>;
}
function BookedManage({ bookings, onNavigate }: { bookings: ApiBooking[]; onNavigate: V2ScreenChrome['onNavigate'] }) {
  if (!bookings.length) return <Empty text="No bookings yet." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />;
  return <>{bookings.map((b) => {
    const court = b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : null);
    return (
      <article key={b.id} className="game-card">
        <div className="game-thumb">
          <span className="game-type-badge badge-open">Booked</span>
        </div>
        <div className="game-body">
          <div className="game-title">{bookingTitle(b)}</div>
          <div className="game-meta">
            <div className="game-meta-row">{CLOCK_SVG}{[prettyDate(b.date), bookingTimeRange(b)].filter(Boolean).join(' · ')}</div>
            <div className="game-meta-row">{PIN_SVG}{[court, b.status].filter(Boolean).join(' · ')}</div>
          </div>
          {canPublishBooking(b) && (
            <div className="game-actions">
              <button type="button" className="game-action-btn" onClick={() => onNavigate('create-game', { bookingId: b.id })}>Make Open Play</button>
            </div>
          )}
        </div>
      </article>
    );
  })}</>;
}
