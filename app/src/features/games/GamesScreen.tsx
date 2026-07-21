import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { Segmented } from '../../shared/components/ui/Segmented';
import { GameFilterSheet } from './GameFilterSheet';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { apiImageUrl, listGames, listBookings, cancelBooking, type ApiGame, type ApiGamePerson, type ApiBooking } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { takePendingGamesTab } from '../../shared/lib/navIntent';
import { getInitials } from '../../shared/lib/initials';
import {
  dayParts, gameThumb, gameTitle, timeLine, gameLocation,
  splitTime, spotsLabel, dateSectionHeader, relativeDayLabel, type GameThumb,
} from './gameDisplay';
import {
  isCancellable, money, prettyDate, todayYMD,
  dateBox, timeRange, bookingDuration, bookingStatusChip,
} from '../bookings/bookingDisplay';
import {
  type GameFilters, makeDefaultGameFilters, matchesGameFilters, countActiveGameFilters,
} from './gameFilters';
import { GameManageActions } from './GameManageActions';
import type { Navigate } from '../../shared/lib/navigation';

interface GamesScreenProps {
  onNavigate: Navigate;
}

type TopTab = 'booking' | 'games';
type GamesView = 'mine' | 'browse';

// Quick chips are shortcuts into the same filter model the sheet edits. Each is
// active when its field already holds that value, and toggles it on/off.
const QUICK_CHIPS: { label: string; isOn: (f: GameFilters) => boolean; toggle: (f: GameFilters) => GameFilters }[] = [
  { label: 'Today', isOn: (f) => f.when === 'today', toggle: (f) => ({ ...f, when: f.when === 'today' ? 'any' : 'today' }) },
  { label: 'Weekend', isOn: (f) => f.when === 'weekend', toggle: (f) => ({ ...f, when: f.when === 'weekend' ? 'any' : 'weekend' }) },
  { label: 'Beginner', isOn: (f) => f.skill === 'Beginner', toggle: (f) => ({ ...f, skill: f.skill === 'Beginner' ? 'Any' : 'Beginner' }) },
  { label: '3.0–3.5', isOn: (f) => f.skill === '3.0–3.5', toggle: (f) => ({ ...f, skill: f.skill === '3.0–3.5' ? 'Any' : '3.0–3.5' }) },
  { label: 'Doubles', isOn: (f) => f.gameType === 'doubles', toggle: (f) => ({ ...f, gameType: f.gameType === 'doubles' ? 'Any' : 'doubles' }) },
  { label: 'Open spots', isOn: (f) => f.openings, toggle: (f) => ({ ...f, openings: !f.openings }) },
];

/* Solid accent (divider / dot) per game color, used by Browse cards. */
const BAR_TONE: Record<GameThumb, string> = {
  lime: 'bg-[var(--lime)]',
  blue: 'bg-[var(--primary)]',
  coral: 'bg-[var(--coral)]',
};
const AVATAR_TONES = [
  'bg-[var(--primary-soft)] text-[var(--primary-deep)]',
  'bg-[var(--coral-soft)] text-[var(--coral)]',
  'bg-[var(--lime-soft)] text-[var(--lime-ink)]',
];

