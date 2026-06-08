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
 * an upcoming game, otherwise it flips to the fastest way into a game.
 * Demo-driven for now, but the shape mirrors the games API so it can be
 * wired to the player's real "next game" + open-games feed later.   */

type AvatarVariant = 'blue' | 'coral' | 'lime';

interface NextGame {
  id: string;
  title: string;
  timeLabel: string; // "7:00 AM"
  venueId: string;
  venueName: string;
  /** Minutes until start; ≤0 means it has already started. Drives urgency. */
  startsInMinutes: number;
  roster: { name: string; variant: AvatarVariant }[];
  extraPlayers: number; // shown as "+N" after the roster avatars
}

// The player's next commitment. Set to `null` to preview the "find a game"
// flip in normal mode (it's the real-world default for a returning player
// with nothing booked). The demo `empty` reviewer mode also nulls this.
const NEXT_GAME: NextGame | null = {
  id: 'g-next',
  title: 'Saturday Morning Mix-In',
  timeLabel: '7:00 AM',
  venueId: 'c1',
  venueName: 'Riverside Courts',
  startsInMinutes: 240, // → "in 4h": imminent, so Check in + Directions show
  roster: [
    { name: 'Jordan Davis', variant: 'blue' },
    { name: 'Alex Morgan', variant: 'coral' },
  ],
  extraPlayers: 8,
};

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

const OPEN_GAMES = [
  {
    id: 'g2',
    tag: 'Beginner',
    tagTone: 'lime' as const,
    title: 'Beginner Open Play',
    time: '7:00 PM',
    court: 'Central Hub',
    dist: '0.8 mi',
    spots: '4 spots open',
    urgent: false,
    join: 'lime' as const,
  },
  {
    id: 'g1',
    tag: '3.0–3.5',
    tagTone: 'blue' as const,
    title: 'Friday Night Dinks',
    time: '6:30 PM',
    court: 'Riverside Courts',
    dist: '1.2 mi',
    spots: '2 spots open',
    urgent: true,
    join: 'blue' as const,
  },
];

type OpenGame = (typeof OPEN_GAMES)[number];

const COURTS = [
  {
    id: 'c1',
    name: 'Riverside Courts',
    dist: '1.2 mi',
    open: '3 Open',
    urgent: false,
    img: 'linear-gradient(135deg, #0040e0 0%, #6c83ff 100%)',
  },
  {
    id: 'c2',
    name: 'Central Hub',
    dist: '0.8 mi',
    open: '1 Open',
    urgent: true,
    img: 'linear-gradient(135deg, #1a1d24 0%, #404756 100%)',
  },
];

const OPEN_GREEN = '#4c6700'; // design "secondary" green for positive status
const HERO_GRADIENT = 'linear-gradient(135deg, #2455f4 0%, #5F7CFF 90%)';

