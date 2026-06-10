import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
// import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { useDemoState } from '../../shared/lib/demoState';
import type { Navigate } from '../../shared/lib/navigation';
import { firstNameOf } from '../../shared/lib/permissions';
import { useAuthStore } from '../../shared/lib/authStore';
import { listGames, listBookings, listVenues, listAllVenues, apiImageUrl, type ApiGame, type ApiBooking, type ApiVenue } from '../../shared/lib/api';
import { venueCoords } from '../../shared/lib/venueDisplay';
import { getCurrentLocation, haversineKm, formatDistance, type LatLng } from '../../shared/lib/geo';

interface HomeScreenRefinedProps {
  onNavigate: Navigate;
}

// Quick-access shortcuts (layout from the provided "new homepage" design,
// rendered with the existing PickleBallers icons + tokens).
type QuickAction = { label: string; icon: string; lime?: boolean; go: (n: Navigate) => void };

const QUICK: QuickAction[] = [
  { label: 'Join game', icon: 'paddle', lime: true, go: (n) => n('games') },
  { label: 'Book court', icon: 'calendar', go: (n) => n('nearby') },
  { label: 'Create match', icon: 'plus', go: (n) => n('create-game') },
  { label: 'Find players', icon: 'groups', go: (n) => n('search') },
];

// Guests get a sign-up shortcut as the leading action; it drops into the
// login / join flow. The lime highlight moves onto it so the row keeps a
// single primary CTA (Join game falls back to a plain tile for guests).
const GUEST_QUICK: QuickAction = {
  label: 'Create an Account',
  icon: 'user',
  lime: true,
  go: (n) => n('login'),
};

/* ─── Hero data model ──────────────────────────────────────────────
 * The hero is the "what's next for me?" surface — the first thing a
 * player should see. It is STATE-AWARE: a commitment card when you have
 * an upcoming game OR court booking, otherwise it flips to the fastest
 * way into a game. Driven by the player's real games + bookings feeds. */

type AvatarVariant = 'blue' | 'coral' | 'lime';

/** The player's next commitment — either an open-play game or a court booking. */
interface NextCommitment {
  kind: 'game' | 'booking';
  id: string;
  title: string;
  timeLabel: string; // "7:00 AM"
  venueId: string;
  venueName: string;
  /** Minutes until start; ≤0 means it has already started. Drives urgency. */
  startsInMinutes: number;
  roster: { name: string; variant: AvatarVariant }[];
  extraPlayers: number; // shown as "+N" after the roster avatars (games)
  playerCount?: number; // bookings: party size (no named roster)
}

/** The featured open game the hero falls back to when you have nothing booked.
 *  Only the fields `FindGameHero` renders — the rest of `ApiGame` isn't needed. */
interface FeaturedGame {
  id: string;
  title: string;
  time: string;
  loc: string;
  spots: string;
}

const ROSTER_VARIANTS: AvatarVariant[] = ['blue', 'coral', 'lime'];

// Local game formatters. Home must not import the `games` slice's
// `gameDisplay.ts` across features (shared-only rule), and these are small
// enough to keep inline; they intentionally mirror that module's behavior.

/** Best-effort epoch-ms for a game's start, from its `date` + display time. */
function gameStartMs(g: ApiGame): number | null {
  if (!g.date) return null;
  const base = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const m = (g.timeLabel || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = m[3]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    base.setHours(h, parseInt(m[2], 10), 0, 0);
  }
  return base.getTime();
}

/** The game's own title, else a derived "Doubles · 3.0–3.5"-style label. */
function heroTitle(g: ApiGame): string {
  if (g.title) return g.title;
  const type = g.gameType ? g.gameType[0].toUpperCase() + g.gameType.slice(1) : 'Open';
  return g.skillLabel ? `${type} · ${g.skillLabel}` : `${type} game`;
}

/** "Riverside · Makati" (real venue) / the free-text name / "Venue TBD". */
function heroVenue(g: ApiGame): string {
  const v = g.venue;
  if (v) return [v.displayName, v.area || v.city].filter(Boolean).join(' · ');
  return g.venueName || 'Venue TBD';
}

