import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { apiImageUrl, listGames, listBookings, deleteGame, leaveGame, type ApiGame, type ApiBooking } from '../../../shared/lib/api';
import { canLeaveLobby } from '../gameDisplay';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { haversineKm, formatDistance, getCurrentLocation, type LatLng } from '../../../shared/lib/geo';

// Prefer the booked court's photo, then the venue's image, as an absolute URL.
function gameImage(g: ApiGame): string {
  return apiImageUrl(g.courtImage) || apiImageUrl(g.venue?.image) || '';
}

// Three game views:
//  - discover : open lobbies the user can join (ranked by the match scorer below —
//               distance + difficulty + open slots + schedule)
//  - mine     : lobbies the user created     (sort: newest-created or soonest-event)
//  - joined   : lobbies the user has joined  (sort: soonest-event)
type Tab = 'discover' | 'mine' | 'joined';
type MineSort = 'created' | 'event';

const MINE_SORT_LABELS: Record<MineSort, string> = {
  event: 'Soonest event',
  created: 'Recently created',
};
const MINE_SORT_OPTIONS: MineSort[] = ['event', 'created'];

// Discover sort options. "Recommended" is the blended match scorer (the default);
// the rest are single-factor sorts over the same list.
type DiscoverSort = 'recommended' | 'distance' | 'soonest' | 'openings';
const DISCOVER_SORT_LABELS: Record<DiscoverSort, string> = {
  recommended: 'Recommended',
  distance: 'Closest',
  soonest: 'Soonest',
  openings: 'Most open spots',
};
const DISCOVER_SORT_OPTIONS: DiscoverSort[] = ['recommended', 'distance', 'soonest', 'openings'];