/** Overlapping participant avatars (initials fallback) + a "+N" overflow chip. */
function AvatarStack({ people, total, size = 28 }: { people: ApiGamePerson[]; total?: number; size?: number }) {
  const shown = people.slice(0, 3);
  const count = total ?? people.length;
  const more = Math.max(0, count - shown.length);
  if (shown.length === 0 && more === 0) return null;
  const dim = { width: size, height: size };
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div
          key={p.id}
          className={`rounded-full ring-2 ring-[var(--surface)] flex items-center justify-center text-[10px] font-bold overflow-hidden ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
          style={{ ...dim, marginLeft: i === 0 ? 0 : -8 }}
        >
          {apiImageUrl(p.avatarUrl) ? <img src={apiImageUrl(p.avatarUrl)} alt="" className="w-full h-full object-cover" /> : getInitials(p.displayName)}
        </div>
      ))}
      {more > 0 && (
        <div
          className="rounded-full ring-2 ring-[var(--surface)] bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center text-[10px] font-bold"
          style={{ ...dim, marginLeft: shown.length ? -8 : 0 }}
        >
          +{more}
        </div>
      )}
    </div>
  );
}

/** Browse-list card: time rail · accent divider · title/venue/roster · spots + skill. */
function BrowseGameCard({ g, onTap }: { g: ApiGame; onTap: () => void }) {
  const tone = gameThumb(g);
  const { time, suffix } = splitTime(timeLine(g));
  const people = g.participants ?? [];
  const count = g.participantCount ?? people.length;
  const cap = g.capacity ?? null;
  const left = g.spotsLeft ?? 0;
  const spotsClass =
    left <= 0 ? 'bg-[var(--surface-3)] text-[var(--muted)]'
    : left <= 2 ? 'bg-[var(--coral-soft)] text-[var(--coral)]'
    : 'bg-[var(--primary-soft)] text-[var(--primary-deep)]';
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left flex gap-3 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] p-3.5 active:scale-[0.99] transition-transform"
    >
      <div className="shrink-0 w-[52px] text-center pt-1">
        <div className="font-heading font-bold text-[19px] leading-none text-[var(--ink)]">{time || '—'}</div>
        {suffix && <div className="text-[11px] font-bold text-[var(--muted)] mt-1">{suffix}</div>}
      </div>
      <div className={`w-[3px] self-stretch rounded-full shrink-0 ${BAR_TONE[tone]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${BAR_TONE[tone]}`} />
              <span className="font-heading font-semibold text-[16px] text-[var(--ink)] truncate">{gameTitle(g)}</span>
            </div>
            <div className="flex items-center gap-1 text-[12.5px] text-[var(--muted)] mt-1 min-w-0">
              <Icon name="location" size={12} />
              <span className="truncate">{gameLocation(g)}</span>
            </div>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${spotsClass}`}>{spotsLabel(g)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarStack people={people} total={count} />
            {cap != null && <span className="text-[12px] font-bold text-[var(--ink-2)]">{count}/{cap}</span>}
          </div>
          {g.skillLabel && <span className="shrink-0 text-[12.5px] font-bold text-[var(--primary)]">{g.skillLabel}</span>}
        </div>
      </div>
    </button>
  );
}

interface MyGameCardProps {
  g: ApiGame;
  meId?: string;
  /** A past/finished game: shown read-only (no edit/delete/manage), greyed badge. */
  done?: boolean;
  onOpen: () => void;
  onNavigate: Navigate;
  onDeleted: (id: string) => void;
}

/** "My Games" commitment card: status accent bar · date box · roster · Manage/Details. */
function MyGameCard({ g, meId, done = false, onOpen, onNavigate, onDeleted }: MyGameCardProps) {
  const [managing, setManaging] = useState(false);
  const isHost = g.creatorId === meId || g.creator?.id === meId;
  const { day, num } = dayParts(g);
  // The date box already shows the day, so only prefix a relative word (Today /
  // Tomorrow) — never repeat the full date here.
  const rel = relativeDayLabel(g);
  const relWord = rel === 'Today' || rel === 'Tomorrow' ? rel : null;
  const when = [relWord, timeLine(g)].filter(Boolean).join(' · ');
  const people = g.participants ?? [];
  const count = g.participantCount ?? people.length;
  const left = g.spotsLeft ?? 0;

  // One colour story per card: the date box, accent bar, and badge all share the
  // status tone (host = lime, going = green, cancelled = grey).
  const status =
    done
      ? { label: 'DONE', badge: 'bg-[var(--surface-3)] text-[var(--muted)]', bar: 'bg-[var(--surface-3)]', box: 'bg-[var(--surface-3)] text-[var(--muted)]' }
      : g.status === 'cancelled'
      ? { label: 'CANCELLED', badge: 'bg-[var(--surface-3)] text-[var(--muted)]', bar: 'bg-[var(--surface-3)]', box: 'bg-[var(--surface-3)] text-[var(--muted)]' }
      : isHost
      ? { label: 'HOSTING', badge: 'bg-[var(--lime)] text-[var(--lime-ink)]', bar: 'bg-[var(--lime)]', box: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' }
      : { label: 'GOING', badge: 'bg-[rgba(26,160,82,0.14)] text-[#1aa052]', bar: 'bg-[#1aa052]', box: 'bg-[rgba(26,160,82,0.12)] text-[#1aa052]' };

  const summary = isHost
    ? count > 1 ? `You + ${count - 1} confirmed` : "You're hosting"
    : left > 0 ? `${left} ${left === 1 ? 'spot' : 'spots'} open` : 'Roster full';

  return (
    <div className="relative rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${status.bar}`} />
      <div className="pl-5 pr-4 py-4">
        <div
          className="flex gap-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        >
          <div className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${status.box}`}>
            <span className="font-heading font-bold text-[11px] tracking-wide leading-none">{day}</span>
            {num != null && num > 0 && <span className="font-heading font-bold text-[22px] leading-none mt-1">{num}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="font-heading font-semibold text-[16.5px] text-[var(--ink)] truncate">{gameTitle(g)}</div>
              <span className={`shrink-0 text-[10px] font-extrabold tracking-[0.06em] px-2.5 py-1 rounded-full ${status.badge}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] mt-1.5 min-w-0">
              <Icon name="clock" size={13} /><span className="font-semibold truncate">{when || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] mt-1 min-w-0">
              <Icon name="location" size={13} /><span className="truncate">{gameLocation(g)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)]">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarStack people={people} total={count} />
            <span className="text-[13px] font-semibold text-[var(--ink-2)] truncate">{summary}</span>
          </div>
          {/* A finished game is read-only — no editing/deleting a game that already happened. */}
          {!done && isHost ? (
            <button
              type="button"
              onClick={() => setManaging((m) => !m)}
              className="shrink-0 text-[13px] font-bold text-[var(--primary)] flex items-center gap-0.5"
            >
              Manage <Icon name="chevron" size={15} className={`transition-transform ${managing ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="shrink-0 text-[13px] font-bold text-[var(--primary)] flex items-center gap-0.5"
            >
              Details <Icon name="chevron" size={15} />
            </button>
          )}
        </div>

        {!done && isHost && managing && (
          <GameManageActions
            game={g}
            onNavigate={onNavigate}
            onDeleted={onDeleted}
            className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)]"
          />
        )}
      </div>
    </div>
  );
}

const MY_GAMES_PAGE = 6;

/** My Games split into Upcoming (full manage) and Done (read-only) sections, each
 *  with a separator header and a "Show more" page. A game is "done" once its date
 *  has passed — you can't edit/delete a game that already happened. */
function MyGamesSections({
  games, meId, onOpen, onNavigate, onDeleted,
}: {
  games: ApiGame[];
  meId?: string;
  onOpen: (g: ApiGame) => void;
  onNavigate: Navigate;
  onDeleted: (id: string) => void;
}) {
  const today = todayYMD();
  const upcoming = useMemo(
    () => games.filter((g) => !g.date || g.date >= today).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [games, today],
  );
  const done = useMemo(
    () => games.filter((g) => g.date && g.date < today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [games, today],
  );
  const [upShown, setUpShown] = useState(MY_GAMES_PAGE);
  const [doneShown, setDoneShown] = useState(MY_GAMES_PAGE);

  const section = (label: string, list: ApiGame[], shown: number, onMore: () => void, isDone: boolean) =>
    list.length === 0 ? null : (
      <div className="mb-6 last:mb-0">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="text-[12px] font-extrabold tracking-[0.08em] text-[var(--muted)]">{label}</div>
          <div className="flex-1 h-px bg-[var(--hairline)]" />
          <div className="text-[12px] font-bold text-[var(--muted)]">{list.length}</div>
        </div>
        <div className="flex flex-col gap-3">
          {list.slice(0, shown).map((g) => (
            <MyGameCard
              key={g.id}
              g={g}
              meId={meId}
              done={isDone}
              onOpen={() => onOpen(g)}
              onNavigate={onNavigate}
              onDeleted={onDeleted}
            />
          ))}
        </div>
        {list.length > shown && (
          <button
            type="button"
            onClick={onMore}
            className="mt-3 w-full py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] font-heading font-semibold text-[14px] active:scale-[0.99] transition-transform"
          >
            Show {Math.min(MY_GAMES_PAGE, list.length - shown)} more
          </button>
        )}
      </div>
    );

  return (
    <div className="flex flex-col">
      {section('Upcoming', upcoming, upShown, () => setUpShown((n) => n + MY_GAMES_PAGE), false)}
      {section('Done', done, doneShown, () => setDoneShown((n) => n + MY_GAMES_PAGE), true)}
    </div>
  );
}

/** A single court-booking card (date box · venue · duration/price · time range · status). */
function BookingCard({ b, onCancel, cancelling }: { b: ApiBooking; onCancel: (id: string) => Promise<boolean>; cancelling: boolean }) {
  // Two-step cancel: confirm before releasing the court (a paid reservation
  // shouldn't vanish on a single accidental tap).
  const [confirming, setConfirming] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { wd, d } = dateBox(b.date);
  const chip = bookingStatusChip(b);
  const sub = [bookingDuration(b), b.amount != null ? money(b.amount) : null].filter(Boolean).join(' · ');
  const dateLine = [prettyDate(b.date), timeRange(b)].filter(Boolean).join(' · ');
  return (
    <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] p-3.5">
      <div className="flex gap-3">
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-deep)] flex flex-col items-center justify-center">
          <span className="font-heading font-bold text-[11px] tracking-wide leading-none">{wd || '—'}</span>
          {d && <span className="font-heading font-bold text-[22px] leading-none mt-1">{d}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-heading font-semibold text-[16.5px] text-[var(--ink)] truncate">{b.venueName || 'Court booking'}</div>
            <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className}`}>{chip.label}</span>
          </div>
          {sub && <div className="text-[13px] font-semibold text-[var(--muted)] mt-1">{sub}</div>}
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] mt-1 min-w-0">
            <Icon name="calendar" size={13} /><span className="truncate">{dateLine || '—'}</span>
          </div>
        </div>
      </div>
      {isCancellable(b) && (
        <div className="mt-2.5 pt-2.5 border-t-[0.5px] border-[var(--hairline)]">
          {confirming ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <div className="text-[13px] font-bold text-[var(--ink)]">Cancel this booking?</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">
                Your court reservation will be released and the time freed up. This can’t be undone.
              </div>
              {cancelError && <div className="mt-2 text-[12px] text-[var(--coral)] font-semibold">{cancelError}</div>}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setConfirming(false); setCancelError(null); }}
                  disabled={cancelling}
                  className="flex-1 h-9 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={async () => { setCancelError(null); const ok = await onCancel(b.id); if (!ok) setCancelError("Couldn't cancel. Please try again."); else setConfirming(false); }}
                  disabled={cancelling}
                  className="flex-1 h-9 rounded-lg bg-[var(--coral)] text-white font-heading font-semibold text-[13px] flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {cancelling
                    ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> Cancelling…</>
                    : 'Yes, cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-[13px] font-bold text-[var(--coral)] flex items-center gap-1"
              >
                <Icon name="close" size={14} /> Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BookingCalendarProps {
  year: number;
  month: number; // 0-based
  bookingsByDate: Map<string, ApiBooking[]>;
  selected: string;
  today: string;
  onSelect: (ymd: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** Month grid that dots days with bookings and highlights today + the selected day. */
function BookingCalendar({ year, month, bookingsByDate, selected, today, onSelect, onPrev, onNext }: BookingCalendarProps) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const ymd = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div className="rounded-3xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-heading font-bold text-[18px] text-[var(--ink)]">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} aria-label="Previous month" className="w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="chevron" size={16} className="rotate-180" />
          </button>
          <button onClick={onNext} aria-label="Next month" className="w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <div key={i} className="text-center text-[12px] font-bold text-[var(--muted)] py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 mt-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = ymd(day);
          const dayBookings = bookingsByDate.get(key) ?? [];
          const has = dayBookings.length > 0;
          const confirmed = dayBookings.some((b) => b.status === 'confirmed' || b.status === 'paid');
          const isSel = key === selected;
          const isToday = key === today;
          const dotClass = !has
            ? 'bg-transparent'
            : isSel ? 'bg-[var(--lime-ink)]'
            : confirmed ? 'bg-[#1aa052]'
            : 'bg-[var(--muted)]';
          return (
            <div key={key} className="flex flex-col items-center py-0.5">
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-label={key}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold transition-colors ${
                  isSel ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                  : isToday ? 'text-[var(--ink)] ring-1 ring-[var(--surface-3)]'
                  : 'text-[var(--ink)]'
                }`}
              >
                {day}
              </button>
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${dotClass}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GamesScreen({ onNavigate }: GamesScreenProps) {
  const me = useAuthStore((s) => s.user);
  const isLoggedIn = !!me;
  // Honor a one-shot intent from the home screen ("Join game" / "Browse all
  // games" land on Games → Browse instead of the default Booking tab).
  const [initialTab] = useState(() => takePendingGamesTab());
  // Guests have no bookings, so land them on Games → Browse (the Booking tab
  // would otherwise show a sign-in wall on the default view).
  const [topTab, setTopTab] = useState<TopTab>(initialTab ?? (isLoggedIn ? 'booking' : 'games'));
  const [gamesView, setGamesView] = useState<GamesView>(
    initialTab === 'games' ? 'browse' : isLoggedIn ? 'mine' : 'browse',
  );
  const [filters, setFilters] = useState<GameFilters>(makeDefaultGameFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsReloadKey, setBookingsReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Bookings: calendar (default) vs flat list, the displayed month, and the picked day.
  const [bookingTab, setBookingTab] = useState<'calendar' | 'list'>('calendar');
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string>(() => todayYMD());
  const calInited = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // Browse: no status filter → the server returns upcoming public games that
    // are open OR full (full ones show a "Full" badge), not just open ones.
    const params = gamesView === 'mine' ? { mine: true } : {};
    listGames(params)
      .then((rows) => { if (alive) setGames(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load games.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gamesView, reloadKey]);

  useEffect(() => {
    // Bookings are auth-only; a guest on this tab gets a sign-in prompt, not a fetch.
    if (topTab !== 'booking' || !isLoggedIn) return;
    let alive = true;
    setBookingsLoading(true);
    setBookingsError(null);
    listBookings()
      .then((items) => { if (alive) setBookings(items); })
      .catch((e) => { if (alive) setBookingsError(e instanceof Error ? e.message : 'Could not load your bookings.'); })
      .finally(() => { if (alive) setBookingsLoading(false); });
    return () => { alive = false; };
  }, [topTab, bookingsReloadKey, isLoggedIn]);

  // Filters apply client-side to whatever games are loaded (Browse or My Games).
  const filteredGames = useMemo(() => games.filter((g) => matchesGameFilters(g, filters)), [games, filters]);
  const activeFilterCount = countActiveGameFilters(filters);

  // Browse groups the filtered games into date sections ("TODAY · FRI JUN 5", count on the right).
  const grouped = useMemo(() => {
    const map = new Map<string, { header: string; items: ApiGame[] }>();
    for (const g of filteredGames) {
      const { key, header } = dateSectionHeader(g.date);
      const bucket = map.get(key);
      if (bucket) bucket.items.push(g);
      else map.set(key, { header, items: [g] });
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredGames]);

  // Index bookings by day for the calendar dots + the selected-day list.
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, ApiBooking[]>();
    for (const b of bookings) {
      if (!b.date) continue;
      const arr = map.get(b.date);
      if (arr) arr.push(b);
      else map.set(b.date, [b]);
    }
    return map;
  }, [bookings]);

  // On first load, open the calendar on the soonest upcoming booking (else the latest one).
  if (!calInited.current && bookings.length > 0) {
    calInited.current = true;
    const today = todayYMD();
    const dates = [...new Set(bookings.map((b) => b.date).filter((d): d is string => !!d))].sort();
    const pick = dates.find((d) => d >= today) ?? dates[dates.length - 1];
    if (pick) {
      setSelectedDate(pick);
      const [y, m] = pick.split('-').map(Number);
      setCalMonth({ year: y, month: m - 1 });
    }
  }

  const selectedBookings = bookingsByDate.get(selectedDate) ?? [];
  const prevMonth = () => setCalMonth(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const nextMonth = () => setCalMonth(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));

  const refetch = () => setReloadKey((k) => k + 1);

  const openGame = (g: ApiGame) => onNavigate('game-details', { id: g.id });

  const handleCancelBooking = async (id: string): Promise<boolean> => {
    setCancelling(id);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: updated.status ?? 'cancelled' } : b)));
      return true;
    } catch {
      // Let the card surface the failure (P19) instead of a silent reload.
      return false;
    } finally {
      setCancelling(null);
    }
  };

  const subtitle =
    topTab === 'booking'
      ? `${bookings.length} court ${bookings.length === 1 ? 'booking' : 'bookings'}`
      : gamesView === 'browse'
      ? `${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'} nearby`
      : `${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'} joined`;

  const gamesEmpty = (
    <EmptyState
      icon="paddle"
      title={gamesView === 'mine' ? "You haven't created or joined any games yet" : 'No games found'}
      description={gamesView === 'mine' ? 'Create a game or browse upcoming ones near you to get on the courts.' : 'Try a different filter or check back soon.'}
      action={gamesView === 'mine' ? { label: 'Browse games', onPress: () => setGamesView('browse') } : undefined}
    />
  );

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div>
          <div className="greet-name">Games</div>
          <div className="greet-sub">{subtitle}</div>
        </div>
        {topTab === 'games' && (
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
            className="relative w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)]"
          >
            <Icon name="sliders" size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="px-4 pt-4">
        <Segmented
          value={topTab}
          onChange={setTopTab}
          options={[
            { value: 'booking', label: 'Booking' },
            { value: 'games', label: 'Games' },
          ]}
        />
      </div>

      {topTab === 'games' && (
        <div className="px-4 pt-3.5">
          <div className="flex gap-6 border-b-[0.5px] border-[var(--hairline)]">
            {([['mine', 'My Games'], ['browse', 'Browse']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setGamesView(val)}
                className={`relative pb-2.5 font-heading font-semibold text-[15px] transition-colors ${gamesView === val ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
              >
                {label}
                {gamesView === val && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-[var(--lime)]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {topTab === 'games' && gamesView === 'browse' && (
        <div className="section mt-3.5!">
          <div className="scroll-x flex gap-2 pb-1">
            {QUICK_CHIPS.map((c) => (
              <button
                key={c.label}
                className={`chip ${c.isOn(filters) ? 'lime' : ''}`}
                onClick={() => setFilters(c.toggle)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {topTab === 'booking' && (
        <div className="px-4 pt-3.5 flex justify-end">
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-[var(--surface-2)]">
            {([['list', 'filter'], ['calendar', 'calendar']] as const).map(([val, icon]) => (
              <button
                key={val}
                onClick={() => setBookingTab(val)}
                aria-label={`${val} view`}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  bookingTab === val ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-card)]' : 'text-[var(--muted)]'
                }`}
              >
                <Icon name={icon} size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section mt-4!">
        {topTab === 'booking' ? (
          !isLoggedIn ? (
            <EmptyState
              icon="user"
              title="Sign in to see your bookings"
              description="Your court reservations show up here once you’re signed in."
              action={{ label: 'Sign in', onPress: () => onNavigate('login') }}
            />
          ) : bookingsLoading ? (
            <LoadingSkeleton variant="card" count={4} />
          ) : bookingsError ? (
            <ErrorState title="Couldn't load bookings" message={bookingsError} onRetry={() => setBookingsReloadKey((k) => k + 1)} />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No bookings yet"
              description="Reserve a court and your bookings will show up here."
              action={{ label: 'Find a court', onPress: () => onNavigate('nearby') }}
            />
          ) : bookingTab === 'calendar' ? (
            <div className="flex flex-col gap-4">
              <BookingCalendar
                year={calMonth.year}
                month={calMonth.month}
                bookingsByDate={bookingsByDate}
                selected={selectedDate}
                today={todayYMD()}
                onSelect={setSelectedDate}
                onPrev={prevMonth}
                onNext={nextMonth}
              />
              <div>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="font-heading font-bold text-[15px] text-[var(--ink)]">{prettyDate(selectedDate) || 'Selected day'}</div>
                  <div className="flex-1 h-px bg-[var(--hairline)]" />
                  <div className="text-[12px] font-bold text-[var(--muted)]">
                    {selectedBookings.length} {selectedBookings.length === 1 ? 'booking' : 'bookings'}
                  </div>
                </div>
                {selectedBookings.length === 0 ? (
                  <div className="rounded-2xl border-[0.5px] border-dashed border-[var(--hairline)] py-7 text-center text-[13px] font-semibold text-[var(--muted)]">
                    No bookings on this day
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedBookings.map((b) => (
                      <BookingCard key={b.id} b={b} onCancel={handleCancelBooking} cancelling={cancelling === b.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => (
                <BookingCard key={b.id} b={b} onCancel={handleCancelBooking} cancelling={cancelling === b.id} />
              ))}
            </div>
          )
        ) : (
          <DemoBranch
            loading={<LoadingSkeleton variant="card" count={4} />}
            error={
              <ErrorState
                title="Couldn't load games"
                message="We couldn't reach the games feed. Pull down to retry."
                onRetry={refetch}
              />
            }
            empty={gamesEmpty}
          >
            {loading ? (
              <LoadingSkeleton variant="card" count={4} />
            ) : error ? (
              <ErrorState title="Couldn't load games" message={error} onRetry={refetch} />
            ) : games.length === 0 ? (
              gamesEmpty
            ) : filteredGames.length === 0 ? (
              <EmptyState
                icon="filter"
                title="No games match these filters"
                description="Loosen or clear your filters to see more games."
                action={{ label: 'Clear filters', onPress: () => setFilters(makeDefaultGameFilters()) }}
              />
            ) : gamesView === 'mine' ? (
              <MyGamesSections
                games={filteredGames}
                meId={me?.id}
                onOpen={openGame}
                onNavigate={onNavigate}
                onDeleted={(id) => setGames((prev) => prev.filter((x) => x.id !== id))}
              />
            ) : (
              <div className="flex flex-col">
                {grouped.map((section) => (
                  <div key={section.header} className="mb-5 last:mb-0">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="text-[12px] font-extrabold tracking-[0.08em] text-[var(--muted)]">{section.header}</div>
                      <div className="flex-1 h-px bg-[var(--hairline)]" />
                      <div className="text-[12px] font-bold text-[var(--muted)]">{section.items.length}</div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {section.items.map((g) => (
                        <BrowseGameCard key={g.id} g={g} onTap={() => openGame(g)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DemoBranch>
        )}
      </div>

      <GameFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onChange={setFilters}
        resultCount={filteredGames.length}
      />
    </div>
  );
}