/** "3 spots open" / "1 spot open" / "Full". */
function heroSpots(g: ApiGame): string {
  const n = g.spotsLeft ?? 0;
  return n > 0 ? `${n} ${n === 1 ? 'spot' : 'spots'} open` : 'Full';
}

/** Best-effort epoch-ms for a booking's start, from its `date` + 24h `startTime`. */
function bookingStartMs(b: ApiBooking): number | null {
  if (!b.date) return null;
  const base = new Date(`${b.date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const m = (b.startTime || '').match(/(\d{1,2}):(\d{2})/);
  if (m) base.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return base.getTime();
}

/** "18:30" (24h) → "6:30 PM"; passes through anything it can't parse. */
function clockLabel(time?: string | null): string {
  if (!time) return '';
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

function gameToCommitment(g: ApiGame, ms: number): NextCommitment {
  const v = g.venue;
  const roster = (g.participants ?? []).slice(0, 2).map((p, i) => ({
    name: p.displayName || 'Player',
    variant: ROSTER_VARIANTS[i % ROSTER_VARIANTS.length],
  }));
  const total = g.participantCount ?? g.participants?.length ?? roster.length;
  return {
    kind: 'game',
    id: g.id,
    title: heroTitle(g),
    timeLabel: g.timeLabel || g.whenLabel || '',
    venueId: v?.id ?? g.venueId ?? '',
    venueName: heroVenue(g),
    startsInMinutes: Math.round((ms - Date.now()) / 60_000),
    roster,
    extraPlayers: Math.max(0, total - roster.length),
  };
}

function bookingToCommitment(b: ApiBooking, ms: number): NextCommitment {
  return {
    kind: 'booking',
    id: b.id,
    // A booking has no title of its own — the venue (court) is the headline.
    title: b.venueName || 'Court booking',
    timeLabel: clockLabel(b.startTime),
    // The bookings list populates `venueId` as the whole venue object, so it's
    // not a usable id — navigate Directions by the clean `venueSlug` instead
    // (getVenue accepts a slug or an _id).
    venueId: b.venueSlug ?? '',
    venueName: b.venueName || 'Court booking',
    startsInMinutes: Math.round((ms - Date.now()) / 60_000),
    roster: [],
    extraPlayers: 0,
    playerCount: b.playerCount ?? undefined,
  };
}

/** The player's soonest upcoming commitment across games AND court bookings,
 *  or null. Needs a parseable start to drive the countdown; a 3h grace keeps
 *  one that just started showing as "Happening now". */
function pickNextCommitment(games: ApiGame[], bookings: ApiBooking[]): NextCommitment | null {
  const now = Date.now();
  const GRACE = 3 * 3_600_000;
  const candidates: { ms: number; c: NextCommitment }[] = [];
  for (const g of games) {
    if (g.status === 'cancelled') continue;
    const ms = gameStartMs(g);
    if (ms == null || ms < now - GRACE) continue;
    candidates.push({ ms, c: gameToCommitment(g, ms) });
  }
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const ms = bookingStartMs(b);
    if (ms == null || ms < now - GRACE) continue;
    candidates.push({ ms, c: bookingToCommitment(b, ms) });
  }
  return candidates.sort((a, b) => a.ms - b.ms)[0]?.c ?? null;
}

/** The best open game to feature — first with spots left, else the first one. */
function pickFeaturedGame(games: ApiGame[]): ApiGame | null {
  const live = games.filter((g) => g.status !== 'cancelled');
  return live.find((g) => (g.spotsLeft ?? 0) > 0) ?? live[0] ?? null;
}

function toFeaturedGame(g: ApiGame): FeaturedGame {
  return {
    id: g.id,
    title: heroTitle(g),
    time: g.timeLabel || g.whenLabel || '',
    loc: heroVenue(g),
    spots: heroSpots(g),
  };
}

type Urgency = 'live' | 'imminent' | 'soon' | 'scheduled';

/** How close the game is — decides which actions the hero surfaces. */
function urgencyOf(mins: number): Urgency {
  if (mins <= 0) return 'live';
  if (mins <= 360) return 'imminent'; // within 6h — check-in window opens
  if (mins <= 2880) return 'soon'; // within 48h
  return 'scheduled';
}

/** "Happening now" / "In 45m" / "In 4h" / "Tomorrow" / "In 3 days". */
function countdownLabel(mins: number): string {
  if (mins <= 0) return 'Happening now';
  if (mins < 60) return `In ${mins}m`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `In ${h}h ${m}m` : `In ${h}h`;
  }
  const d = Math.round(mins / 1440);
  return d === 1 ? 'Tomorrow' : `In ${d} days`;
}

/* ─── Open-games + courts card helpers ─────────────────────────────── */

/** "Today" / "Tomorrow" / "Sat" from a game's date (else its when label). */
/** The venue's short display name (no area) for the card's compact slot. */
function venueShortName(g: ApiGame): string {
  return g.venue?.displayName || g.venueName || 'Venue TBD';
}

/** "Makati Pickleball Club · Makati" — venue + its area/city when known. */
function gameVenueLine(g: ApiGame): string {
  const name = venueShortName(g);
  const area = g.venue?.area || g.venue?.city || '';
  return area ? `${name} · ${area}` : name;
}

/** Hour + meridiem for the compact time box, e.g. "8:00 AM" → { big: '8', small: 'AM' };
 *  falls back to the day-of-month + weekday when there's no parseable time. */
function gameTimeBox(g: ApiGame): { big: string; small: string } {
  const m = (g.timeLabel || '').match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)/i);
  if (m) return { big: m[1], small: m[2].toUpperCase() };
  if (g.date) {
    const d = new Date(`${g.date}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return { big: String(d.getDate()), small: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()] };
    }
  }
  return { big: (g.whenLabel || '—').slice(0, 3).toUpperCase(), small: '' };
}