// One reusable sort dropdown (custom, not a native <select> whose popup escaped
// the device-preview frame). Shared by Discover and My Games — only one shows at
// a time, so they can share the open-state + outside-click ref.
function SortMenu<T extends string>({ label, value, options, labels, open, setOpen, menuRef, onPick }: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  open: boolean;
  setOpen: (open: boolean) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  onPick: (value: T) => void;
}) {
  return (
    <div className="games-sort-control-row" ref={menuRef}>
      <span className="games-sort-label">Sort:</span>
      <div className="games-sort-control">
        <button
          type="button"
          className="games-sort-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: ${labels[value]}`}
          onClick={() => setOpen(!open)}
        >
          {labels[value]}
          <svg className="games-sort-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {open && (
          <ul className="games-sort-menu" role="listbox" aria-label={label}>
            {options.map((key) => (
              <li key={key} role="option" aria-selected={value === key}>
                <button
                  type="button"
                  className={`games-sort-menu-item${value === key ? ' active' : ''}`}
                  onClick={() => onPick(key)}
                >
                  {labels[key]}
                  {value === key && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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
// The venue's area/city, shown under the name so the card surfaces *where* it is.
function gameVenueLoc(g: ApiGame): string {
  const v = g.venue;
  return v ? [v.area, v.city].filter(Boolean).join(' · ') : '';
}
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

/* ---------------------------------------------------------------------------
 * Discover ranking — a small weighted scorer combining the four signals the
 * product asked for: distance, difficulty (skill match), open slots, and
 * schedule (soonest + steering away from days the user is already committed).
 * Each factor is normalised to 0–1 (higher = better), blended by WEIGHTS, then
 * a same-day conflict (an existing game/booking) applies a penalty. The list is
 * sorted by the resulting score, descending. All client-side over data Discover
 * already loads — no API change.
 * ------------------------------------------------------------------------- */
const WEIGHTS = { distance: 0.3, difficulty: 0.25, slots: 0.2, schedule: 0.25 };
const CONFLICT_PENALTY = 0.55; // score multiplier when the user already has something that day

// Closer is better: ~1 at the venue, ~0.5 at 8 km, tapering after. Unknown
// distance (no location, or the venue has no coords) gets a neutral-low score.
function distanceScore(km: number | null): number {
  if (km == null) return 0.4;
  return 1 / (1 + km / 8);
}

// A skill label → tier (1 beginner · 2 intermediate · 3 advanced); null = "all
// levels"/open (welcoming to anyone).
function skillTier(label?: string | null): number | null {
  const s = (label || '').toLowerCase();
  if (!s || s.includes('all') || s.includes('any') || s.includes('mix') || s.includes('open')) return null;
  if (s.includes('begin') || s.includes('new')) return 1;
  if (s.includes('adv') || s.includes('comp') || s.includes('pro')) return 3;
  return 2; // "intermediate" + anything else specific
}

// The user's tier from their DUPR-like skillLevel, else their label.
function userSkillTier(u: { skillLevel?: number; skillLevelLabel?: string } | null): number | null {
  if (u?.skillLevel != null) return u.skillLevel < 3 ? 1 : u.skillLevel < 4.5 ? 2 : 3;
  return skillTier(u?.skillLevelLabel ?? null);
}

// Exact level match scores best; an "all levels" game is broadly welcoming; an
// unknown user level stays neutral so difficulty doesn't dominate.
function difficultyScore(gameTier: number | null, userTier: number | null): number {
  if (gameTier == null) return 0.85;
  if (userTier == null) return 0.7;
  const gap = Math.abs(gameTier - userTier);
  return gap === 0 ? 1 : gap === 1 ? 0.55 : 0.2;
}

// Has room, and rewards lobbies that are filling up (more likely to actually
// run) over near-empty ones. Unknown capacity stays neutral; full scores 0.
function slotsScore(g: ApiGame): number {
  const cap = g.capacity ?? 0;
  if (cap <= 0 || g.spotsLeft == null) return 0.6;
  if (g.spotsLeft <= 0) return 0;
  return 0.5 + 0.5 * ((cap - g.spotsLeft) / cap);
}

// Sooner is better (today ~1, a week out ~0.5); dateless/past games sink.
function scheduleScore(ymd: string | null | undefined, todayStart: number): number {
  if (!ymd) return 0.3;
  const t = new Date(`${ymd}T00:00:00`).getTime();
  if (Number.isNaN(t)) return 0.3;
  const days = (t - todayStart) / 86_400_000;
  if (days < 0) return 0.15;
  return 1 / (1 + days / 7);
}

export function GamesScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, isLoggedIn } = chrome;
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? null;
  const isOrganizer = !!me && userHasPermission(me, 'organizer.access');

  const [tab, setTab] = useState<Tab>(isOrganizer ? 'mine' : 'discover');
  const [published, setPublished] = useState<ApiGame[]>([]);
  const [mineAll, setMineAll] = useState<ApiGame[]>([]);
  // Court bookings — used only to steer Discover away from days the user is
  // already committed (the schedule factor's conflict penalty).
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [loadingMine, setLoadingMine] = useState(isLoggedIn);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mineSort, setMineSort] = useState<MineSort>('event');
  const [discoverSort, setDiscoverSort] = useState<DiscoverSort>('recommended');
  // Custom sort dropdown (replaces a native <select>, whose popup rendered
  // outside the device-preview frame). Mirrors the v2-nearby sort.
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  // User location → Discover ranks the nearest lobby first.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<'locating' | 'on' | 'denied'>('locating');
  const days = useMemo(() => nextDays(7), []);
  // Per-card host/participant action (delete a lobby you host, leave one you joined).
  const [confirmId, setConfirmId] = useState<string | null>(null); // which card's confirm is open
  const [acting, setActing] = useState<string | null>(null);       // the id mid-request
  const [actionError, setActionError] = useState<string | null>(null);

  // Both delete + leave drop the lobby from the single `mineAll` source (which
  // feeds both the My Games "created" and Joined "joined" lists).
  const runAction = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setActing(id);
    setActionError(null);
    try {
      await fn(id);
      setMineAll((prev) => prev.filter((g) => g.id !== id));
      setConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setActing(null);
    }
  };

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

  // The user's court bookings — feeds the Discover conflict penalty (their joined/
  // created games already come from `mineAll`). Best-effort; guests skip it.
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    listBookings()
      .then((rows) => { if (alive) setBookings(rows); })
      .catch(() => { if (alive) setBookings([]); });
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

  // Days the user is already committed (their games + non-cancelled bookings) —
  // the schedule factor down-ranks Discover lobbies that land on these.
  const busyDates = useMemo(() => {
    const s = new Set<string>();
    for (const g of mineAll) if (g.date) s.add(g.date);
    for (const b of bookings) if (b.date && b.status !== 'cancelled') s.add(b.date);
    return s;
  }, [mineAll, bookings]);

  // Discover ordering — "Recommended" is the blended match scorer (distance +
  // difficulty + slots + schedule); the others are single-factor sorts.
  const discoverRanked = useMemo(() => {
    const list = discover.slice();
    if (discoverSort === 'distance') {
      // Nearest first; lobbies without coords (or before we have a location) sink.
      return list.sort((a, b) => {
        const da = distOf(a); const db = distOf(b);
        if (da == null && db == null) return byEvent(a, b);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    }
    if (discoverSort === 'soonest') return list.sort(byEvent);
    if (discoverSort === 'openings') {
      // Most open spots first; full/unknown sink, ties broken by soonest.
      const open = (g: ApiGame) => (g.spotsLeft != null && g.spotsLeft > 0 ? g.spotsLeft : -1);
      return list.sort((a, b) => open(b) - open(a) || byEvent(a, b));
    }
    // 'recommended' (default): the weighted match score.
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const userTier = userSkillTier(me);
    return list
      .map((g) => {
        const base =
          WEIGHTS.distance * distanceScore(distOf(g)) +
          WEIGHTS.difficulty * difficultyScore(skillTier(g.skillLabel), userTier) +
          WEIGHTS.slots * slotsScore(g) +
          WEIGHTS.schedule * scheduleScore(g.date, todayStart);
        const score = g.date && busyDates.has(g.date) ? base * CONFLICT_PENALTY : base;
        return { g, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discover, userLoc, me, busyDates, discoverSort]);

  // The current tab's full list (pre date-filter) — drives the date strip dots.
  const baseList = tab === 'discover' ? discover : tab === 'mine' ? created : joined;

  const visible = useMemo(() => {
    if (tab === 'discover') {
      // Already ranked; the day filter just narrows it (order preserved).
      return selectedDate ? discoverRanked.filter((g) => g.date === selectedDate) : discoverRanked;
    }
    const src = tab === 'mine' ? created : joined;
    const list = (selectedDate ? src.filter((g) => g.date === selectedDate) : src).slice();
    return list.sort(tab === 'mine' && mineSort === 'created' ? byCreated : byEvent);
  }, [tab, discoverRanked, created, joined, selectedDate, mineSort]);

  const loading = tab === 'discover' ? loadingDiscover : loadingMine;
  const needsAuth = tab !== 'discover' && !isLoggedIn;

  const subheading =
    tab === 'discover' ? 'Open games near you — best matches first.'
    : tab === 'mine' ? 'Game lobbies you’re hosting.'
    : 'Games you’ve joined.';

  const TABS: { value: Tab; label: string }[] = useMemo(() => {
    if (isOrganizer) {
      return [
        { value: 'mine', label: 'My Games' },
        { value: 'joined', label: 'Joined' },
      ];
    }
    return [
      { value: 'discover', label: 'Discover' },
      { value: 'mine', label: 'My Games' },
      { value: 'joined', label: 'Joined' },
    ];
  }, [isOrganizer]);
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

        {/* Controls row — Discover shows the sort dropdown (plus a "turn on
            location" nudge when location was denied, since distance feeds the
            ranking); My Games shows its own sort picker; Joined has none. */}
        {tab === 'discover' && (
          <div className="games-sort-row">
            <SortMenu
              label="Sort games"
              value={discoverSort}
              options={DISCOVER_SORT_OPTIONS}
              labels={DISCOVER_SORT_LABELS}
              open={sortOpen}
              setOpen={setSortOpen}
              menuRef={sortRef}
              onPick={(v) => { setDiscoverSort(v); setSortOpen(false); }}
            />
            {locStatus === 'denied' && (
              <button className="games-locate" onClick={locate}>📍 Turn on location</button>
            )}
          </div>
        )}
        {tab === 'mine' && (
          <div className="games-sort-row">
            <SortMenu
              label="Sort my games"
              value={mineSort}
              options={MINE_SORT_OPTIONS}
              labels={MINE_SORT_LABELS}
              open={sortOpen}
              setOpen={setSortOpen}
              menuRef={sortRef}
              onPick={(v) => { setMineSort(v); setSortOpen(false); }}
            />
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
          <V2Skeleton variant="game-list" count={5} />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-ring">🎾</div>
            <h3>No games here yet</h3>
            <p>{emptyCopy}</p>
            <button className="empty-cta" onClick={chrome.onHost}>Create a game</button>
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
                    {gameVenueLoc(g) && <div className="game-meta-loc">{gameVenueLoc(g)}</div>}
                  </div>
                  {s.cap > 0 && (
                    <div className="players-row">
                      <div className="fill-track"><div className={`fill-bar${s.almost ? ' near-full' : ''}`} style={{ width: `${s.pct}%` }} /></div>
                      <span className="players-label">{s.joined}/{s.cap}</span>
                    </div>
                  )}
                  {/* Host can delete the lobby they created; a member can leave one
                      they joined (within the grace period). Stops the click from
                      bubbling to the card's open-details navigation. */}
                  {(tab === 'mine' || tab === 'joined') && (
                    <div className="game-actions" onClick={(e) => e.stopPropagation()}>
                      {confirmId === g.id ? (
                        <div className="game-confirm">
                          <span className="game-confirm-text">{tab === 'mine' ? 'Delete this lobby?' : 'Leave this lobby?'}</span>
                          <div className="game-confirm-btns">
                            <button type="button" className="gc-keep" onClick={() => setConfirmId(null)} disabled={acting === g.id}>Keep</button>
                            <button
                              type="button"
                              className={`gc-go${tab === 'joined' ? ' leave' : ''}`}
                              onClick={() => runAction(g.id, tab === 'mine' ? deleteGame : leaveGame)}
                              disabled={acting === g.id}
                            >
                              {acting === g.id ? '…' : tab === 'mine' ? 'Delete' : 'Leave'}
                            </button>
                          </div>
                        </div>
                      ) : tab === 'joined' && !canLeaveLobby(g) ? (
                        <span className="game-action-locked">🔒 Spot locked in</span>
                      ) : (
                        <button
                          type="button"
                          className={`game-action-btn${tab === 'mine' ? ' danger' : ''}`}
                          onClick={() => { setConfirmId(g.id); setActionError(null); }}
                        >
                          {tab === 'mine' ? 'Delete lobby' : 'Leave lobby'}
                        </button>
                      )}
                      {actionError && confirmId === g.id && <div className="game-action-error">{actionError}</div>}
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