export function HomeScreenRefined({ onNavigate }: HomeScreenRefinedProps) {
  const currentUser = useAuthStore((s) => s.user);
  const firstName = firstNameOf(currentUser);
  const { state: demoState } = useDemoState();
  // Guests see "Create an Account" up front; the rest stay, minus Join game's
  // lime accent so the new sign-up tile is the only highlighted action.
  const quick: QuickAction[] = currentUser
    ? QUICK
    : [GUEST_QUICK, ...QUICK.map((q) => ({ ...q, lime: false }))];

  // State-aware hero inputs. The `empty` reviewer mode mirrors a brand-new
  // player: nothing scheduled and nothing nearby → the hero flips to its
  // create-a-game form, staying consistent with the empty games list below.
  const isEmpty = demoState === 'empty';
  const nextGame = isEmpty ? null : NEXT_GAME;
  const featuredOpenGame = isEmpty ? null : OPEN_GAMES[0];

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
        {/* Hero — state-aware: your next game, else find a game, else create one */}
        {nextGame ? (
          <CommitmentHero game={nextGame} onNavigate={onNavigate} />
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
              onRetry={() => {}}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {OPEN_GAMES.map((g) => (
                  <div
                    key={g.id}
                    className="bg-[var(--surface)] rounded-[22px] p-4 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex flex-col gap-3.5"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-[0.04em] uppercase ${
                            g.tagTone === 'lime'
                              ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]'
                              : 'bg-[var(--primary-soft)] text-[var(--primary-deep)]'
                          }`}
                        >
                          {g.tag}
                        </span>
                        <div className="hd-3">{g.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-heading font-bold text-[17px] text-[var(--primary)] leading-tight">
                          {g.time}
                        </div>
                        <div className="text-[12px] text-[var(--muted)]">{g.court}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-[var(--muted)] text-[12px]">
                          <Icon name="location" size={14} />
                          {g.dist}
                        </span>
                        <span
                          className="flex items-center gap-1 text-[12px] font-bold"
                          style={{ color: g.urgent ? 'var(--coral)' : OPEN_GREEN }}
                        >
                          <Icon name="user" size={14} />
                          {g.spots}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigate('game-details', { id: g.id })}
                        className={`px-5 py-2 rounded-full text-[13px] font-heading font-semibold active:scale-95 transition-transform ${
                          g.join === 'lime'
                            ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                            : 'bg-[var(--primary)] text-white'
                        }`}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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

            {/* Courts available now */}
            <section className="space-y-3">
              <div className="hd-2">Courts available now</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {COURTS.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[var(--surface)] rounded-2xl p-3 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl shrink-0" style={{ background: c.img }} />
                      <div className="min-w-0">
                        <div className="hd-3 text-[15px] truncate">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] text-[var(--muted)]">{c.dist}</span>
                          <span className="w-1 h-1 rounded-full bg-[var(--muted)]" />
                          <span
                            className="text-[12px] font-bold"
                            style={{ color: c.urgent ? 'var(--coral)' : OPEN_GREEN }}
                          >
                            {c.open}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('court-details', { id: c.id })}
                      className="shrink-0 border-[0.5px] border-[var(--hairline)] px-4 py-2 rounded-full font-heading font-semibold text-[13px] text-[var(--ink)] active:scale-95 transition-transform"
                    >
                      Book
                    </button>
                  </div>
                ))}
              </div>
            </section>
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

/** Variant 1 — you have an upcoming game. Actions adapt to how close it is. */
function CommitmentHero({ game, onNavigate }: { game: NextGame; onNavigate: Navigate }) {
  const urgency = urgencyOf(game.startsInMinutes);
  const countdown = countdownLabel(game.startsInMinutes);
  const checkInWindow = urgency === 'live' || urgency === 'imminent';
  const showDirections = urgency !== 'scheduled';

  const eyebrow =
    urgency === 'live'
      ? 'Happening now'
      : checkInWindow
        ? `Starting soon • ${countdown}`
        : `Next game • ${countdown}`;

  const openDetails = () => onNavigate('game-details', { id: game.id });

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[210px] w-full flex flex-col justify-between text-white shadow-[var(--shadow-pop)]"
      style={{ background: HERO_GRADIENT }}
    >
      {/* Tap the header region to open the game; action buttons sit beside it
          so we avoid nesting interactive controls inside one big button. */}
      <button onClick={openDetails} className="relative z-[2] text-left w-full active:opacity-90 transition-opacity">
        <div className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-95">
          {checkInWindow && <Icon name="bolt" size={14} className="text-[var(--lime)]" />}
          {eyebrow}
        </div>
        <div className="mt-2 font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.01em] max-w-[260px]">
          {game.title}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[13px] font-semibold opacity-90">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={14} />
            {game.timeLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="location" size={14} />
            {game.venueName}
          </span>
        </div>
      </button>

      <div className="relative z-[2] flex items-end justify-between gap-3 mt-6">
        <button
          onClick={openDetails}
          aria-label="See who's in"
          className="flex flex-col items-start gap-1.5 active:opacity-90 transition-opacity"
        >
          <div className="flex -space-x-2.5">
            {game.roster.map((p) => (
              <Avatar
                key={p.name}
                name={p.name}
                variant={p.variant}
                size={36}
                className="border-2 border-[#2455f4]"
              />
            ))}
            {game.extraPlayers > 0 && (
              <span className="w-9 h-9 rounded-full border-2 border-[#2455f4] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center text-[12px] font-extrabold">
                +{game.extraPlayers}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold opacity-80">Who's in →</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {showDirections && (
            <button
              onClick={() => onNavigate('court-details', { id: game.venueId })}
              className={ghostIcon}
              aria-label="Directions to the court"
            >
              <Icon name="directions" size={18} />
            </button>
          )}
          <button onClick={openDetails} className={limePill}>
            {checkInWindow ? <Icon name="check" size={16} /> : null}
            {checkInWindow ? 'Check in' : 'View game'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Variant 2 — nothing booked, but games are open: deliver the "in seconds"
 *  promise by featuring the single best open game with a one-tap Join. */
function FindGameHero({ game, onNavigate }: { game: OpenGame; onNavigate: Navigate }) {
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
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={13} />
              {game.dist}
            </span>
            <span className="font-bold">{game.spots}</span>
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
