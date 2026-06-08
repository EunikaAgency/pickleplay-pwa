import { useEffect, useState } from 'react';
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
import { listGames, listBookings, listVenues, apiImageUrl, type ApiGame, type ApiBooking, type ApiVenue } from '../../shared/lib/api';

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
  const v = g.venue || g.winningVenue;
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
  const v = g.venue || g.winningVenue;
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
function dayLabel(g: ApiGame): string {
  if (!g.date) return g.whenLabel || '';
  const d = new Date(`${g.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return g.whenLabel || '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

/** Skill/type chip text for an open-game card. */
function gameTag(g: ApiGame): string {
  return g.skillLabel || (g.gameType ? g.gameType[0].toUpperCase() + g.gameType.slice(1) : 'Open');
}

/** Beginner/open-level games get the lime accent; graded skill levels get blue. */
function isOpenLevel(g: ApiGame): boolean {
  const s = (g.skillLabel || '').toLowerCase();
  return !g.skillLabel || s.includes('begin') || s.includes('all') || s.includes('open');
}

/** The venue's short display name (no area) for the card's compact slot. */
function venueShortName(g: ApiGame): string {
  return g.venue?.displayName || g.winningVenue?.displayName || g.venueName || 'Venue TBD';
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
  // when there's no commitment) and keep joinable games only.
  const heroFeaturedId = nextCommitment ? undefined : topOpen?.id;
  const openList = openGames
    .filter((g) => g.id !== heroFeaturedId && (g.spotsLeft ?? 1) > 0)
    .slice(0, 4);
  const courtList = courts.slice(0, 4);

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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {openList.map((g) => {
                    const open = isOpenLevel(g);
                    const urgent = (g.spotsLeft ?? 9) <= 2;
                    const day = dayLabel(g);
                    return (
                      <div
                        key={g.id}
                        className="bg-[var(--surface)] rounded-[22px] p-4 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex flex-col gap-3.5"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-[0.04em] uppercase ${
                                open
                                  ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]'
                                  : 'bg-[var(--primary-soft)] text-[var(--primary-deep)]'
                              }`}
                            >
                              {gameTag(g)}
                            </span>
                            <div className="hd-3">{heroTitle(g)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-heading font-bold text-[17px] text-[var(--primary)] leading-tight">
                              {g.timeLabel || g.whenLabel || ''}
                            </div>
                            <div className="text-[12px] text-[var(--muted)] max-w-[120px] truncate">
                              {venueShortName(g)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
                          <div className="flex items-center gap-4">
                            {day && (
                              <span className="flex items-center gap-1 text-[var(--muted)] text-[12px]">
                                <Icon name="calendar" size={14} />
                                {day}
                              </span>
                            )}
                            <span
                              className="flex items-center gap-1 text-[12px] font-bold"
                              style={{ color: urgent ? 'var(--coral)' : OPEN_GREEN }}
                            >
                              <Icon name="user" size={14} />
                              {heroSpots(g)}
                            </span>
                          </div>
                          <button
                            onClick={() => onNavigate('game-details', { id: g.id })}
                            className={`px-5 py-2 rounded-full text-[13px] font-heading font-semibold active:scale-95 transition-transform ${
                              open
                                ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                                : 'bg-[var(--primary)] text-white'
                            }`}
                          >
                            Join
                          </button>
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
                  <div className="hd-2">Courts to book</div>
                  <button
                    className="text-[var(--primary)] font-bold text-[13px]"
                    onClick={() => onNavigate('nearby')}
                  >
                    View all
                  </button>
                </div>
                {loading ? (
                  <LoadingSkeleton variant="card" count={2} />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {courtList.map((v, i) => {
                      const img = apiImageUrl(v.image || v.mainImageUrl);
                      const area = venueArea(v);
                      const stat = venueStat(v);
                      return (
                        <div
                          key={v.id}
                          className="bg-[var(--surface)] rounded-2xl p-3 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-12 h-12 rounded-xl shrink-0 bg-cover bg-center"
                              style={img ? { backgroundImage: `url(${img})` } : { background: COURT_GRADIENTS[i % COURT_GRADIENTS.length] }}
                            />
                            <div className="min-w-0">
                              <div className="hd-3 text-[15px] truncate">{v.displayName}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {area && <span className="text-[12px] text-[var(--muted)] truncate">{area}</span>}
                                {area && stat && <span className="w-1 h-1 rounded-full bg-[var(--muted)]" />}
                                {stat && (
                                  <span className="text-[12px] font-bold" style={{ color: OPEN_GREEN }}>
                                    {stat}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onNavigate('court-details', { id: v.id })}
                            className="shrink-0 border-[0.5px] border-[var(--hairline)] px-4 py-2 rounded-full font-heading font-semibold text-[13px] text-[var(--ink)] active:scale-95 transition-transform"
                          >
                            Book
                          </button>
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
const ghostIcon =
  'w-12 h-12 rounded-full bg-[rgba(255,255,255,0.16)] text-white inline-flex items-center justify-center border border-[rgba(255,255,255,0.22)] active:scale-95 transition-transform';
const ghostPill =
  'h-12 px-5 rounded-full bg-[rgba(255,255,255,0.16)] text-white font-heading font-semibold text-[14px] inline-flex items-center gap-2 border border-[rgba(255,255,255,0.22)] active:scale-95 transition-transform';

/** Variant 1 — you have an upcoming commitment (game or court booking).
 *  Actions adapt to how close it is and which kind it is. */
function CommitmentHero({ commitment, onNavigate }: { commitment: NextCommitment; onNavigate: Navigate }) {
  const isBooking = commitment.kind === 'booking';
  const urgency = urgencyOf(commitment.startsInMinutes);
  const countdown = countdownLabel(commitment.startsInMinutes);
  const checkInWindow = urgency === 'live' || urgency === 'imminent';
  const showDirections = urgency !== 'scheduled' && !!commitment.venueId;

  const eyebrow =
    urgency === 'live'
      ? 'Happening now'
      : checkInWindow
        ? `Starting soon • ${countdown}`
        : `Next game • ${countdown}`;

  // Games open their details; a booking opens the My bookings list.
  const open = () => (isBooking ? onNavigate('my-bookings') : onNavigate('game-details', { id: commitment.id }));
  const primaryLabel = isBooking ? 'View booking' : checkInWindow ? 'Check in' : 'View game';

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[210px] w-full flex flex-col justify-between text-white shadow-[var(--shadow-pop)]"
      style={{ background: HERO_GRADIENT }}
    >
      {/* Tap the header region to open it; action buttons sit beside it so we
          avoid nesting interactive controls inside one big button. */}
      <button onClick={open} className="relative z-[2] text-left w-full active:opacity-90 transition-opacity">
        <div className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-95">
          {checkInWindow && <Icon name="bolt" size={14} className="text-[var(--lime)]" />}
          {eyebrow}
        </div>
        <div className="mt-2 font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.01em] max-w-[260px]">
          {commitment.title}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[13px] font-semibold opacity-90">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={14} />
            {commitment.timeLabel}
          </span>
          {/* For a booking the venue is already the headline — don't repeat it. */}
          {!isBooking && (
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} />
              {commitment.venueName}
            </span>
          )}
        </div>
      </button>

      <div className="relative z-[2] flex items-end justify-between gap-3 mt-6">
        {isBooking ? (
          // Bookings have no named roster — surface the party size instead.
          <div className="flex items-center gap-1.5 text-[13px] font-semibold opacity-90">
            <Icon name="user" size={16} />
            {commitment.playerCount
              ? `${commitment.playerCount} ${commitment.playerCount === 1 ? 'player' : 'players'}`
              : 'Court reserved'}
          </div>
        ) : (
          <button
            onClick={open}
            aria-label="See who's in"
            className="flex flex-col items-start gap-1.5 active:opacity-90 transition-opacity"
          >
            <div className="flex -space-x-2.5">
              {commitment.roster.map((p) => (
                <Avatar
                  key={p.name}
                  name={p.name}
                  variant={p.variant}
                  size={36}
                  className="border-2 border-[#2455f4]"
                />
              ))}
              {commitment.extraPlayers > 0 && (
                <span className="w-9 h-9 rounded-full border-2 border-[#2455f4] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center text-[12px] font-extrabold">
                  +{commitment.extraPlayers}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold opacity-80">Who's in →</span>
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {showDirections && (
            <button
              onClick={() => onNavigate('court-details', { id: commitment.venueId })}
              className={ghostIcon}
              aria-label="Directions to the court"
            >
              <Icon name="directions" size={18} />
            </button>
          )}
          <button onClick={open} className={limePill}>
            {checkInWindow && !isBooking ? <Icon name="check" size={16} /> : null}
            {primaryLabel}
          </button>
        </div>
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
