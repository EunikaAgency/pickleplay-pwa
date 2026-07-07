import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import {
  apiImageUrl, createGame, declineGameInvite, deleteGame, joinGame, leaveGame, listBookings, listGames,
  listMyOpenPlayRegistrations, listMyTournamentRegistrations,
  listOpenPlaySessions, listPublicTournaments,
  type ApiBooking, type ApiGame, type ApiOpenPlaySession, type ApiTournament,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { useInviteStore } from '../../../shared/lib/inviteStore';
import { onRealtime } from '../../../shared/lib/realtimeBus';
import { prettyDate, timeRange as bookingTimeRange, to12h, money, statusChip } from '../../bookings/bookingDisplay';
import { canLeaveLobby, gameFormatLabel, interestLabel } from '../gameDisplay';

type Section = 'games' | 'open-play';
type View = 'discover' | 'joined' | 'invites' | 'manage';

interface GamesScreenV2Props extends V2ScreenChrome {
  initialSection?: Section;
  initialView?: View;
}

const FALLBACK_GAME_IMG = '/fallback-game.png';

function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

/** Returns the CSS url() value for a game thumb background, falling back to the default image. */
function gameThumbBg(g: ApiGame): string {
  return `url(${gameImage(g) || FALLBACK_GAME_IMG})`;
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
  if (t === 'public') return { cls: 'badge-competitive', label: gameFormatLabel(g) || 'Public game' };
  return { cls: 'badge-open', label: 'Open Play' };
}
function slots(g: ApiGame): { joined: number; cap: number; pct: number; almost: boolean } {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct, almost: cap > 0 && g.spotsLeft != null && g.spotsLeft <= 1 };
}

/** Open Play games have gameType 'open' (player-published bookings, no lobby).
 *  Public Games have gameType 'singles' or 'doubles' (organizer-created, has lobby).
 *  Games with no gameType default to 'open'. */
