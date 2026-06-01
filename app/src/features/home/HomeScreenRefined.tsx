import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
// import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { firstNameOf } from '../../shared/lib/permissions';
import { useAuthStore } from '../../shared/lib/authStore';

interface HomeScreenRefinedProps {
  onNavigate: Navigate;
}

// Quick-access shortcuts (layout from the provided "new homepage" design,
// rendered with the existing PickleBallers icons + tokens).
const QUICK: { label: string; icon: string; lime?: boolean; go: (n: Navigate) => void }[] = [
  { label: 'Join game', icon: 'paddle', lime: true, go: (n) => n('games') },
  { label: 'Book court', icon: 'calendar', go: (n) => n('nearby') },
  { label: 'Create match', icon: 'plus', go: (n) => n('create-game') },
  { label: 'Find players', icon: 'groups', go: (n) => n('search') },
];

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

export function HomeScreenRefined({ onNavigate }: HomeScreenRefinedProps) {
  const currentUser = useAuthStore((s) => s.user);
  const firstName = firstNameOf(currentUser);
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
        {/* Hero — next game card */}
        <button
          onClick={() => onNavigate('game-details', { id: 'g-next' })}
          className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[210px] w-full flex flex-col justify-between text-left text-white shadow-[var(--shadow-pop)] active:scale-[0.99] transition-transform"
          style={{ background: 'linear-gradient(135deg, #2455f4 0%, #5F7CFF 90%)' }}
        >
          <div className="relative z-[2]">
            <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-90">
              Next game • In 4h
            </div>
            <div className="mt-2 font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.01em] max-w-[260px]">
              Saturday Morning Mix-In
            </div>
          </div>
          <div className="relative z-[2] flex items-center justify-between gap-3 mt-6">
            <div className="flex -space-x-2.5">
              <Avatar name="Jordan Davis" variant="blue" size={36} className="border-2 border-[#2455f4]" />
              <Avatar name="Alex Morgan" variant="coral" size={36} className="border-2 border-[#2455f4]" />
              <span className="w-9 h-9 rounded-full border-2 border-[#2455f4] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center text-[12px] font-extrabold">
                +8
              </span>
            </div>
            <span className="h-12 px-6 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-extrabold text-[15px] inline-flex items-center shadow-[0_8px_18px_-6px_rgba(186,246,3,0.45)]">
              View game
            </span>
          </div>
        </button>

        {/* Quick access row */}
        <div className="flex justify-between lg:justify-start gap-3 lg:gap-5 overflow-x-auto scrollbar-none pb-1">
          {QUICK.map((q) => (
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
              <span className="text-[10px] font-extrabold tracking-[0.06em] uppercase text-[var(--ink-2)]">
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
