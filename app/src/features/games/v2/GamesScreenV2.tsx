import { useEffect, useMemo, useRef, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import {
  apiImageUrl, createGame, declineGameInvite, deleteGame, getPlayDiscover, joinGame, leaveGame, listBookings, listGames,
  listMyOpenPlayRegistrations, listMyTournamentRegistrations,
  listOpenPlaySessions, listPublicTournaments, toggleGameInterest,
  type ApiBooking, type ApiGame, type ApiOpenPlaySession, type ApiTournament,
} from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { useInviteStore } from '../../../shared/lib/inviteStore';
import { onRealtime } from '../../../shared/lib/realtimeBus';
import { formatDistance, getCurrentLocation, type LatLng } from '../../../shared/lib/geo';
import { prettyDate, timeRange as bookingTimeRange, to12h, money, statusChip } from '../../bookings/bookingDisplay';
import { canLeaveLobby, dateSectionHeader, gameFormatLabel, genderBlockReason, genderPolicyLabel, skillBlockReason, interestCount, interestWithTarget, isOpenPlayGame } from '../gameDisplay';
import { GameFilterSheet } from '../GameFilterSheet';
import {
  countActiveGameFilters, makeDefaultGameFilters, matchesPlayFilters, TYPE_OPTIONS, type GameFilters,
} from '../gameFilters';
import {
  sortScored, SORT_LABELS, type ScoredPlayItem, type SortKey,
} from '../playRanking';

type Section = 'games' | 'open-play';
type View = 'discover' | 'joined' | 'invites' | 'manage';

interface GamesScreenV2Props extends V2ScreenChrome {
  initialSection?: Section;
  initialView?: View;
}

const FALLBACK_GAME_IMG = '/fallback-game.png';

/** The non-Discover tabs (Joined / Manage / Invites) still page the raw lists. */
const DISCOVER_PAGE_SIZE = 500;

/** Open Play leads. It is the most common player need, and the meeting was explicit
 *  that tapping Play should land on it rather than on a chooser. */
const SECTION_KEYS: Section[] = ['open-play', 'games'];
const SECTION_LABELS: Record<Section, string> = { games: 'Events', 'open-play': 'Open Play' };

function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

/** Returns the CSS url() value for a game thumb background, falling back to the default image. */
function gameThumbBg(g: ApiGame): string {
  return `url(${gameImage(g) || FALLBACK_GAME_IMG})`;
}
/** The card's title. Unlike gameDisplay.gameTitle (which derives "Doubles · 3.0–3.5"
 *  for untitled games), the Play cards fall back to a plain "Open Play". */
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
  if (t === 'public') return { cls: 'badge-competitive', label: gameFormatLabel(g) || 'Public play' };
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
  // A bare Play tap opens on Open Play, not Events — §3.3 of the 8 July minutes.
  // It used to default to Events, so the most common player need sat one hidden
  // dropdown away while the least common one greeted them.
  const { onNavigate, isLoggedIn, initialSection = 'open-play' } = chrome;
  // Captured raw so the landing effect can tell a bare entry (no ?view=) from an
  // explicit deep-link. `initialView` keeps the old default for the mount reset.
  const rawInitialView = chrome.initialView;
  const initialView: View = rawInitialView ?? 'discover';
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? null;

  const [section, setSection] = useState<Section>(initialSection);
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(true);
  // Discover has its own load flag so the ranked feed can wait on geolocation
  // without holding up the list-based views (Joined / Manage / Invites), which
  // key off `loading`. `refetching` is a *background* refresh (session restore or
  // location settling) that updates the feed in place instead of blanking it.
  const [feedLoading, setFeedLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  // Signature of the last *primary* Discover load (section + retry key). A run
  // whose signature is unchanged is a background refetch, not a primary load.
  const discoverLoadSig = useRef<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** A Discover fetch failed. Distinct from "the catalogue is empty". */
  const [feedError, setFeedError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState(false);
  /** Bumped to re-run the load effect when the user retries. */
  const [reloadKey, setReloadKey] = useState(0);

  // Discover controls start fully unfiltered — distance included. `searchRadiusKm`
  // is the Courts tab's preference: there you're picking a venue to book, so a
  // radius is always sensible. Here you're picking a *game*, and people will
  // travel further for the right one. Seeding it made distance an invisible
  // opt-out filter that silently emptied the feed.
  const [filters, setFilters] = useState<GameFilters>(() => makeDefaultGameFilters());
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('best');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  // The viewer's location, for distance ranking + the card's distance line. There
  // is no shared geolocation hook; this mirrors NearbyScreenV2's local state.
  // A denial degrades the feed rather than breaking it, but the user has to be
  // *told* — otherwise 25% of the ranking model silently stops applying and the
  // Distance sort just isn't there, with nothing to explain either.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<'locating' | 'on' | 'denied'>('locating');
  const [locDismissed, setLocDismissed] = useState(false);

  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [tournamentRegs, setTournamentRegs] = useState<Set<string>>(new Set());
  const [openSessions, setOpenSessions] = useState<ApiOpenPlaySession[]>([]);
  const [openSessionRegs, setOpenSessionRegs] = useState<Set<string>>(new Set());
  /** Discover, ranked by the server. Refetched when the section or the user's
   *  location changes — those are the two inputs the server can't know on its own. */
  const [discoverFeed, setDiscoverFeed] = useState<ScoredPlayItem[]>([]);
  const [mineGames, setMineGames] = useState<ApiGame[]>([]);
  const [invitedGames, setInvitedGames] = useState<ApiGame[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setView(initialView);
  }, [initialSection, initialView]);

  // Ask once on mount. Denied or unavailable → userLoc stays null, proximity drops
  // out of the score, and the banner below offers a way back.
  useEffect(() => {
    let alive = true;
    getCurrentLocation()
      .then((loc) => { if (alive) { setUserLoc(loc); setLocStatus('on'); } })
      .catch(() => { if (alive) setLocStatus('denied'); });
    return () => { alive = false; };
  }, []);

  /** Retry after a denial. Browsers won't re-prompt once blocked, so this only
   *  succeeds if the user re-allowed it in site settings first. */
  const retryLocate = () => {
    setLocStatus('locating');
    getCurrentLocation()
      .then((loc) => { setUserLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  };

  // Close the sort menu on an outside click or Escape, matching NearbyScreenV2 —
  // it's a custom listbox, so it doesn't get this for free. (The section control
  // used to need the same treatment; it's a plain tab row now.)
  useEffect(() => {
    if (!sortOpen) return;
    const outside = (ref: React.RefObject<HTMLDivElement | null>, target: Node) =>
      !!ref.current && !ref.current.contains(target);
    const onDown = (e: MouseEvent) => {
      if (outside(sortRef, e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [sortOpen]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFeedError(null);
    setSecondaryError(false);
    // The two Discover fetches are the screen's reason to exist. Swallowing their
    // failure into `[]` renders "No open plays available" — telling the user the
    // catalogue is empty when the server actually errored. Record it instead.
    const onFeedError = (e: unknown) => {
      if (alive) setFeedError(e instanceof Error ? e.message : 'Could not load plays.');
    };
    Promise.all([
      listPublicTournaments().catch(() => [] as ApiTournament[]),
      // Still fetched for the Joined tab — Discover comes ranked from the server now.
      listOpenPlaySessions({ pageSize: DISCOVER_PAGE_SIZE }).catch((e) => { onFeedError(e); return [] as ApiOpenPlaySession[]; }),
      isLoggedIn ? listGames({ mine: true }).catch(() => { setSecondaryError(true); return [] as ApiGame[]; }) : Promise.resolve([] as ApiGame[]),
      isLoggedIn ? listGames({ invited: true }).catch(() => { setSecondaryError(true); return [] as ApiGame[]; }) : Promise.resolve([] as ApiGame[]),
      isLoggedIn ? listBookings().catch(() => { setSecondaryError(true); return [] as ApiBooking[]; }) : Promise.resolve([] as ApiBooking[]),
      isLoggedIn ? listMyTournamentRegistrations().catch(() => []) : Promise.resolve([]),
      isLoggedIn ? listMyOpenPlayRegistrations().catch(() => []) : Promise.resolve([]),
    ]).then(([ts, sessions, mine, invited, bks, tRegs, sRegs]) => {
      if (!alive) return;
      setTournaments(ts);
      setOpenSessions(sessions);
      setMineGames(mine);
      setInvitedGames(invited);
      setBookings(bks);
      setTournamentRegs(new Set(tRegs.map((r) => r.tournamentId).filter(Boolean)));
      setOpenSessionRegs(new Set(sRegs.map((r) => r.sessionId).filter(Boolean)));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn, reloadKey]);

  /* Discover, ranked by the server. Deliberately waits for the geolocation attempt
   * to settle ('on' or 'denied') before firing: the viewer's coordinates are the one
   * ranking input only the browser holds, and fetching while it is still 'locating'
   * would rank a signed-in player's feed with proximity dropped, then visibly
   * reshuffle it a moment later when the fix landed. One fetch, correctly ranked. */
  useEffect(() => {
    if (locStatus === 'locating') return;
    let alive = true;
    // A primary load (first fetch, a section switch, or an explicit retry) shows
    // the feed skeleton. A run triggered only by the session restoring or the
    // location settling reuses the same signature — it refreshes the ranked feed
    // in place, so the screen doesn't blank and "twitch" a second time on reload.
    const sig = `${section}|${reloadKey}`;
    const isPrimary = discoverLoadSig.current !== sig;
    discoverLoadSig.current = sig;
    if (isPrimary) setFeedLoading(true); else setRefetching(true);
    getPlayDiscover({
      // This screen has always called the section 'games'; the API calls the same
      // thing 'events', which is what the meeting named it and what the tab reads.
      section: section === 'open-play' ? 'open-play' : 'events',
      pageSize: DISCOVER_PAGE_SIZE,
      ...(userLoc ? { lat: userLoc[0], lng: userLoc[1] } : {}),
    })
      .then((res) => { if (alive) { setDiscoverFeed(res.items); setFeedError(null); } })
      // An empty feed and a failed feed look identical on screen ("No open plays
      // available"), which would tell the user the catalogue is empty when the
      // server actually errored. Say so instead.
      .catch((e) => { if (alive) setFeedError(e instanceof Error ? e.message : 'Could not load plays.'); })
      .finally(() => { if (alive) { setFeedLoading(false); setRefetching(false); } });
    return () => { alive = false; };
  }, [section, userLoc, locStatus, isLoggedIn, reloadKey]);

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

  // Public Games tab: only non-open gameType (singles / doubles — organizer-created, has lobby)
  const gamesJoined = useMemo(() => joinedOpenGames.filter((g) => !isOpenPlayGame(g)), [joinedOpenGames]);
  const gamesManage = useMemo(() => createdOpenGames.filter((g) => !isOpenPlayGame(g)), [createdOpenGames]);

  // Open Play tab: only open-type games + sessions (player-published bookings, no lobby).
  // Discover no longer derives from these — the server sends it ranked.
  const openJoinedGames = useMemo(() => joinedOpenGames.filter((g) => isOpenPlayGame(g)), [joinedOpenGames]);
  const openJoinedSessions = useMemo(() => openSessions.filter((s) => openSessionRegs.has(s.id)), [openSessions, openSessionRegs]);
  const openManageGames = useMemo(() => createdOpenGames.filter((g) => isOpenPlayGame(g)), [createdOpenGames]);

  // Hide the "Joined" tab when there's nothing joined yet (after data loads).
  const hasOpenPlayJoined = openJoinedGames.length > 0 || openJoinedSessions.length > 0;
  const hasGamesJoined = gamesJoined.length > 0;

  // When the "Joined" tab has nothing to show, redirect to Discover.
  useEffect(() => {
    if (loading || view !== 'joined') return;
    const empty = section === 'open-play'
      ? (openJoinedGames.length === 0 && openJoinedSessions.length === 0)
      : gamesJoined.length === 0;
    if (empty) selectView('discover');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, view, section, openJoinedGames.length, openJoinedSessions.length, gamesJoined.length]);

  // Invited games — only the Open Play section has an invites tab
  const openInvitedGames = useMemo(() => invitedGames.filter((g) => isOpenPlayGame(g)), [invitedGames]);

  const hasOpenPlayInvites = openInvitedGames.length > 0;

  // When the "Invites" tab has nothing to show, redirect to Discover.
  useEffect(() => {
    if (loading || view !== 'invites') return;
    if (openInvitedGames.length === 0) selectView('discover');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, view, openInvitedGames.length]);
  // Keep the FAB's invite badge in sync with this screen's live set, so an
  // accept/decline here clears it immediately (not just on the next poll).
  const setInviteCount = useInviteStore((s) => s.setCount);
  useEffect(() => { if (isLoggedIn) setInviteCount(openInvitedGames.length); }, [openInvitedGames.length, isLoggedIn, setInviteCount]);

  const privateBookings = useMemo(() => bookings.filter((b) => b.bookingType !== 'open_play'), [bookings]);

  const q = search.trim().toLowerCase();
  const matchText = (haystack: string) => !q || haystack.toLowerCase().includes(q);
  // Both entity types match the same five things: title, venue, location, skill
  // label, and the host's name. Host is the one people reach for most ("is Marco
  // hosting anything?") and it used to match nothing.
  const filterGames = (list: ApiGame[]) => !q ? list : list.filter((g) => matchText(gameTitle(g)) || matchText(gameVenue(g)) || matchText(gameVenueLoc(g) || '') || matchText(g.skillLabel || '') || matchText(g.creator?.displayName || ''));
  const filterSessions = (list: ApiOpenPlaySession[]) => !q ? list : list.filter((s) => matchText(s.title || '') || matchText(s.venueName || '') || matchText([s.venueArea, s.venueCity].filter(Boolean).join(' · ')) || matchText(s.levelLabel || '') || matchText(s.organizerName || ''));
  const filterBookings = (list: ApiBooking[]) => !q ? list : list.filter((b) => matchText(b.venueName || '') || matchText(b.courtName || ''));

  const gamesJoinedFiltered = useMemo(() => filterGames(gamesJoined), [gamesJoined, q]);
  const gamesManageFiltered = useMemo(() => filterGames(gamesManage), [gamesManage, q]);
  const openJoinedGamesF = useMemo(() => filterGames(openJoinedGames), [openJoinedGames, q]);
  const openJoinedSessionsF = useMemo(() => filterSessions(openJoinedSessions), [openJoinedSessions, q]);
  const openManageGamesF = useMemo(() => filterGames(openManageGames), [openManageGames, q]);
  const openInvitedGamesF = useMemo(() => filterGames(openInvitedGames), [openInvitedGames, q]);
  const bookedFiltered = useMemo(() => filterBookings(privateBookings), [privateBookings, q]);

  /* ── Discover: one merged, ranked feed, scored by the SERVER ───────────────
   * Open Play mixes sessions and games, which used to render as two concatenated
   * blocks — a session weeks away sat above a game tonight. Events is games only
   * (singles/doubles/public lobbies). Both are scored by the same ranker.
   *
   * The ranking itself now lives in the API (`getPlayDiscover`). It used to run
   * here, and that had a truncation bug this screen could not fix on its own: it
   * could only ever rank the ~50 rows the server had already picked BY DATE, so
   * "Nearest" really meant "nearest among the soonest". The server now scores the
   * whole upcoming catalogue and truncates afterwards, which is the right way
   * round — and every device gets the same order.
   *
   * Search, filters and the four non-relevance sorts stay local: they are pure
   * reorderings/narrowings of a set we already hold, so a round-trip per keystroke
   * or per Sort tap would only make them feel slower. */
  const isOpenPlaySection = section === 'open-play';
  const discoverUnfiltered = discoverFeed.length;

  const discoverSearched = useMemo(() => {
    if (!q) return discoverFeed;
    return discoverFeed.filter((i) =>
      matchText(i.title) || matchText(i.venueName) || matchText(i.venueLoc)
      || matchText(i.skillLabel || '') || matchText(i.host || ''));
  }, [discoverFeed, q]);

  const discoverFiltered = useMemo(
    () => sortScored(discoverSearched.filter((i) => matchesPlayFilters(i, filters)), sort),
    [discoverSearched, filters, sort],
  );

  // The venues the feed actually holds — offering the whole directory would fill the
  // picker with venues that have nothing on. Derived from the UNfiltered feed, or
  // picking a venue would immediately remove every other option from the list.
  const venueOptions = useMemo(
    () => [...new Set(discoverFeed.map((i) => i.venueName).filter(Boolean))].sort(),
    [discoverFeed],
  );
  const activeFilterCount = countActiveGameFilters(filters);
  // Distance controls are only meaningful once we know where the user is.
  const canFilterByDistance = userLoc != null;
  const isDiscoverFeed = view === 'discover';
  // Events never contains open-type games, so offering "Open Play" as a type
  // filter there would be a guaranteed empty result.
  const typeOptions = isOpenPlaySection ? TYPE_OPTIONS : TYPE_OPTIONS.filter((t) => t.value !== 'open');
  // Hide "Nearest" rather than offer a sort that would silently do nothing.
  const SORT_KEYS: SortKey[] = canFilterByDistance
    ? ['best', 'soonest', 'nearest', 'fill', 'newest']
    : ['best', 'soonest', 'fill', 'newest'];

  // ── Discover / Mine restructure ───────────────────────────────────────────
  // The old two-row control (a section tab row + a 4-item view row that visually
  // collided with it) is now a compact product segment (Open Play / Events) plus
  // a Discover ⇄ Mine switch. Joined / Invites / Manage fold under Mine as chips,
  // shown only when they hold something (or are active) — the same filter the old
  // view row used, so nothing that was reachable becomes unreachable.
  const mode: 'discover' | 'mine' = view === 'discover' ? 'discover' : 'mine';
  const mineChips: View[] = section === 'open-play'
    ? (['joined', 'invites', 'manage'] as View[]).filter((k) =>
        (k !== 'joined' || hasOpenPlayJoined || view === 'joined')
        && (k !== 'invites' || hasOpenPlayInvites || view === 'invites'))
    : (['joined', 'manage'] as View[]).filter((k) => k !== 'joined' || hasGamesJoined || view === 'joined');
  const chipCount = (k: View): number => {
    if (k === 'joined') return section === 'open-play' ? openJoinedGames.length + openJoinedSessions.length : gamesJoined.length;
    if (k === 'invites') return openInvitedGames.length;
    return section === 'open-play' ? openManageGames.length + privateBookings.length : gamesManage.length;
  };
  // The Mine pip counts invites first — they're time-sensitive and actionable —
  // and falls back to the joined count so the switch still signals "you have plays".
  const mineBadgeCount = section === 'open-play' && hasOpenPlayInvites
    ? openInvitedGames.length
    : chipCount('joined');
  // Which chip a fresh tap on "Mine" should open: invites lead, else joined, else manage.
  const preferredMineView = (): View => {
    if (section === 'open-play' && hasOpenPlayInvites) return 'invites';
    const joined = section === 'open-play' ? hasOpenPlayJoined : hasGamesJoined;
    return joined ? 'joined' : 'manage';
  };

  // Reflect the active tab into the URL *through the router* (onNavigate), not a
  // raw history.replaceState. The rendered screen is derived from the URL, and
  // only routerNavigate notifies that derivation — a bare replaceState left App's
  // screen state stale, so a later navigate() to the same view (e.g. re-tapping
  // the "Play" FAB → Invites) became a no-op and the tab/FAB desynced. Defaults
  // are dropped so the URL stays clean (/games for games+discover). `replace`
  // keeps tab switches out of the back stack. It survives browser Back too.
  const syncTabUrl = (nextSection: Section, nextView: View) => {
    onNavigate('games', {
      // Omit whichever value the URL already means by default, so a bare /games
      // stays clean. That default is now OPEN PLAY (§3.3) — it used to be Events,
      // and leaving the test the old way round meant picking Events wrote nothing
      // to the URL and a reload silently bounced the player back to Open Play.
      section: nextSection === 'open-play' ? undefined : nextSection,
      view: nextView === 'discover' ? undefined : nextView,
    }, { replace: true });
  };
  // The search query AND filters deliberately survive a section/view switch:
  // resetting either silently discarded what the user set up the moment they
  // checked the other tab (the 20 Jul report's "filters don't persist" item).
  // A carried-over filter that empties the list can't strand anyone — the feed's
  // empty state names the cause and offers "Clear search & filters", and the
  // filter button badges the active count the whole time.
  const selectSection = (next: Section) => {
    setSection(next);
    setView('discover');
    syncTabUrl(next, 'discover');
  };
  const selectView = (next: View) => { setView(next); syncTabUrl(section, next); };
  const selectMode = (m: 'discover' | 'mine') => {
    if (m === 'discover') { selectView('discover'); return; }
    if (mode === 'mine') return; // already in Mine — keep the active chip
    selectView(preferredMineView());
  };

  // Landing rule: a bare entry (no explicit ?view=) with invites waiting opens on
  // Invites — the highest-priority actionable view — once data has loaded. An
  // explicit deep-link view always wins, and this fires at most once per mount.
  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current || loading) return;
    landedRef.current = true;
    if (!rawInitialView && section === 'open-play' && openInvitedGames.length > 0) {
      selectView('invites');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const clearDiscoverControls = () => {
    setSearch('');
    setFilters(makeDefaultGameFilters());
  };

  const leaveOpenGame = async (g: ApiGame) => {
    // Open Play uses interest-based — toggle off interest, don't call leaveGame.
    if (isOpenPlayGame(g)) {
      setActionId(g.id);
      setActionError(null);
      try {
        await toggleGameInterest(g.id);
        setMineGames((prev) => prev.filter((x) => x.id !== g.id));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Could not remove your interest.');
      } finally {
        setActionId(null);
      }
      return;
    }
    // Regular lobby games
    if (!canLeaveLobby(g)) return;
    setActionId(g.id);
    setActionError(null);
    try {
      await leaveGame(g.id);
      setMineGames((prev) => prev.filter((x) => x.id !== g.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not leave this play.');
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
      // Open Play presents a lobby, but its roster is still stored as interestedUsers,
      // so joining goes through the interest endpoint rather than the roster join.
      if (isOpenPlayGame(g)) {
        await toggleGameInterest(g.id);
      } else {
        await joinGame(g.id);
      }
      setInvitedGames((prev) => prev.filter((x) => x.id !== g.id));
      setMineGames((prev) => [...prev, g]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not join this play.');
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
        // Make private: delete the open-play game, keep the court booking.
        // No Discover update needed — the server never puts your OWN games in your
        // Discover feed, so publishing or unpublishing one can't change it.
        await deleteGame(existingGame.id, { keepBooking: true });
        setMineGames((prev) => prev.filter((g) => g.id !== existingGame.id));
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
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update visibility.');
    } finally {
      setActionId(null);
    }
  };

  // The "Play" FAB navigates here (Open Play → Invites), so hide it while the
  // user is already on that view — no point offering a jump to the current page.
  const hideFab = section === 'open-play' && view === 'invites';

  return (
    <V2Shell screen="v2-games" chrome={chrome} hideFab={hideFab}>
      <div className="page-content">
        {/* Compact header: the "Play" title and the product segment (Open Play /
            Events) share one row, replacing the old title block + full-width
            underline tab row. The segment picks the PRODUCT; the Discover ⇄ Mine
            switch below picks the VIEW of it — styled distinctly so the two never
            read as one control. §3.4 of the 8 July minutes. */}
        <div className="games-topbar">
          <h1 className="games-heading">Play</h1>
          <div className="prod-seg" role="tablist" aria-label="Play section">
            {SECTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={section === key}
                className={`prod-seg-btn${section === key ? ' active' : ''}`}
                onClick={() => selectSection(key)}
              >
                {SECTION_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Discover ⇄ Mine — the primary view switch. Joined / Invites / Manage
            fold under Mine as chips (below), each shown only when it holds
            something (or is active — the set stays stable across load cycles, so
            the row never expands-then-collapses on a re-fetch). */}
        <div className="mode-row" role="tablist" aria-label="Play view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'discover'}
            className={`mode-btn${mode === 'discover' ? ' active' : ''}`}
            onClick={() => selectMode('discover')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            Discover
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mine'}
            className={`mode-btn${mode === 'mine' ? ' active' : ''}`}
            onClick={() => selectMode('mine')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
            Mine
            {mineBadgeCount > 0 && (
              <span className={`mode-pip${section === 'open-play' && hasOpenPlayInvites ? ' inv' : ''}`}>{mineBadgeCount}</span>
            )}
          </button>
        </div>

        {mode === 'mine' && mineChips.length > 0 && (
          <div className="mine-chips" role="tablist" aria-label="Your plays">
            {mineChips.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={`mine-chip${view === key ? ' active' : ''}${key === 'invites' && openInvitedGames.length > 0 ? ' alert' : ''}`}
                onClick={() => selectView(key)}
              >
                {key === 'joined' ? 'Joined' : key === 'invites' ? 'Invites' : 'Manage'}
                <span className="mine-chip-count">{chipCount(key)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="search-filter-row">
          <div className="search-bar">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="search-input"
              type="search"
              placeholder={view === 'discover' ? 'Search by name, venue, or host…' : view === 'joined' ? 'Search your list…' : view === 'invites' ? 'Search invitations…' : 'Search your plays…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>

          {/* Filter + sort belong to the merged Discover feed only — the other
              views are small, already-scoped lists. */}
          {isDiscoverFeed && (
            <div className="flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                className="sort-btn"
                onClick={() => setFilterOpen(true)}
                aria-label={`Filter plays${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg>
                Filter
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--coral)] text-white text-[10px] font-bold px-1">{activeFilterCount}</span>
                )}
              </button>

              <div className="sort-row" ref={sortRef}>
                <span className="sort-label">Sort:</span>
                <button
                  type="button"
                  className="sort-btn"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  aria-label={`Sort plays: ${SORT_LABELS[sort]}`}
                  onClick={() => setSortOpen((o) => !o)}
                >
                  {SORT_LABELS[sort]}
                  <svg className="sort-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {sortOpen && (
                  <ul className="sort-menu" role="listbox" aria-label="Sort plays">
                    {SORT_KEYS.map((key) => (
                      <li key={key} role="option" aria-selected={sort === key}>
                        <button
                          type="button"
                          className={`sort-menu-item${sort === key ? ' active' : ''}`}
                          onClick={() => { setSort(key); setSortOpen(false); }}
                        >
                          {SORT_LABELS[key]}
                          {sort === key && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="games-list-scroll" aria-busy={feedLoading || loading || refetching}>
          {/* Location denied/unavailable: proximity has dropped out of the ranking
              and the Distance sort is gone. Say so, and offer the way back. */}
          {isDiscoverFeed && locStatus === 'denied' && !locDismissed && (
            <div className="loc-notice" role="status">
              <span className="loc-notice-text">Location is off, so plays aren’t sorted by distance.</span>
              <div className="loc-notice-actions">
                <button type="button" className="loc-notice-cta" onClick={retryLocate}>Use my location</button>
                <button type="button" className="loc-notice-dismiss" onClick={() => setLocDismissed(true)} aria-label="Dismiss">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
          )}
          {(isDiscoverFeed ? feedLoading : loading) ? <V2Skeleton variant="game-list" count={5} /> : null}
          {/* A failed fetch is not an empty catalogue. Say so, and offer a retry. */}
          {!feedLoading && isDiscoverFeed && feedError && (
            <Empty
              icon="⚠️"
              title="Couldn’t load plays"
              text={feedError}
              action={{ label: 'Try again', onClick: () => setReloadKey((k) => k + 1) }}
            />
          )}
          {!feedLoading && !feedError && section === 'games' && view === 'discover' && (
            <DiscoverFeed
              items={discoverFiltered}
              onOpen={(i) => onNavigate('game-details', { id: i.id })}
              showDateHeaders={sort === 'soonest'}
              hero={sort === 'best'}
              unfilteredCount={discoverUnfiltered}
              emptyText="No events available yet. Book a court and host one."
              emptyAction={{ label: 'Book Court', onClick: () => onNavigate('book-court', {}) }}
              narrowedByControls={q.length > 0 || activeFilterCount > 0}
              onClearControls={clearDiscoverControls}
              located={userLoc != null}
            />
          )}
          {!loading && secondaryError && view !== 'discover' && (
            <div className="feat-meta" style={{ color: 'var(--coral)', fontWeight: 600, textAlign: 'center', padding: '8px 0' }}>
              Couldn't load your list.{' '}
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Try again</button>
            </div>
          )}
          {!loading && section === 'games' && view === 'joined' && (
            gamesJoined.length === 0
              ? <Empty text="Plays you join show up here." />
              : gamesJoinedFiltered.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : gamesJoinedFiltered.map((g) => <GameCard key={'joined-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={canLeaveLobby(g) ? { label: actionId === g.id ? 'Leaving...' : 'Leave', onClick: () => leaveOpenGame(g) } : { label: 'Spot locked', onClick: () => undefined }} />)
          )}
          {!loading && section === 'games' && view === 'manage' && (
            gamesManage.length === 0
              ? <Empty text="Plays you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('book-court', {}) }} />
              : gamesManageFiltered.length === 0
                ? <Empty text={`No results for "${search}"`} />
                : gamesManageFiltered.map((g) => <GameCard key={'manage-' + g.id} game={g} onClick={() => onNavigate('game-details', { id: g.id })} action={{ label: actionId === g.id ? 'Removing...' : 'Remove Open Play', onClick: () => deleteOpenGame(g) }} />)
          )}
          {!feedLoading && !feedError && section === 'open-play' && view === 'discover' && (
            <DiscoverFeed
              items={discoverFiltered}
              onOpen={(i) => onNavigate('open-play-detail', { source: i.kind, id: i.id })}
              showDateHeaders={sort === 'soonest'}
              hero={sort === 'best'}
              unfilteredCount={discoverUnfiltered}
              emptyText="No open plays available yet. Book a court and publish one."
              emptyAction={{ label: 'Book Court', onClick: () => onNavigate('book-court', {}) }}
              narrowedByControls={q.length > 0 || activeFilterCount > 0}
              onClearControls={clearDiscoverControls}
              located={userLoc != null}
            />
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

      {isDiscoverFeed && (
        <GameFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          value={filters}
          onChange={setFilters}
          resultCount={discoverFiltered.length}
          showRadius={canFilterByDistance}
          typeOptions={typeOptions}
          venueOptions={venueOptions}
        />
      )}
    </V2Shell>
  );
}

function Empty({ text, action, title = 'No items here yet', icon = '🎾' }: { text: string; action?: { label: string; onClick: () => void }; title?: string; icon?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-ring">{icon}</div>
      <h3>{title}</h3>
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
        <div className="vis-indicator public">Open Play</div>
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
          {/* Gender-restricted games say so on the card, so a player doesn't open
              one only to find the join button locked. */}
          {genderPolicyLabel(game.genderPolicy) && (
            <div className="game-meta-row">
              <span>{game.genderPolicy === 'women' ? '👩' : '👨'}</span>
              {genderPolicyLabel(game.genderPolicy)}
            </div>
          )}
        </div>
        {showVisibility && <div className="vis-indicator public">Open Play</div>}
        {game.participants && game.participants.length > 0 && (
          <div className="game-participant-avatars">
            {game.participants.slice(0, 3).map((p, i) => (
              <span key={p.id} className="game-participant-avatar" style={{ zIndex: 3 - i, marginLeft: i === 0 ? 0 : -8 }}>
                {p.avatarUrl
                  ? <img src={apiImageUrl(p.avatarUrl)} alt="" className="h-full w-full rounded-full object-cover" />
                  : <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--ink-fill)] text-[8px] font-bold">{p.displayName?.[0] ?? '?'}</span>}
              </span>
            ))}
          </div>
        )}
        {isOpenPlayGame(game) ? (
          // Interest-based open play has no capacity — the bar tracks the host's
          // soft target when they set one, so momentum is visible either way.
          <div className="players-row">
            {game.targetPlayers ? (
              <div className="fill-track">
                <div className="fill-bar" style={{ width: `${Math.min(100, Math.round((interestCount(game) / game.targetPlayers) * 100))}%` }} />
              </div>
            ) : null}
            <span className="players-label">{interestWithTarget(game)}</span>
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

/** Discover: one ranked list. Shared by both sections — Open Play mixes sessions
 *  and games, Events is games only — since the only differences are the detail
 *  route and the empty copy. Date headers only make sense under the chronological
 *  sort; over a relevance ranking they'd be noise. */
function DiscoverFeed({ items, onOpen, showDateHeaders, unfilteredCount, emptyText, emptyAction, narrowedByControls, onClearControls, located, hero }: {
  items: ScoredPlayItem[];
  onOpen: (item: ScoredPlayItem) => void;
  showDateHeaders: boolean;
  unfilteredCount: number;
  emptyText: string;
  emptyAction?: { label: string; onClick: () => void };
  narrowedByControls: boolean;
  onClearControls: () => void;
  /** We know where the user is — so a card with no distance means the *venue*
   *  has no coordinates, not that location is off. The card says which. */
  located: boolean;
  /** Feature the top-ranked item as a full-width hero. Only passed under the
   *  Relevance sort — over a date/distance ordering "top pick" would be a lie. */
  hero?: boolean;
}) {
  // Nothing on the platform vs. nothing matching *your* search+filters are
  // different problems and deserve different exits.
  if (!unfilteredCount) return <Empty text={emptyText} action={emptyAction} />;
  if (!items.length) {
    return narrowedByControls
      ? <Empty text="No plays match your search and filters." action={{ label: 'Clear search & filters', onClick: onClearControls }} />
      : <Empty text={emptyText} action={emptyAction} />;
  }

  const open = (i: ScoredPlayItem) => onOpen(i);
  if (!showDateHeaders) {
    return <>{items.map((i, idx) => <PlayCard key={i.kind + '-' + i.id} item={i} located={located} featured={hero && idx === 0} onClick={() => open(i)} />)}</>;
  }

  // Group consecutive runs — the list is already date-ordered under this sort.
  const groups: { header: string; rows: ScoredPlayItem[] }[] = [];
  for (const i of items) {
    const { header } = dateSectionHeader(i.date);
    const last = groups[groups.length - 1];
    if (last && last.header === header) last.rows.push(i);
    else groups.push({ header, rows: [i] });
  }
  return <>{groups.map((g) => (
    <div key={g.header}>
      <div className="flex items-center gap-3 mb-3 mt-4 first:mt-0">
        <div className="text-[12px] font-extrabold tracking-[0.08em] text-[var(--muted)] uppercase">{g.header}</div>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
      </div>
      {g.rows.map((i) => <PlayCard key={i.kind + '-' + i.id} item={i} located={located} onClick={() => open(i)} />)}
    </div>
  ))}</>;
}

/** The unified Discover card. Sessions and games render alike — a `kind` badge and
 *  the "why" chips are what distinguish them — so a player can judge skill,
 *  distance, price, and host without tapping through. */
function PlayCard({ item, onClick, located, featured }: { item: ScoredPlayItem; onClick: () => void; located: boolean; featured?: boolean }) {
  const me = useAuthStore((s) => s.user);
  const badge = item.kind === 'session'
    ? { cls: 'badge-open', label: 'Open Play' }
    : typeBadge(item.source as ApiGame);
  // Whether the viewer can join is decided on the card, not on the detail screen:
  // a player shouldn't tap through to a men-only game to find out it's closed to
  // them. Venue-run sessions carry no policy, so only games can be restricted.
  const policy = item.kind === 'game' ? (item.source as ApiGame).genderPolicy : null;
  const restricted = genderPolicyLabel(policy);
  const ineligible = !!genderBlockReason(policy, me?.gender, !!me);
  // Skill band applies to BOTH games and venue sessions (item.skillBand is derived
  // from either), so a player sees up front when their level is outside the range —
  // the positive "Your level" case is already carried by the `why` chips.
  const skillIneligible = !!me && !!item.skillBand
    && !!skillBlockReason(item.skillBand[0], item.skillBand[1], me.skillLevel, true);
  const when = [prettyDate(item.date), item.startTime ? to12h(item.startTime) : null].filter(Boolean).join(' · ') || 'Time TBA';
  // A real entrance fee gets its own chip, not just a number in the meta line —
  // venues also label their court rate "Pay to Play" / "Per Player" there, so a
  // player can't tell a genuine fee from marketing copy without this.
  const entryFee = item.joinFee != null && item.joinFee > 0 ? item.joinFee : null;
  // `priceLabel` is a true per-player price only on a venue SESSION. On a player-
  // hosted game it is never what the joiner pays: with an entry fee it's that fee
  // (surfaced as the chip below), and with none it's the venue's court-cost LABEL —
  // usually free-text like "Pay to Play" / "Per Player", not even a clean price — so
  // it reads as a cost to join a game that's actually free. A game therefore shows
  // no price in the meta line at all; only a session's priceLabel is shown. See
  // PlayItem.joinFee in api.ts.
  const priceMeta = item.kind === 'session' ? item.priceLabel : null;
  const meta = [item.skillLabel, priceMeta, item.host ? `Hosted by ${item.host}` : null].filter(Boolean).join(' · ');
  // Three states, not two: a measured distance; "unknown" when we know where the
  // user is but the venue has no coordinates; and nothing at all when location is
  // off — in which case the banner above already explains the absence.
  const dist = item.distanceKm != null
    ? formatDistance(item.distanceKm)
    : (located && !item.coords ? 'Distance unknown' : '');
  const distUnknown = dist === 'Distance unknown';

  const f = item.fill;
  // Interest-based listings have no capacity, so the bar tracks progress toward
  // the host's soft target; with no target there's nothing to fill toward.
  const pct = f.mode === 'capacity'
    ? (f.cap > 0 ? Math.min(100, Math.round((f.joined / f.cap) * 100)) : 0)
    : (f.target ? Math.min(100, Math.round((f.count / f.target) * 100)) : 0);
  const fillLabel = f.mode === 'capacity'
    ? (f.cap > 0 ? `${f.joined}/${f.cap}` : '')
    : (f.target ? `${f.count}/${f.target} interested` : `${f.count} interested`);
  const nearFull = f.mode === 'capacity' && f.cap > 0 && f.cap - f.joined <= 1;
  const showBar = f.mode === 'capacity' ? f.cap > 0 : !!f.target;
  // Item-7 rule: a game the viewer can't join (wrong gender or skill band) is shown
  // marked, but its card is NOT openable — the detail/Join is only a second guard.
  // So a locked card drops its click + button semantics entirely.
  const locked = ineligible || skillIneligible;

  return (
    <article
      className={`game-card${featured ? ' game-hero' : ''}${locked ? ' game-card-locked' : ''}`}
      aria-disabled={locked || undefined}
      {...(locked ? {} : { role: 'button', tabIndex: 0, onClick })}
    >
      <div className="game-thumb" style={{ backgroundImage: `url(${apiImageUrl(item.image) || FALLBACK_GAME_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <span className={`game-type-badge ${badge.cls}`}>{badge.label}</span>
        {featured && <span className="hero-flag">★ Top pick</span>}
      </div>
      <div className="game-body">
        <div className="game-title">{item.title}</div>
        <div className="game-meta">
          <div className="game-meta-row">{CLOCK_SVG}{when}</div>
          <div className="game-meta-row">{PIN_SVG}{item.venueName}{dist && <span className={distUnknown ? 'text-[var(--text-muted)] font-semibold ml-1' : 'text-[var(--primary)] font-bold ml-1'}>· {dist}</span>}</div>
          {(meta || item.venueLoc) && <div className="game-meta-loc">{meta || item.venueLoc}</div>}
        </div>

        {(restricted || skillIneligible || entryFee != null || item.why.length > 0) && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {/* Costs money to join. Uses the dark `--ink-fill` chip (the `.chip.active`
                idiom) so it reads apart from the lime "why you'd like it" chips and
                the coral "you can't play this" ones without leaving the palette. */}
            {entryFee != null && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--ink-fill)] text-white">
                ₱{entryFee} entry fee
              </span>
            )}
            {/* Leads the row: "can I even play this" outranks every "why you'd like it". */}
            {restricted && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] ${
                  ineligible
                    ? 'bg-[var(--coral-soft)] text-[var(--coral)]'
                    : 'bg-[var(--lime)] text-[var(--ink)]'
                }`}
              >
                {ineligible ? `🔒 Not eligible · ${restricted}` : `${policy === 'women' ? '👩' : '👨'} ${restricted}`}
              </span>
            )}
            {/* Skill mismatch — same "can I even play this" indicator, keyed off the band. */}
            {skillIneligible && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--coral-soft)] text-[var(--coral)]">
                🔒 Not eligible{item.skillLabel ? ` · ${item.skillLabel}` : ''}
              </span>
            )}
            {item.why.map((w) => (
              <span key={w} className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--lime)] text-[var(--ink)]">{w}</span>
            ))}
          </div>
        )}

        {showBar ? (
          <div className="players-row">
            <div className="fill-track"><div className={`fill-bar${nearFull ? ' near-full' : ''}`} style={{ width: `${pct}%` }} /></div>
            <span className={`players-label${nearFull ? ' near-full' : ''}`}>{fillLabel}</span>
          </div>
        ) : fillLabel ? (
          <div className="players-row"><span className="players-label">{fillLabel}</span></div>
        ) : null}
      </div>
    </article>
  );
}
function OpenPlayJoined({ games, sessions, onNavigate, onLeave, busyId, emptyWithData, unfilteredCount }: { games: ApiGame[]; sessions: ApiOpenPlaySession[]; onNavigate: V2ScreenChrome['onNavigate']; onLeave: (g: ApiGame) => void; busyId: string | null; emptyWithData: string; unfilteredCount: number }) {
  if (unfilteredCount > 0 && (!games.length && !sessions.length)) return <Empty text={emptyWithData} />;
  if (!unfilteredCount) return <Empty text="Open Play sessions you join show up here." />;
  return <>{sessions.map((s) => <SessionCard key={'joined-session-' + s.id} session={s} onClick={() => onNavigate('open-play-detail', { source: 'session', id: s.id })} />)}{games.map((g) => <GameCard key={'joined-game-' + g.id} game={g} showVisibility onClick={() => onNavigate('open-play-detail', { source: 'game', id: g.id })} action={{ label: busyId === g.id ? 'Leaving...' : 'Leave', onClick: () => onLeave(g) }} />)}</>;
}
function OpenPlayManage({ games, bookings, mineGames, onNavigate, onDelete, onTogglePublish, busyId, emptyWithData, unfilteredCount }: { games: ApiGame[]; bookings: ApiBooking[]; mineGames: ApiGame[]; onNavigate: V2ScreenChrome['onNavigate']; onDelete: (g: ApiGame) => void; onTogglePublish: (b: ApiBooking) => void; busyId: string | null; emptyWithData: string; unfilteredCount: number }) {
  const totalItems = games.length + bookings.length;
  if (unfilteredCount > 0 && totalItems === 0) return <Empty text={emptyWithData} />;
  if (!unfilteredCount) return <Empty text="Open Play sessions you publish from bookings show up here." action={{ label: 'Book Court', onClick: () => onNavigate('book-court', {}) }} />;

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
  const chip = statusChip(b.status, b.cancellationType);
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
          <div className="game-meta-row">{PIN_SVG}{[b.venueName, court].filter(Boolean).join(' · ') || 'Venue TBA'}</div>
        </div>
        {!isPast && canPublishBooking(b) ? (
          <button
            type="button"
            className={`vis-indicator toggle ${isPublished ? 'public' : 'private'}`}
            disabled={isBusy}
            onClick={(e) => { e.stopPropagation(); onTogglePublish(b); }}
          >
            {isBusy ? '…' : isPublished ? 'Open Play' : 'Private play'}
          </button>
        ) : (
          <div className={`vis-indicator ${isPublished ? 'public' : 'private'}`}>{isPublished ? 'Open Play' : 'Private play'}</div>
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