function isOpenPlayGame(g: ApiGame): boolean {
  return ((g.gameType || '').toLowerCase() || 'open') === 'open';
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
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [tournamentRegs, setTournamentRegs] = useState<Set<string>>(new Set());
  const [openSessions, setOpenSessions] = useState<ApiOpenPlaySession[]>([]);
  const [openSessionRegs, setOpenSessionRegs] = useState<Set<string>>(new Set());
  const [publicGames, setPublicGames] = useState<ApiGame[]>([]);
  const [mineGames, setMineGames] = useState<ApiGame[]>([]);
  const [invitedGames, setInvitedGames] = useState<ApiGame[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setView(initialView);
  }, [initialSection, initialView]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      listPublicTournaments().catch(() => [] as ApiTournament[]),
      listOpenPlaySessions().catch(() => [] as ApiOpenPlaySession[]),
      listGames({ status: 'published' }).catch(() => [] as ApiGame[]),
      isLoggedIn ? listGames({ mine: true }).catch(() => [] as ApiGame[]) : Promise.resolve([] as ApiGame[]),
      isLoggedIn ? listGames({ invited: true }).catch(() => [] as ApiGame[]) : Promise.resolve([] as ApiGame[]),
      isLoggedIn ? listBookings().catch(() => [] as ApiBooking[]) : Promise.resolve([] as ApiBooking[]),
      isLoggedIn ? listMyTournamentRegistrations().catch(() => []) : Promise.resolve([]),
      isLoggedIn ? listMyOpenPlayRegistrations().catch(() => []) : Promise.resolve([]),
    ]).then(([ts, sessions, games, mine, invited, bks, tRegs, sRegs]) => {
      if (!alive) return;
      setTournaments(ts);
      setOpenSessions(sessions);
      setPublicGames(games);
      setMineGames(mine);
      setInvitedGames(invited);
      setBookings(bks);
      setTournamentRegs(new Set(tRegs.map((r) => r.tournamentId).filter(Boolean)));
      setOpenSessionRegs(new Set(sRegs.map((r) => r.sessionId).filter(Boolean)));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  // Realtime: when a game.invited event arrives, refetch invited games.
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onRealtime('game.invited', () => {
      listGames({ invited: true }).then((games) => setInvitedGames(games)).catch(() => {});
    });
    return unsub;
  }, [isLoggedIn]);

  const createdOpenGames = useMemo(() => mineGames.filter((g) => !!myId && g.creatorId === myId), [mineGames, myId]);
  const joinedOpenGames = useMemo(() => mineGames.filter((g) => !(myId && g.creatorId === myId)), [mineGames, myId]);
  const mineGameIds = useMemo(() => new Set(mineGames.map((g) => g.id)), [mineGames]);

  // Public Games tab: only non-open gameType (singles / doubles — organizer-created, has lobby)
  const gamesDiscover = useMemo(() => publicGames.filter((g) => !mineGameIds.has(g.id) && !isOpenPlayGame(g)), [publicGames, mineGameIds]);
  const gamesJoined = useMemo(() => joinedOpenGames.filter((g) => !isOpenPlayGame(g)), [joinedOpenGames]);
  const gamesManage = useMemo(() => createdOpenGames.filter((g) => !isOpenPlayGame(g)), [createdOpenGames]);

  // Open Play tab: only open-type games + sessions (player-published bookings, no lobby)
  const openDiscoverGames = useMemo(() => publicGames.filter((g) => !mineGameIds.has(g.id) && isOpenPlayGame(g)), [publicGames, mineGameIds]);
  const openDiscoverSessions = useMemo(() => openSessions.filter((s) => !openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const openJoinedGames = useMemo(() => joinedOpenGames.filter((g) => isOpenPlayGame(g)), [joinedOpenGames]);
  const openJoinedSessions = useMemo(() => openSessions.filter((s) => openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const openManageGames = useMemo(() => createdOpenGames.filter((g) => isOpenPlayGame(g)), [createdOpenGames]);

  // Invited games — only the Open Play section has an invites tab
  const openInvitedGames = useMemo(() => invitedGames.filter((g) => isOpenPlayGame(g)), [invitedGames]);
  // Keep the FAB's invite badge in sync with this screen's live set, so an
  // accept/decline here clears it immediately (not just on the next poll).
  const setInviteCount = useInviteStore((s) => s.setCount);
  useEffect(() => { if (isLoggedIn) setInviteCount(openInvitedGames.length); }, [openInvitedGames.length, isLoggedIn, setInviteCount]);

  const privateBookings = useMemo(() => bookings.filter((b) => b.bookingType !== 'open_play'), [bookings]);

  const q = search.trim().toLowerCase();
  const matchText = (haystack: string) => !q || haystack.toLowerCase().includes(q);
  const filterGames = (list: ApiGame[]) => !q ? list : list.filter((g) => matchText(gameTitle(g)) || matchText(gameVenue(g)) || matchText(gameVenueLoc(g) || ''));
  const filterSessions = (list: ApiOpenPlaySession[]) => !q ? list : list.filter((s) => matchText(s.title || '') || matchText(s.venueName || '') || matchText(s.levelLabel || ''));
  const filterBookings = (list: ApiBooking[]) => !q ? list : list.filter((b) => matchText(b.venueName || '') || matchText(b.courtName || ''));

  const gamesDiscoverFiltered = useMemo(() => filterGames(gamesDiscover), [gamesDiscover, q]);
  const gamesJoinedFiltered = useMemo(() => filterGames(gamesJoined), [gamesJoined, q]);
  const gamesManageFiltered = useMemo(() => filterGames(gamesManage), [gamesManage, q]);
  const openDiscoverGamesF = useMemo(() => filterGames(openDiscoverGames), [openDiscoverGames, q]);
  const openDiscoverSessionsF = useMemo(() => filterSessions(openDiscoverSessions), [openDiscoverSessions, q]);
  const openJoinedGamesF = useMemo(() => filterGames(openJoinedGames), [openJoinedGames, q]);
  const openJoinedSessionsF = useMemo(() => filterSessions(openJoinedSessions), [openJoinedSessions, q]);
  const openManageGamesF = useMemo(() => filterGames(openManageGames), [openManageGames, q]);
  const openInvitedGamesF = useMemo(() => filterGames(openInvitedGames), [openInvitedGames, q]);
  const bookedFiltered = useMemo(() => filterBookings(privateBookings), [privateBookings, q]);

  // Reflect the active tab into the URL *through the router* (onNavigate), not a
  // raw history.replaceState. The rendered screen is derived from the URL, and
  // only routerNavigate notifies that derivation — a bare replaceState left App's
  // screen state stale, so a later navigate() to the same view (e.g. re-tapping
  // the "Play" FAB → Invites) became a no-op and the tab/FAB desynced. Defaults
  // are dropped so the URL stays clean (/games for games+discover). `replace`
  // keeps tab switches out of the back stack. It survives browser Back too.
  const syncTabUrl = (nextSection: Section, nextView: View) => {
    onNavigate('games', {
      section: nextSection === 'games' ? undefined : nextSection,
      view: nextView === 'discover' ? undefined : nextView,
    }, { replace: true });
  };
  const selectSection = (next: Section) => {
    setSection(next);
    setView('discover');
    setSearch('');
    syncTabUrl(next, 'discover');
  };
  const selectView = (next: View) => { setView(next); setSearch(''); syncTabUrl(section, next); };

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

  const joinInvitedGame = async (g: ApiGame) => {
    setJoinBusy(g.id);
    setActionError(null);
    try {
      await joinGame(g.id);
      setInvitedGames((prev) => prev.filter((x) => x.id !== g.id));
      setMineGames((prev) => [...prev, g]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not join this game.');
    } finally {
      setJoinBusy(null);
    }
  };

  const declineInvitedGame = async (g: ApiGame) => {
    setJoinBusy(g.id);
    setActionError(null);
    try {
      await declineGameInvite(g.id);
      setInvitedGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not decline this invite.');
    } finally {
      setJoinBusy(null);
    }
  };

  const toggleBookingPublish = async (booking: ApiBooking) => {
    const existingGame = mineGames.find((g) => g.bookingId === booking.id);
    setActionId(booking.id);
    setActionError(null);
    try {
      if (existingGame) {
        // Make private: delete the open-play game, keep the court booking
        await deleteGame(existingGame.id, { keepBooking: true });
        setMineGames((prev) => prev.filter((g) => g.id !== existingGame.id));
        setPublicGames((prev) => prev.filter((g) => g.id !== existingGame.id));
      } else {
        // Make public: create an open-play game from this booking
        const game = await createGame({
          bookingId: booking.id,
          gameType: 'open',
          venueId: booking.venueId || undefined,
          venueName: booking.venueName || undefined,
          date: booking.date || undefined,
          capacity: 4,
          visibility: 'public',
        });
        setMineGames((prev) => [...prev, game]);
        setPublicGames((prev) => [...prev, game]);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update visibility.');
    } finally {
      setActionId(null);
    }
  };

  const subheading = section === 'games'
    ? 'Tournaments, competitive matches, and organized events.'
    : 'Open play sessions, player-hosted games, and your court bookings.';

  // The "Play" FAB navigates here (Open Play → Invites), so hide it while the
  // user is already on that view — no point offering a jump to the current page.
  const hideFab = section === 'open-play' && view === 'invites';

  return (
    <V2Shell screen="v2-games" chrome={chrome} hideFab={hideFab}>
      <div className="page-content">
        <div className="games-intro">
          <h1 className="games-heading">Games</h1>
          <p className="games-subheading">{subheading}</p>
        </div>

        <div className="tab-group-row">
          <div className="section-dropdown-wrap">
            <select
              className="section-dropdown"
              value={section}
              onChange={(e) => selectSection(e.target.value as Section)}
              aria-label="Games section"
            >
              <option value="games">Events</option>
              <option value="open-play">Open Play</option>
            </select>
            <svg className="section-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>

        <div className="tab-group-row">
          <div className="tab-group" role="tablist" aria-label="Games view">
            {(section === 'open-play'
              ? (['discover', 'joined', 'invites', 'manage'] as View[])
              : (['discover', 'joined', 'manage'] as View[])
            ).map((key) => (
                <button key={key} className={'seg-btn' + (view === key ? ' active' : '')} role="tab" aria-selected={view === key} onClick={() => selectView(key as View)}>
                  {key === 'discover' ? 'Discover' : key === 'joined' ? 'Joined' : key === 'invites' ? (
                  <span className="inline-flex items-center gap-1.5">Invites{openInvitedGames.length > 0 && <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--coral)] text-white text-[10px] font-bold px-1">{openInvitedGames.length}</span>}</span>
                ) : 'Manage'}
                </button>
              ))}
            </div>
          </div>

        <div className="pb-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="search-bar">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="search-input"
              type="search"
              placeholder={view === 'discover' ? 'Search by name or venue…' : view === 'joined' ? 'Search your list…' : view === 'invites' ? 'Search invitations…' : 'Search your games…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
        </div>

        <div className="games-list-scroll">
          {loading ? <V2Skeleton variant="game-list" count={5} /> : null}
          {!loading && section === 'games' && view === 'discover' && (
            gamesDiscover.length === 0
              ? <Empty text="No open games available." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />
              : gamesDiscoverFiltered.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : gamesDiscoverFiltered.map((g) => <GameCard key={'discover-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} />)
          )}
          {!loading && section === 'games' && view === 'joined' && (
            gamesJoined.length === 0
              ? <Empty text="Games you join show up here." />
              : gamesJoinedFiltered.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : gamesJoinedFiltered.map((g) => <GameCard key={'joined-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={canLeaveLobby(g) ? { label: actionId === g.id ? 'Leaving...' : 'Leave', onClick: () => leaveOpenGame(g) } : { label: 'Spot locked', onClick: () => undefined }} />)
          )}
          {!loading && section === 'games' && view === 'manage' && (
            gamesManage.length === 0
              ? <Empty text="Games you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />
              : gamesManageFiltered.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : gamesManageFiltered.map((g) => <GameCard key={'manage-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={{ label: actionId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => deleteOpenGame(g) }} />)
          )}
          {!loading && section === 'open-play' && view === 'discover' && (
            <OpenPlayDiscover games={openDiscoverGamesF} sessions={openDiscoverSessionsF} onNavigate={onNavigate} emptyWithData={q && (openDiscoverGames.length + openDiscoverSessions.length) > 0 ? `No results for "${search}"` : ''} unfilteredCount={openDiscoverGames.length + openDiscoverSessions.length} />
          )}
          {!loading && section === 'open-play' && view === 'joined' && (
            <OpenPlayJoined games={openJoinedGamesF} sessions={openJoinedSessionsF} onNavigate={onNavigate} onLeave={leaveOpenGame} busyId={actionId} emptyWithData={q && (openJoinedGames.length + openJoinedSessions.length) > 0 ? `No results for "${search}"` : ''} unfilteredCount={openJoinedGames.length + openJoinedSessions.length} />
          )}
          {!loading && section === 'open-play' && view === 'invites' && (
            openInvitedGames.length === 0
              ? <Empty text="Open Play invites you receive show up here." />
              : openInvitedGamesF.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : openInvitedGamesF.map((g) => {
                    const inviter = (g.invitedUserIds ?? []).find((entry) => entry.user === myId)?.invitedBy;
                    const inviterName = inviter?.displayName ?? null;
                    const busy = joinBusy === g.id;
                    return <GameCard key={'open-invited-' + g.id} game={g} showVisibility inviterName={inviterName} onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })}>
                      <div className="game-actions" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => joinInvitedGame(g)} disabled={busy} className="rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold px-3.5 py-1.5" style={{ border: 'none', cursor: 'pointer' }}>{busy ? 'Joining…' : 'Accept invite'}</button>
                        <button type="button" className="game-action-btn" onClick={() => declineInvitedGame(g)} disabled={busy}>{busy ? '…' : 'Decline'}</button>
                      </div>
                    </GameCard>;
                  })
          )}
          {!loading && section === 'open-play' && view === 'manage' && (
            <OpenPlayManage games={openManageGamesF} bookings={bookedFiltered} mineGames={mineGames} onNavigate={onNavigate} onDelete={deleteOpenGame} onTogglePublish={toggleBookingPublish} busyId={actionId} emptyWithData={q && (openManageGames.length + privateBookings.length) > 0 ? `No results for "${search}"` : ''} unfilteredCount={openManageGames.length + privateBookings.length} />
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
        <div className="game-thumb" style={{ backgroundImage: `url(${apiImageUrl(t.bannerUrl) || FALLBACK_GAME_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
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
      <div className="game-thumb" style={{ backgroundImage: `url(${FALLBACK_GAME_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <span className="game-type-badge badge-open">Open Play</span>
      </div>
      <div className="game-body">
        <div className="game-title">{session.title || 'Open Play'}</div>
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{sessionWhen(session)}</div>
          <div className="game-meta-row">{PIN_SVG}{sessionMeta(session)}</div>
        </div>
        <div className="vis-indicator public">Public</div>
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

function GameCard({ game, onClick, action, showVisibility, inviterName, children }: { game: ApiGame; onClick: () => void; action?: { label: string; onClick: () => void }; showVisibility?: boolean; inviterName?: string | null; children?: React.ReactNode }) {
  const img = gameImage(game);
  const badge = typeBadge(game);
  const s = slots(game);
  return (
    <article className="game-card" role="button" tabIndex={0} onClick={onClick}>
      <div className="game-thumb" style={{ backgroundImage: `url(${img || FALLBACK_GAME_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <span className={`game-type-badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="game-body">
        <div className="game-title">{gameTitle(game)}</div>
        {inviterName && <div className="text-[12px] font-semibold text-[var(--primary)] mt-0.5 mb-1">Invited by {inviterName}</div>}
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{gameWhen(game)}</div>
          <div className="game-meta-row">{PIN_SVG}{gameVenue(game)}</div>
          {gameVenueLoc(game) && <div className="game-meta-loc">{gameVenueLoc(game)}</div>}
        </div>
        {showVisibility && <div className="vis-indicator public">Public</div>}
        {isOpenPlayGame(game) ? (
          <div className="players-row">
            <span className="players-label">{interestLabel(game)}</span>
          </div>
        ) : s.cap > 0 ? (
          <div className="players-row">
            <div className="fill-track"><div className={`fill-bar${s.almost ? ' near-full' : ''}`} style={{ width: `${s.pct}%` }} /></div>
            <span className={`players-label${s.almost ? ' near-full' : ''}`}>{s.joined}/{s.cap}</span>
          </div>
        ) : null}
        {action && (
          <div className="game-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="game-action-btn" onClick={action.onClick}>{action.label}</button>
          </div>
        )}
        {children}
      </div>
    </article>
  );
}

function OpenPlayDiscover({ games, sessions, onNavigate, emptyWithData, unfilteredCount }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate']; emptyWithData: string; unfilteredCount: number }) {
  if (unfilteredCount > 0 && (!games.length && !sessions.length)) return <Empty text={emptyWithData} />;
  if (!unfilteredCount) return <Empty text="No Open Play sessions available." />;
  return <>{sessions.map((s) => <SessionCard key={'session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'game-' + g.id} game={g} showVisibility onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} />)}</>;
}
function OpenPlayJoined({ games, sessions, onNavigate, onLeave, busyId, emptyWithData, unfilteredCount }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate']; onLeave: (g: ApiGame) => void; busyId: string | null; emptyWithData: string; unfilteredCount: number }) {
  if (unfilteredCount > 0 && (!games.length && !sessions.length)) return <Empty text={emptyWithData} />;
  if (!unfilteredCount) return <Empty text="Open Play sessions you join show up here." />;
  return <>{sessions.map((s) => <SessionCard key={'joined-session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'joined-game-' + g.id} game={g} showVisibility onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={canLeaveLobby(g) ? { label: busyId === g.id ? 'Leaving...' : 'Leave', onClick: () => onLeave(g) } : { label: 'Spot locked', onClick: () => undefined }} />)}</>;
}
function OpenPlayManage({ games, bookings, mineGames, onNavigate, onDelete, onTogglePublish, busyId, emptyWithData, unfilteredCount }: { games: ApiGame[]; bookings: ApiBooking[]; mineGames: ApiGame[]; onNavigate: V2ScreenChrome['onNavigate']; onDelete: (g: ApiGame) => void; onTogglePublish: (b: ApiBooking) => void; busyId: string | null; emptyWithData: string; unfilteredCount: number }) {
  const totalItems = games.length + bookings.length;
  if (unfilteredCount > 0 && totalItems === 0) return <Empty text={emptyWithData} />;
  if (!unfilteredCount) return <Empty text="Open Play sessions you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('nearby') }} />;

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingBookings = bookings.filter((b) => !b.date || b.date >= todayStr);
  const pastBookings = bookings.filter((b) => b.date && b.date < todayStr);

  return <>
    {games.map((g) => <GameCard key={'manage-game-' + g.id} game={g} showVisibility onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={{ label: busyId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => onDelete(g) }} />)}
    {upcomingBookings.map((b) => <BookingCard key={b.id} b={b} mineGames={mineGames} onNavigate={onNavigate} onTogglePublish={onTogglePublish} busyId={busyId} />)}
    {pastBookings.length > 0 && (
      <div className="mt-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[12px] font-extrabold tracking-[0.08em] text-[var(--muted)] uppercase">History</div>
          <div className="flex-1 h-px bg-[var(--hairline)]" />
          <div className="text-[12px] font-bold text-[var(--muted)]">{pastBookings.length}</div>
        </div>
        {pastBookings.map((b) => <BookingCard key={b.id} b={b} mineGames={mineGames} onNavigate={onNavigate} onTogglePublish={onTogglePublish} busyId={busyId} isPast />)}
      </div>
    )}
  </>;
}

function BookingCard({ b, mineGames, onNavigate, onTogglePublish, busyId, isPast }: { b: ApiBooking; mineGames: ApiGame[]; onNavigate: V2ScreenChrome['onNavigate']; onTogglePublish: (b: ApiBooking) => void; busyId: string | null; isPast?: boolean }) {
  const court = b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : null);
  const chip = statusChip(b.status);
  const isPublished = !isPast && canPublishBooking(b) && mineGames.some((g) => g.bookingId === b.id);
  const isBusy = busyId === b.id;

  return (
    <article className="game-card" role="button" tabIndex={0} onClick={() => onNavigate('booking-refund', { bookingId: b.id })}>
      <div className="game-thumb" style={{ backgroundImage: `url(${FALLBACK_GAME_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <span className="game-type-badge badge-open">Booked</span>
      </div>
      <div className="game-body">
        <div className="game-title">{bookingTitle(b)}</div>
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{[prettyDate(b.date), bookingTimeRange(b)].filter(Boolean).join(' · ')}</div>
          {court && <div className="game-meta-row">{PIN_SVG}{court}</div>}
        </div>
        {!isPast && canPublishBooking(b) ? (
          <button
            type="button"
            className={`vis-indicator toggle ${isPublished ? 'public' : 'private'}`}
            disabled={isBusy}
            onClick={(e) => { e.stopPropagation(); onTogglePublish(b); }}
          >
            {isBusy ? '…' : isPublished ? 'Public' : 'Private'}
          </button>
        ) : (
          <div className={`vis-indicator ${isPublished ? 'public' : 'private'}`}>{isPublished ? 'Public' : 'Private'}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 11,
            fontWeight: 700,
            ...chipStyle(chip.className),
          }}>{chip.label}</span>
        </div>
      </div>
    </article>
  );
}

/** Resolve inline chip colours from the className tokens used by statusChip. */
function chipStyle(cls: string): Record<string, string> {
  if (cls.includes('[var(--lime)]')) return { background: 'var(--lime)', color: 'var(--ink)' };
  if (cls.includes('[var(--coral)]')) return { background: '#FFF0ED', color: '#D8432A' };
  if (cls.includes('[var(--blue)]')) return { background: '#EBF0FF', color: 'var(--blue)' };
  if (cls.includes('[var(--muted)]')) return { background: 'var(--border-subtle)', color: 'var(--text-muted)' };
  if (cls.includes('[var(--primary-soft)]')) return { background: 'var(--lime)', color: 'var(--ink)' };
  if (cls.includes('[var(--primary-deep)]')) return { background: 'var(--lime)', color: 'var(--ink)' };
  return { background: 'var(--border-subtle)', color: 'var(--text-secondary)' };
}