/** Area/city line for a venue card. */
function venueArea(v: ApiVenue): string {
  return v.area || v.city || v.region || '';
}

/** A real headline stat for a venue card (rating → price → court count). */
function venueStat(v: ApiVenue): string {
  if (v.googleRating) return `${v.googleRating.toFixed(1)} ★`;
  if (v.priceFromLabel) return v.priceFromLabel;
  if (typeof v.priceFrom === 'number') return `₱${v.priceFrom}`;
  if (v.courtCount) return `${v.courtCount} court${v.courtCount === 1 ? '' : 's'}`;
  return '';
}

// Gradient fallbacks for venue thumbnails without a media image.
const COURT_GRADIENTS = [
  'linear-gradient(135deg, #0040e0 0%, #6c83ff 100%)',
  'linear-gradient(135deg, #1a1d24 0%, #404756 100%)',
  'linear-gradient(135deg, #2455f4 0%, #5F7CFF 100%)',
  'linear-gradient(135deg, #4c6700 0%, #93b300 100%)',
];

const OPEN_GREEN = '#4c6700'; // design "secondary" green for positive status
const HERO_GRADIENT = 'linear-gradient(135deg, #2455f4 0%, #5F7CFF 90%)';

export function HomeScreenRefined({ onNavigate }: HomeScreenRefinedProps) {
  const currentUser = useAuthStore((s) => s.user);
  const userId = currentUser?.id;
  const firstName = firstNameOf(currentUser);
  const { state: demoState } = useDemoState();

  // State-aware hero + live home feeds. One fetch loads the player's next
  // commitment (games `mine` + court bookings), the open-games feed
  // (`published`, also the hero fallback), and a few venues to book.
  const [myGames, setMyGames] = useState<ApiGame[]>([]);
  const [myBookings, setMyBookings] = useState<ApiBooking[]>([]);
  const [openGames, setOpenGames] = useState<ApiGame[]>([]);
  const [courts, setCourts] = useState<ApiVenue[]>([]);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // The `empty` reviewer mode mirrors a brand-new player (nothing scheduled,
    // nothing nearby) → preview the create-a-game hero; skip the fetch.
    if (demoState === 'empty') {
      setMyGames([]);
      setMyBookings([]);
      setOpenGames([]);
      setCourts([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([
      userId ? listGames({ mine: true }).catch(() => [] as ApiGame[]) : Promise.resolve([] as ApiGame[]),
      userId ? listBookings().catch(() => [] as ApiBooking[]) : Promise.resolve([] as ApiBooking[]),
      listGames({ status: 'published' }).catch(() => [] as ApiGame[]),
      listVenues({ pageSize: 6 }).then((p) => p.items).catch(() => [] as ApiVenue[]),
    ])
      .then(([mine, bookings, open, venues]) => {
        if (!alive) return;
        setMyGames(mine);
        setMyBookings(bookings);
        setOpenGames(open);
        setCourts(venues);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, demoState, reloadKey]);

  // Best-effort: ask for the user's location once so "Courts to book" can rank
  // by distance. If denied/unavailable, we silently stay with the plain list.
  useEffect(() => {
    if (demoState === 'empty') return;
    let alive = true;
    getCurrentLocation()
      .then((loc) => { if (alive) setUserLoc(loc); })
      .catch(() => { /* keep the plain directory list */ });
    return () => { alive = false; };
  }, [demoState]);

  // Once located, pull the full directory so the nearest courts (not just the
  // first page) can surface.
  useEffect(() => {
    if (!userLoc || demoState === 'empty') return;
    let alive = true;
    listAllVenues()
      .then((all) => { if (alive) setCourts(all); })
      .catch(() => { /* keep whatever the initial fetch loaded */ });
    return () => { alive = false; };
  }, [userLoc, demoState, reloadKey]);

  const refetch = () => setReloadKey((k) => k + 1);

  // Guests see "Create an Account" up front; the rest stay, minus Join game's
  // lime accent so the new sign-up tile is the only highlighted action.
  const quick: QuickAction[] = currentUser
    ? QUICK
    : [GUEST_QUICK, ...QUICK.map((q) => ({ ...q, lime: false }))];

  const nextCommitment = pickNextCommitment(myGames, myBookings);
  const topOpen = pickFeaturedGame(openGames);
  const featuredOpenGame = topOpen ? toFeaturedGame(topOpen) : null;

  // Open-games list: drop the one already featured in the hero (only featured
  // when there's no commitment), exclude games you're already in (hosting or
  // joined — no "Join" on your own game), and keep joinable games only.
  const heroFeaturedId = nextCommitment ? undefined : topOpen?.id;
  const myGameIds = new Set(myGames.map((g) => g.id));
  const openList = openGames
    .filter((g) => g.id !== heroFeaturedId && !myGameIds.has(g.id) && (g.spotsLeft ?? 1) > 0)
    .slice(0, 4);
  // When located, rank the locatable courts nearest-first and attach a distance;
  // otherwise fall back to the directory order with no distance.
  const courtList = useMemo<{ venue: ApiVenue; km: number | null }[]>(() => {
    if (userLoc) {
      const ranked = courts
        .map((v) => ({ venue: v, coords: venueCoords(v) }))
        .filter((r): r is { venue: ApiVenue; coords: [number, number] } => !!r.coords)
        .map((r) => ({ venue: r.venue, km: haversineKm(userLoc, r.coords) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 6);
      if (ranked.length > 0) return ranked;
      // Located but no venue carries coordinates → fall back to the plain list.
    }
    return courts.slice(0, 4).map((v) => ({ venue: v, km: null }));
  }, [courts, userLoc]);

  return (
    <div className="scroll safe-top safe-bottom home-refined">
      {/* Header: avatar + greeting (left), bell (right) */}
      <div className="app-header">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('profile')} aria-label="Open profile">
            <Avatar src={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'Guest'} size={40} />
          </button>
          <div>
            <div className="font-heading font-extrabold text-[20px] tracking-[-0.01em] leading-tight text-[var(--primary)]">
              {firstName ? `Hey ${firstName} 👋` : 'Hey there 👋'}
            </div>
            <div className="text-[13px] text-[var(--muted)] mt-0.5">Find a game in seconds</div>
          </div>
        </div>
        <button
          onClick={() => onNavigate('notifications')}
          aria-label="Notifications"
          className="w-10 h-10 rounded-full bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
        >
          <Icon name="bell" size={18} />
        </button>
      </div>

      <div className="px-5 lg:px-0 mt-4 space-y-6 lg:space-y-8">
        {/* Hero — state-aware: your next commitment, else find a game, else create one */}
        {loading ? (
          <div
            className="rounded-[28px] min-h-[210px] w-full animate-pulse bg-[var(--surface-2)] shadow-[var(--shadow-pop)]"
            aria-busy="true"
          />
        ) : nextCommitment ? (
          <CommitmentHero commitment={nextCommitment} onNavigate={onNavigate} />
        ) : featuredOpenGame ? (
          <FindGameHero game={featuredOpenGame} onNavigate={onNavigate} />
        ) : (
          <CreateGameHero onNavigate={onNavigate} />
        )}

        {/* Quick access row */}
        <div className="flex justify-start gap-3 lg:gap-5 overflow-x-auto scrollbar-none pb-1">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => q.go(onNavigate)}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-[var(--shadow-card)] active:scale-90 transition-transform ${
                  q.lime
                    ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                    : 'bg-[var(--surface)] text-[var(--primary)] border-[0.5px] border-[var(--hairline)]'
                }`}
              >
                <Icon name={q.icon} size={26} />
              </div>
              <span className="w-16 text-center text-[10px] font-extrabold tracking-[0.06em] uppercase leading-tight text-[var(--ink-2)]">
                {q.label}
              </span>
            </button>
          ))}
        </div>

        <DemoBranch
          loading={
            <div className="space-y-3">
              <LoadingSkeleton variant="block" count={1} />
              <LoadingSkeleton variant="card" count={3} />
            </div>
          }
          error={
            <ErrorState
              title="Couldn't load games"
              message="We couldn't reach the courts feed. Pull down to retry or check back in a moment."
              onRetry={refetch}
            />
          }
          empty={
            <EmptyState
              icon="paddle"
              title="No open games near you"
              description="Be the first to post one — your neighbors are looking for partners."
              action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
            />
          }
        >
          <div className="space-y-6 lg:space-y-8">
            {/* Open games near you */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="hd-2">Open games near you</div>
                <button
                  className="text-[var(--primary)] font-bold text-[13px]"
                  onClick={() => onNavigate('games')}
                >
                  View all
                </button>
              </div>
              {loading ? (
                <LoadingSkeleton variant="card" count={2} />
              ) : openList.length === 0 ? (
                <EmptyState
                  icon="paddle"
                  title="No open games right now"
                  description="Be the first to post one — your neighbors are looking for partners."
                  action={{ label: 'Create a game', onPress: () => onNavigate('create-game') }}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {openList.map((g) => {
                    const tb = gameTimeBox(g);
                    const left = g.spotsLeft ?? 0;
                    const full = left <= 0;
                    return (
                      <div
                        key={g.id}
                        className="bg-[var(--surface)] rounded-2xl p-4 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex items-center gap-3.5"
                      >
                        {/* time box */}
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-[var(--lime-soft)] text-[var(--lime-ink)] flex flex-col items-center justify-center">
                          <span className="font-heading font-bold text-[20px] leading-none">{tb.big}</span>
                          {tb.small && <span className="text-[10px] font-bold mt-0.5 tracking-wide">{tb.small}</span>}
                        </div>
                        {/* title + venue */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: OPEN_GREEN }} />
                            <span className="hd-3 text-[15px] truncate">{heroTitle(g)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[12px] text-[var(--muted)] mt-1.5 min-w-0">
                            <Icon name="location" size={12} />
                            <span className="truncate">{gameVenueLine(g)}</span>
                          </div>
                        </div>
                        {/* Join + spots */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <button
                            onClick={() => onNavigate('game-details', { id: g.id })}
                            disabled={full}
                            className="px-5 py-2 rounded-full bg-[var(--coral)] text-white text-[13px] font-heading font-semibold active:scale-95 transition-transform disabled:opacity-50"
                          >
                            {full ? 'Full' : 'Join'}
                          </button>
                          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: full ? 'var(--muted)' : 'var(--primary)' }}>
                            {full ? 'No spots' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Social check-in */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--lime-soft)] border-[0.5px] border-[rgba(193,241,0,0.5)]">
              <div className="relative shrink-0">
                <div className="flex -space-x-2">
                  {(['Coach Mike', 'Sarah K'] as const).map((n, i) => (
                    <Avatar
                      key={n}
                      name={n}
                      variant={(['blue', 'coral'] as const)[i]}
                      size={32}
                      className="border-2 border-white"
                    />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[var(--surface-3)] flex items-center justify-center text-[10px] font-bold text-[var(--ink-2)]">
                    +3
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--coral)] border-2 border-white animate-pulse" />
              </div>
              <p className="text-[14px] text-[var(--lime-ink)] leading-tight">
                <strong className="font-extrabold">5 players</strong> checked in at{' '}
                <strong className="font-extrabold">Riverside Courts</strong>
              </p>
            </div>

            {/* Courts to book */}
            {(loading || courtList.length > 0) && (
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="hd-2">{userLoc ? 'Courts near you' : 'Courts to book'}</div>
                  <button
                    className="text-[var(--primary)] font-bold text-[13px]"
                    onClick={() => onNavigate('nearby')}
                  >
                    View all
                  </button>
                </div>
                {loading ? (
                  <div className="flex gap-3.5 overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-60 h-[264px] rounded-2xl bg-[var(--surface-2)] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="scroll-x flex gap-3.5 pb-1 -mx-4 px-4">
                    {courtList.map(({ venue: v, km }, i) => {
                      const img = apiImageUrl(v.image || v.mainImageUrl);
                      const area = venueArea(v);
                      // When located, the distance is the most useful stat; else fall
                      // back to the rating/price/court-count stat.
                      const stat = km != null ? formatDistance(km) : venueStat(v);
                      return (
                        <div
                          key={v.id}
                          className="shrink-0 w-60 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] overflow-hidden flex flex-col"
                        >
                          <div
                            className="w-full h-36 bg-cover bg-center"
                            style={img ? { backgroundImage: `url(${img})` } : { background: COURT_GRADIENTS[i % COURT_GRADIENTS.length] }}
                          />
                          <div className="p-4 flex flex-col gap-3 flex-1">
                            <div className="min-w-0">
                              <div className="hd-3 text-[16px] truncate leading-snug">{v.displayName}</div>
                              {(area || stat) && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  {area && <span className="text-[13px] text-[var(--muted)] truncate">{area}</span>}
                                  {area && stat && <span className="w-1 h-1 rounded-full bg-[var(--muted)] shrink-0" />}
                                  {stat && (
                                    <span className="text-[13px] font-bold shrink-0 flex items-center gap-0.5" style={{ color: OPEN_GREEN }}>
                                      {km != null && <Icon name="location" size={12} />}{stat}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => onNavigate('court-details', { id: v.id })}
                              className="mt-auto w-full border-[0.5px] border-[var(--hairline)] py-2.5 rounded-full font-heading font-semibold text-[14px] text-[var(--ink)] active:scale-95 transition-transform"
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </DemoBranch>

        {/* Streak card */}
        <div className="relative overflow-hidden rounded-[24px] p-5 flex items-center justify-between gap-4 bg-[#2e303a] text-white">
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-[rgba(186,246,3,0.06)] blur-2xl pointer-events-none" />
          <div className="relative z-[1] space-y-1">
            <div className="text-[10px] font-extrabold tracking-[0.08em] uppercase text-[var(--lime)]">
              This week
            </div>
            <div className="font-heading font-bold text-[19px] leading-tight">
              You're on a 4-game streak 🔥
            </div>
            <div className="text-[12px] opacity-60">Keep it going today</div>
          </div>
          <div className="relative z-[1] w-14 h-14 rounded-full bg-[rgba(186,246,3,0.12)] flex items-center justify-center shrink-0">
            <Icon name="fire" size={30} className="text-[var(--lime)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero variants ────────────────────────────────────────────────── */

// Pill button styles shared across hero variants.
const limePill =
  'h-12 px-6 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-extrabold text-[15px] inline-flex items-center gap-2 shadow-[0_8px_18px_-6px_rgba(186,246,3,0.45)] active:scale-95 transition-transform';
const ghostPill =
  'h-12 px-5 rounded-full bg-[rgba(255,255,255,0.16)] text-white font-heading font-semibold text-[14px] inline-flex items-center gap-2 border border-[rgba(255,255,255,0.22)] active:scale-95 transition-transform';
/** "TODAY" / "TOMORROW" / "SAT" for the hero eyebrow, from minutes-until-start. */
function commitmentDay(startsInMinutes: number): string {
  const start = new Date(Date.now() + startsInMinutes * 60_000);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  return start.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

/** Variant 1 — you have an upcoming commitment (game or court booking).
 *  Actions adapt to how close it is and which kind it is. */
function CommitmentHero({ commitment, onNavigate }: { commitment: NextCommitment; onNavigate: Navigate }) {
  const isBooking = commitment.kind === 'booking';
  const isLive = urgencyOf(commitment.startsInMinutes) === 'live';
  const eyebrow = isLive ? 'HAPPENING NOW' : `UP NEXT · ${commitmentDay(commitment.startsInMinutes)}`;
  // Right-aligned countdown reads "in 2h 15m"; live just says "now".
  const countdownRight = isLive ? 'now' : countdownLabel(commitment.startsInMinutes).replace(/^In /, 'in ');

  // Tapping the card opens the game/booking; the pill gives one-tap directions.
  const open = () => (isBooking ? onNavigate('my-bookings') : onNavigate('game-details', { id: commitment.id }));
  const total = commitment.roster.length + commitment.extraPlayers;

  return (
    <div
      className="relative overflow-hidden rounded-[24px] p-5 lg:p-6 w-full text-white shadow-[var(--shadow-pop)]"
      style={{ background: HERO_GRADIENT }}
    >
      {/* Row 1 — status dot + label · countdown */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--lime)] opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--lime)]" />
          </span>
          <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-white/90 truncate">{eyebrow}</span>
        </div>
        <span className="text-[12px] font-semibold text-white/60 shrink-0">{countdownRight}</span>
      </div>

      {/* Title + meta + location (tap to open) */}
      <button onClick={open} className="block w-full text-left mt-3 active:opacity-90 transition-opacity">
        <div className="font-heading text-[26px] font-extrabold leading-[1.12] tracking-[-0.01em]">{commitment.title}</div>
        {commitment.timeLabel && (
          <div className="mt-1.5 text-[13px] font-semibold text-white/75">{commitment.timeLabel}</div>
        )}
        {/* For a booking the venue is already the headline — don't repeat it. */}
        {!isBooking && commitment.venueName && (
          <div className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-white/80">
            <Icon name="location" size={15} className="text-white/60 shrink-0" />
            <span className="truncate">{commitment.venueName}</span>
          </div>
        )}
      </button>

      <div className="my-4 h-px bg-white/20" />

      {/* Row 2 — who's going · directions */}
      <div className="flex items-center justify-between gap-3">
        {isBooking ? (
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
            <Icon name="user" size={16} className="text-white/60" />
            {commitment.playerCount
              ? `${commitment.playerCount} ${commitment.playerCount === 1 ? 'player' : 'players'}`
              : 'Court reserved'}
          </div>
        ) : (
          <button onClick={open} aria-label="See who's in" className="flex items-center gap-2.5 active:opacity-90 transition-opacity">
            <div className="flex -space-x-2.5">
              {commitment.roster.map((p) => (
                <Avatar key={p.name} name={p.name} variant={p.variant} size={32} className="border-2 border-[#2455f4]" />
              ))}
              {commitment.extraPlayers > 0 && (
                <span className="w-8 h-8 rounded-full border-2 border-[#2455f4] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center text-[11px] font-extrabold">
                  +{commitment.extraPlayers}
                </span>
              )}
            </div>
            {total > 0 && <span className="text-[13px] font-semibold text-white/80">going</span>}
          </button>
        )}

        {commitment.venueId ? (
          <button onClick={() => onNavigate('court-details', { id: commitment.venueId })} className={limePill} aria-label="Directions to the court">
            <Icon name="directions" size={16} />
            Directions
          </button>
        ) : (
          <button onClick={open} className={limePill}>
            {isBooking ? 'View booking' : 'View game'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Variant 2 — nothing booked, but games are open: deliver the "in seconds"
 *  promise by featuring the single best open game with a one-tap Join. */
function FindGameHero({ game, onNavigate }: { game: FeaturedGame; onNavigate: Navigate }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[210px] w-full flex flex-col justify-between text-white shadow-[var(--shadow-pop)]"
      style={{ background: HERO_GRADIENT }}
    >
      <div className="relative z-[2]">
        <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-90">
          Nothing on your calendar
        </div>
        <div className="mt-2 font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.01em] max-w-[280px]">
          Find a game in seconds
        </div>
      </div>

      {/* Featured open game — the fastest path onto a court right now. */}
      <div className="relative z-[2] mt-5 rounded-2xl bg-[rgba(255,255,255,0.14)] border border-[rgba(255,255,255,0.2)] p-3.5 flex items-center justify-between gap-3">
        <button
          onClick={() => onNavigate('game-details', { id: game.id })}
          className="min-w-0 text-left active:opacity-90 transition-opacity"
        >
          <div className="font-heading font-bold text-[16px] leading-tight truncate">{game.title}</div>
          <div className="mt-1 flex items-center gap-3 text-[12px] opacity-90">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={13} />
              {game.time}
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Icon name="location" size={13} />
              {game.loc}
            </span>
            <span className="font-bold shrink-0">{game.spots}</span>
          </div>
        </button>
        <button
          onClick={() => onNavigate('game-details', { id: game.id })}
          className="shrink-0 h-11 px-6 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-extrabold text-[14px] active:scale-95 transition-transform"
        >
          Join
        </button>
      </div>

      <button
        onClick={() => onNavigate('games')}
        className="relative z-[2] mt-3 self-start text-[13px] font-bold opacity-90 inline-flex items-center gap-1 active:opacity-100"
      >
        Browse all games <Icon name="forward" size={15} />
      </button>
    </div>
  );
}

/** Variant 3 — nothing booked and nothing nearby: start one yourself. */
function CreateGameHero({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[210px] w-full flex flex-col justify-between text-white shadow-[var(--shadow-pop)]"
      style={{ background: HERO_GRADIENT }}
    >
      <div className="relative z-[2]">
        <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-90">
          Quiet courts right now
        </div>
        <div className="mt-2 font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.01em] max-w-[280px]">
          Be the first on court
        </div>
        <p className="mt-2 text-[14px] opacity-90 max-w-[300px]">
          Post a game and your neighbors can jump in — most fill within the hour.
        </p>
      </div>

      <div className="relative z-[2] flex items-center gap-2 mt-6">
        <button onClick={() => onNavigate('create-game')} className={limePill}>
          <Icon name="plus" size={16} />
          Create a game
        </button>
        <button onClick={() => onNavigate('nearby')} className={ghostPill}>
          Browse courts
        </button>
      </div>
    </div>
  );
}
