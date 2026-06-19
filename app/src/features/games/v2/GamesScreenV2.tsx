import { useEffect, useMemo, useRef, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { apiImageUrl, listGames, type ApiGame } from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { haversineKm, formatDistance, getCurrentLocation, type LatLng } from '../../../shared/lib/geo';

// Prefer the booked court's photo, then the venue's image, as an absolute URL.
function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

// Three game views:
//  - discover : open lobbies the user can join (sorted by venue distance, nearest first)
//  - mine     : lobbies the user created     (sort: newest-created or soonest-event)
//  - joined   : lobbies the user has joined  (sort: soonest-event)
type Tab = 'discover' | 'mine' | 'joined';
type MineSort = 'created' | 'event';

const MINE_SORT_LABELS: Record<MineSort, string> = {
  event: 'Soonest event',
  created: 'Recently created',
};
const MINE_SORT_OPTIONS: MineSort[] = ['event', 'created'];

function typeBadge(g: ApiGame): { cls: string; label: string } {
  const t = (g.gameType || '').toLowerCase();
  if (t === 'doubles') return { cls: 'badge-competitive', label: 'Doubles' };
  if (t === 'singles') return { cls: 'badge-social', label: 'Singles' };
  return { cls: 'badge-open', label: 'Open Play' };
}
function gameTitle(g: ApiGame): string { return (g.title && g.title.trim()) || 'Pickleball game'; }
// Format a YYYY-MM-DD game date as a friendly day label ("Today" / "Tomorrow" /
// "Sat, Jun 20"). Parsed from local date parts so it doesn't shift by timezone.
function dayLabel(ymd?: string | null): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
// Always show the date when we have one; only the time falls back to "TBA".
function gameWhen(g: ApiGame): string {
  const day = dayLabel(g.date) || g.whenLabel || '';
  const time = g.timeLabel || '';
  if (day) return `${day} · ${time || 'Time TBA'}`;
  return time || 'Time TBA';
}
function gameVenue(g: ApiGame): string { return g.venue?.displayName || g.venueName || 'Venue TBA'; }
function slots(g: ApiGame): { joined: number; cap: number; pct: number; almost: boolean } {
  const cap = g.capacity ?? 0;
  const joined = g.participantCount ?? (cap && g.spotsLeft != null ? cap - g.spotsLeft : 0);
  const pct = cap > 0 ? Math.min(100, Math.round((joined / cap) * 100)) : 0;
  return { joined, cap, pct, almost: cap > 0 && g.spotsLeft != null && g.spotsLeft <= 1 };
}

// A game's venue coordinates, if it carries them (needed for the distance sort).
function gameCoords(g: ApiGame): LatLng | null {
  const lat = g.venue?.lat; const lng = g.venue?.lng;
  return lat != null && lng != null ? [lat, lng] : null;
}

// Build the next 7 days for the date strip.
function nextDays(n: number): { ymd: string; day: string; label: string }[] {
  const out: { ymd: string; day: string; label: string }[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' });
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    out.push({ ymd, day, label });
  }
  return out;
}

// Soonest event first; games with no date sink to the end.
const byEvent = (a: ApiGame, b: ApiGame) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99');
// The lobby's creation timestamp (Mongoose `timestamps` puts it on the payload;
// it isn't on the ApiGame type, so read it via a narrow cast).
const createdAtOf = (g: ApiGame) => String((g as { createdAt?: string | null }).createdAt || '');
// Newest lobby first (createdAt is an ISO string, so a reverse string compare works).
const byCreated = (a: ApiGame, b: ApiGame) => createdAtOf(b).localeCompare(createdAtOf(a));

export function GamesScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, isLoggedIn } = chrome;
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? null;

  const [tab, setTab] = useState<Tab>('discover');
  const [published, setPublished] = useState<ApiGame[]>([]);
  const [mineAll, setMineAll] = useState<ApiGame[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [loadingMine, setLoadingMine] = useState(isLoggedIn);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mineSort, setMineSort] = useState<MineSort>('event');
  // Custom sort dropdown (replaces a native <select>, whose popup rendered
  // outside the device-preview frame). Mirrors the v2-nearby sort.
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  // User location → Discover ranks the nearest lobby first.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<'locating' | 'on' | 'denied'>('locating');
  const days = useMemo(() => nextDays(7), []);

  // Close the sort menu on an outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  // Open, joinable lobbies for Discover (the default tab, so fetch on mount).
  useEffect(() => {
    let alive = true;
    listGames({ status: 'published' })
      .then((rows) => { if (alive) setPublished(rows); })
      .catch(() => { if (alive) setPublished([]); })
      .finally(() => { if (alive) setLoadingDiscover(false); });
    return () => { alive = false; };
  }, []);

  // The user's created + joined lobbies (one fetch, split below by creator).
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    listGames({ mine: true })
      .then((rows) => { if (alive) setMineAll(rows); })
      .catch(() => { if (alive) setMineAll([]); })
      .finally(() => { if (alive) setLoadingMine(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  // Best-effort locate on mount so Discover can rank by proximity (locStatus
  // already starts 'locating', so the effect body sets no state synchronously).
  useEffect(() => {
    getCurrentLocation()
      .then((loc) => { setUserLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  }, []);
  const locate = () => {
    setLocStatus('locating');
    getCurrentLocation()
      .then((loc) => { setUserLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  };

  const distOf = (g: ApiGame): number | null => {
    if (!userLoc) return null;
    const c = gameCoords(g);
    return c ? haversineKm(userLoc, c) : null;
  };
  // Nearest first; lobbies without coords (or before we have a location) sink to the end.
  const byDistance = (a: ApiGame, b: ApiGame) => {
    const da = distOf(a); const db = distOf(b);
    if (da == null && db == null) return byEvent(a, b);
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  };

  // Split "mine" into lobbies I created vs ones I only joined.
  const created = useMemo(
    () => mineAll.filter((g) => !!myId && g.creatorId === myId),
    [mineAll, myId],
  );
  const joined = useMemo(
    () => mineAll.filter((g) => !(myId && g.creatorId === myId)),
    [mineAll, myId],
  );
  // Discover hides lobbies I'm already in (created or joined).
  const discover = useMemo(() => {
    const mineIds = new Set(mineAll.map((g) => g.id));
    return published.filter((g) => !mineIds.has(g.id));
  }, [published, mineAll]);

  // The current tab's full list (pre date-filter) — drives the date strip dots.
  const baseList = tab === 'discover' ? discover : tab === 'mine' ? created : joined;

  const visible = useMemo(() => {
    const list = (selectedDate ? baseList.filter((g) => g.date === selectedDate) : baseList).slice();
    if (tab === 'discover') return list.sort(byDistance);
    if (tab === 'mine') return list.sort(mineSort === 'created' ? byCreated : byEvent);
    return list.sort(byEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, baseList, selectedDate, mineSort, userLoc]);

  const loading = tab === 'discover' ? loadingDiscover : loadingMine;
  const needsAuth = tab !== 'discover' && !isLoggedIn;

  const subheading =
    tab === 'discover' ? 'Open games near you — closest first.'
    : tab === 'mine' ? 'Game lobbies you’re hosting.'
    : 'Games you’ve joined.';

  const TABS: { value: Tab; label: string }[] = [
    { value: 'discover', label: 'Discover' },
    { value: 'mine', label: 'My Games' },
    { value: 'joined', label: 'Joined' },
  ];
  const selectTab = (value: Tab) => { setTab(value); setSelectedDate(null); };

  const emptyCopy =
    tab === 'discover' ? 'No open games right now.'
    : tab === 'mine' ? 'Games you create show up here.'
    : 'Games you join show up here.';

  return (
    <V2Shell screen="v2-games" chrome={chrome}>
      <div className="page-content">
        <div className="games-intro">
          <h1 className="games-heading">Games</h1>
          <p className="games-subheading">{subheading}</p>
        </div>

        {/* Discover · My Games · Joined */}
        <div className="tab-group-row">
          <div className="tab-group" role="tablist" aria-label="Games view">
            {TABS.map((t) => (
              <button
                key={t.value}
                className={`seg-btn${tab === t.value ? ' active' : ''}`}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => selectTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter by day — labelled, with a leading "All days" chip so it reads
            as a day filter (and gives an obvious way to clear it). */}
        <div className="date-filter">
          <div className="date-filter-label">Filter by day</div>
          <div className="date-strip-wrap">
            <div className="date-strip" role="group" aria-label="Filter games by day">
              <button
                className={`date-chip date-chip-all${!selectedDate ? ' active' : ''}`}
                aria-pressed={!selectedDate}
                onClick={() => setSelectedDate(null)}
              >
                <span className="date-day">All</span>
                <span className="date-label">days</span>
              </button>
              {days.map((d) => {
                const has = baseList.some((g) => g.date === d.ymd);
                const active = selectedDate === d.ymd;
                return (
                  <button
                    key={d.ymd}
                    className={`date-chip${active ? ' active' : ''}${has && !active ? ' has-games' : ''}`}
                    aria-pressed={active}
                    onClick={() => setSelectedDate(active ? null : d.ymd)}
                  >
                    <span className="date-day">{d.day}</span>
                    <span className="date-label">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Controls row — only a real control shows: the My Games sort picker, or
            a "turn on location" prompt for Discover when location was denied. The
            sort method itself isn't spelled out (it's implicit). */}
        {(tab === 'mine' || (tab === 'discover' && locStatus === 'denied')) && (
          <div className="games-sort-row">
            {tab === 'discover' ? (
              <button className="games-locate" onClick={locate}>📍 Turn on location for nearest games</button>
            ) : (
              <div className="games-sort-control-row" ref={sortRef}>
                <span className="games-sort-label">Sort:</span>
                <div className="games-sort-control">
                  <button
                    type="button"
                    className="games-sort-btn"
                    aria-haspopup="listbox"
                    aria-expanded={sortOpen}
                    aria-label={`Sort my games: ${MINE_SORT_LABELS[mineSort]}`}
                    onClick={() => setSortOpen((o) => !o)}
                  >
                    {MINE_SORT_LABELS[mineSort]}
                    <svg className="games-sort-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {sortOpen && (
                    <ul className="games-sort-menu" role="listbox" aria-label="Sort my games">
                      {MINE_SORT_OPTIONS.map((key) => (
                        <li key={key} role="option" aria-selected={mineSort === key}>
                          <button
                            type="button"
                            className={`games-sort-menu-item${mineSort === key ? ' active' : ''}`}
                            onClick={() => { setMineSort(key); setSortOpen(false); }}
                          >
                            {MINE_SORT_LABELS[key]}
                            {mineSort === key && (
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
        )}

        {needsAuth ? (
          <div className="empty-state">
            <div className="empty-icon-ring">🔒</div>
            <h3>Sign in to see {tab === 'mine' ? 'your games' : 'joined games'}</h3>
            <p>{tab === 'mine' ? 'Lobbies you host show up here.' : 'Games you join show up here.'}</p>
            <button className="empty-cta" onClick={() => onNavigate('login')}>Sign in</button>
          </div>
        ) : loading ? (
          <p className="game-meta" style={{ padding: '20px 4px' }}>Loading games…</p>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-ring">🎾</div>
            <h3>No games here yet</h3>
            <p>{emptyCopy}</p>
            <button className="empty-cta" onClick={chrome.onCreate}>Create a game</button>
          </div>
        ) : (
          visible.map((g) => {
            const badge = typeBadge(g);
            const s = slots(g);
            const dist = tab === 'discover' ? distOf(g) : null;
            return (
              <a key={g.id} className="game-card" role="button" onClick={() => onNavigate('game-details', { id: g.id })}>
                <div className="game-thumb" style={gameImage(g) ? { backgroundImage: `url(${gameImage(g)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                  <span className={`game-type-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="game-body">
                  <div className="game-title">{gameTitle(g)}</div>
                  <div className="game-meta">
                    <div className="game-meta-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {gameWhen(g)}
                    </div>
                    <div className="game-meta-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {dist != null && <strong className="game-dist">{formatDistance(dist)}</strong>}
                      {dist != null && <span className="game-dist-sep">·</span>}
                      {gameVenue(g)}
                    </div>
                  </div>
                  {s.cap > 0 && (
                    <div className="players-row">
                      <div className="fill-track"><div className={`fill-bar${s.almost ? ' near-full' : ''}`} style={{ width: `${s.pct}%` }} /></div>
                      <span className="players-label">{s.joined}/{s.cap}</span>
                    </div>
                  )}
                </div>
              </a>
            );
          })
        )}
      </div>
    </V2Shell>
  );
}
