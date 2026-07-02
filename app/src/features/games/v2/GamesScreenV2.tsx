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
  return [prettyDate(g.date), g.timeLabel || g.whenLabel].filter(Boolean).join(' - ') || 'Time TBA';
}
function gameSpots(g: ApiGame): string {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  return cap > 0 ? joined + '/' + cap + ' joined' : joined + ' joined';
}
function tournamentTitle(t: ApiTournament): string { return t.name || 'Organizer game'; }
function tournamentWhen(t: ApiTournament): string {
  return [prettyDate(t.startDate), t.startTime ? to12h(t.startTime) : null].filter(Boolean).join(' - ') || 'Schedule TBA';
}
function tournamentMeta(t: ApiTournament): string {
  return [t.format || t.tournamentType || 'Tournament', t.venueName, t.maxPlayers ? String(t.registeredCount ?? t.registeredPlayers ?? 0) + '/' + String(t.maxPlayers) + ' joined' : null].filter(Boolean).join(' - ');
}
function sessionWhen(s: ApiOpenPlaySession): string {
  return [prettyDate(s.date), s.startTime ? to12h(s.startTime) : null].filter(Boolean).join(' - ') || 'Schedule TBA';
}
function sessionMeta(s: ApiOpenPlaySession): string {
  const cap = s.capacity ?? 0;
  const joined = s.joinedCount ?? 0;
  const spots = cap > 0 ? joined + '/' + cap + ' joined' : joined + ' joined';
  return [s.venueName, s.levelLabel, spots, money(Number(s.price ?? 0), 'PHP')].filter(Boolean).join(' - ');
}
function bookingTitle(b: ApiBooking): string { return b.venueName || 'Booked court'; }
function bookingMeta(b: ApiBooking): string {
  const court = b.courtName || (b.courtNumber ? 'Court ' + b.courtNumber : null);
  return [prettyDate(b.date), bookingTimeRange(b), court, b.status].filter(Boolean).join(' - ');
}
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

  const gamesDiscover = useMemo(() => tournaments.filter((t) => isActiveTournament(t) && !tournamentRegs.has(t.id)), [tournaments, tournamentRegs]);
  const gamesJoined = useMemo(() => tournaments.filter((t) => tournamentRegs.has(t.id)), [tournaments, tournamentRegs]);
  const openDiscoverGames = useMemo(() => publicGames.filter((g) => !mineGameIds.has(g.id)), [publicGames, mineGameIds]);
  const openDiscoverSessions = useMemo(() => openSessions.filter((s) => !openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const openJoinedSessions = useMemo(() => openSessions.filter((s) => openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const privateBookings = useMemo(() => bookings.filter((b) => b.bookingType !== 'open_play'), [bookings]);

  const selectSection = (next: Section) => {
    setSection(next);
    setView(next === 'booked' ? 'manage' : 'discover');
  };
  const selectView = (next: View) => setView(next);

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
    ? 'Organizer-created tournaments, brackets, and structured games.'
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
              {(section === 'games' ? ['discover', 'joined'] : ['discover', 'joined', 'manage'] as View[]).map((key) => (
                <button key={key} className={'seg-btn' + (view === key ? ' active' : '')} role="tab" aria-selected={view === key} onClick={() => selectView(key as View)}>
                  {key === 'discover' ? 'Discover' : key === 'joined' ? 'Joined' : 'Manage'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? <V2Skeleton variant="game-list" count={5} /> : null}
        {!loading && section === 'games' && view === 'discover' && <TournamentList rows={gamesDiscover} empty="No organizer games available." onOpen={(t) => onNavigate('tournament', { id: t.slug || t.id })} />}
        {!loading && section === 'games' && view === 'joined' && <TournamentList rows={gamesJoined} empty="Structured games you join show up here." onOpen={(t) => onNavigate('tournament', { id: t.slug || t.id })} />}
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
    </V2Shell>
  );
}

function Empty({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-ring">--</div>
      <h3>No items here yet</h3>
      <p>{text}</p>
      {action && <button className="empty-cta" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

function TournamentList({ rows, empty, onOpen }: { rows: ApiTournament[]; empty: string; onOpen: (t: ApiTournament) => void }) {
  if (!rows.length) return <Empty text={empty} />;
  return <>{rows.map((t) => <button key={t.id} className="game-card" type="button" onClick={() => onOpen(t)}><div className="game-thumb"><span className="game-type-badge badge-competitive">Games</span></div><div className="game-body"><div className="game-title">{tournamentTitle(t)}</div><div className="game-meta"><div className="game-meta-row">{tournamentWhen(t)}</div><div className="game-meta-row">{tournamentMeta(t)}</div></div></div></button>)}</>;
}

function OpenPlayDiscover({ games, sessions, onNavigate }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate'] }) {
  if (!games.length && !sessions.length) return <Empty text="No Open Play sessions available." />;
  return <>{sessions.map((s) => <SessionCard key={'session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'game-' + g.id} game={g} badge="Open Play" onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} />)}</>;
}
function OpenPlayJoined({ games, sessions, onNavigate, onLeave, busyId }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate']; onLeave: (g: ApiGame) => void; busyId: string | null }) {
  if (!games.length && !sessions.length) return <Empty text="Open Play sessions you join show up here." />;
  return <>{sessions.map((s) => <SessionCard key={'joined-session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'joined-game-' + g.id} game={g} badge="Joined" onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={canLeaveLobby(g) ? { label: busyId === g.id ? 'Leaving...' : 'Leave', onClick: () => onLeave(g) } : { label: 'Spot locked', onClick: () => undefined }} />)}</>;
}
function OpenPlayManage({ games, onNavigate, onDelete, busyId }: { games: ApiGame[]; onNavigate: V2ScreenChrome['onNavigate']; onDelete: (g: ApiGame) => void; busyId: string | null }) {
  if (!games.length) return <Empty text="Open Play sessions you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />;
  return <>{games.map((g) => <GameCard key={'manage-game-' + g.id} game={g} badge="Managing" onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={{ label: busyId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => onDelete(g) }} />)}</>;
}
function BookedManage({ bookings, onNavigate }: { bookings: ApiBooking[]; onNavigate: V2ScreenChrome['onNavigate'] }) {
  if (!bookings.length) return <Empty text="No bookings yet." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />;
  return <>{bookings.map((b) => <article key={b.id} className="game-card"><div className="game-thumb"><span className="game-type-badge badge-open">Booked</span></div><div className="game-body"><div className="game-title">{bookingTitle(b)}</div><div className="game-meta"><div className="game-meta-row">{bookingMeta(b)}</div></div>{canPublishBooking(b) && <div className="game-actions"><button type="button" className="game-action-btn" onClick={() => onNavigate('create-game', { bookingId: b.id })}>Make Open Play</button></div>}</div></article>)}</>;
}

function SessionCard({ session, onClick }: { session: ApiOpenPlaySession; onClick: () => void }) {
  return <button className="game-card" type="button" onClick={onClick}><div className="game-thumb"><span className="game-type-badge badge-open">Open Play</span></div><div className="game-body"><div className="game-title">{session.title || 'Open Play'}</div><div className="game-meta"><div className="game-meta-row">{sessionWhen(session)}</div><div className="game-meta-row">{sessionMeta(session)}</div></div></div></button>;
}
function GameCard({ game, badge, onClick, action }: { game: ApiGame; badge: string; onClick: () => void; action?: { label: string; onClick: () => void } }) {
  const img = gameImage(game);
  return <article className="game-card" role="button" tabIndex={0} onClick={onClick}><div className="game-thumb" style={img ? { backgroundImage: 'url(' + img + ')', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className="game-type-badge badge-open">{badge}</span></div><div className="game-body"><div className="game-title">{gameTitle(game)}</div><div className="game-meta"><div className="game-meta-row">{gameWhen(game)}</div><div className="game-meta-row">{gameVenue(game)} - {gameSpots(game)}</div></div>{action && <div className="game-actions" onClick={(e) => e.stopPropagation()}><button type="button" className="game-action-btn" onClick={action.onClick}>{action.label}</button></div>}</div></article>;
}
