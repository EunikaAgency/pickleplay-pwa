import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../shared/components/ui/Icon';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { listCourts, getVenueBookings, listSlotOverrides, type ApiBooking, type OwnerCourt, type SlotPriceOverride } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { prettyDate, todayYMD, to12h } from '../bookings/bookingDisplay';

interface OwnerCalendarScreenProps {
  onBack: () => void;
  onNavigate: Navigate;
}

type BookingFilter = 'all' | 'game' | 'open_private' | 'reserved' | 'blocked';

type CalendarRow = {
  id: string;
  label: string;
  subLabel?: string;
  courtId?: string;
};

type CellBooking = {
  id: string;
  tone: 'private' | 'reserved' | 'game' | 'blocked' | 'pending';
  label: string;
  subLabel?: string;
  detail: string;
};

type RowSegment =
  | { type: 'booking'; booking: CellBooking; span: number; extra: number }
  | { type: 'empty'; span: number };

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const FILTERS: { id: BookingFilter; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'game', label: 'Games' },
  { id: 'open_private', label: 'Open Play / Private Game' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'blocked', label: 'Blocked' },
];
const SELECTED_VENUE_STORAGE_KEY = 'pb-owner-calendar-selected-venue';

function readSavedVenue() {
  try {
    return window.localStorage.getItem(SELECTED_VENUE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveSelectedVenue(id: string) {
  try {
    if (id) window.localStorage.setItem(SELECTED_VENUE_STORAGE_KEY, id);
    else window.localStorage.removeItem(SELECTED_VENUE_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable; the picker still works in-memory.
  }
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hourLabel(hour: number) {
  return to12h(`${String(hour).padStart(2, '0')}:00`).replace(':00 ', '');
}

function toMinutes(value?: string | null) {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** A public game's format → display label. New event formats (bracketing /
 *  round robin / mini tournament) are the target; legacy singles/doubles/open
 *  still map cleanly, and any other value is title-cased so nothing shows blank. */
function gameTypeLabel(t?: string | null) {
  const key = (t || '').toLowerCase().replace(/[\s-]+/g, '_');
  switch (key) {
    case 'bracketing': return 'Bracketing';
    case 'round_robin': return 'Round Robin';
    case 'mini_tournament': return 'Mini Tournament';
    case 'singles': return 'Singles';
    case 'doubles': return 'Doubles';
    case 'open': return 'Open';
    default: return t ? t.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Game';
  }
}

/** A public game (event) vs an invite-only (private) game. */
function isPublicGame(booking: ApiBooking) {
  return booking.bookingType === 'game' && booking.gameVisibility !== 'invite';
}

function bookingFilterOf(booking: ApiBooking): Exclude<BookingFilter, 'all'> {
  if (booking.bookingType === 'blocked') return 'blocked';
  if (booking.bookingType === 'reserved') return 'reserved';
  if (isPublicGame(booking)) return 'game';
  // Open Play + private court bookings + invite-only games share one bucket.
  return 'open_private';
}

function bookingTone(booking: ApiBooking): CellBooking['tone'] {
  if (booking.bookingType === 'blocked') return 'blocked';
  if (booking.bookingType === 'reserved') return 'reserved'; // owner-reserved slot
  if (isPublicGame(booking)) return 'game';
  if (booking.status === 'pending_approval' || booking.status === 'awaiting_payment') return 'pending';
  // Private booking, Open Play, invite-only game, manual — all share the blue tone.
  return 'private';
}

function bookingLabel(booking: ApiBooking) {
  if (booking.bookingType === 'blocked') return booking.blockReason?.trim() || 'Blocked / Maint.';
  if (booking.bookingType === 'reserved') return 'Reserved';
  if (booking.bookingType === 'game') return booking.gameVisibility === 'invite' ? 'Private Game' : 'Game / Event';
  if (booking.bookingType === 'open_play') return 'Open Play';
  if (booking.status === 'pending_approval') return 'Pending Approval';
  if (booking.status === 'awaiting_payment') return 'Awaiting Payment';
  if (booking.bookingType === 'manual') return 'Manual Booking';
  return 'Private Booking';
}

/** Secondary line under the main label — the game format for games, else none.
 *  Public games store their competitive format in `gameFormat`; fall back to the
 *  legacy `gameType` for older games created before that field existed. */
function bookingSubLabel(booking: ApiBooking): string | undefined {
  if (booking.bookingType !== 'game') return undefined;
  const raw = booking.gameFormat || (booking.gameType === 'public' ? '' : booking.gameType);
  return raw ? gameTypeLabel(raw) : undefined;
}

function bookingDetail(booking: ApiBooking) {
  const name = booking.customerName || booking.userName || 'Booked slot';
  const time = booking.startTime && booking.endTime ? `${to12h(booking.startTime)} - ${to12h(booking.endTime)}` : 'Time unavailable';
  return `${name} · ${time}`;
}

/** Convert a Maintenance or Reserved slot override into a synthetic booking so it
 *  renders in the calendar's hours table just like a real booking. */
function overrideToBooking(ov: SlotPriceOverride, venueId: string): ApiBooking {
  const courtSuffix = ov.courtId ? `-${ov.courtId}` : '';
  return {
    id: ov.id ? `${ov.id}${courtSuffix}` : `ov-${ov.date}-${ov.startTime}${courtSuffix}`,
    venueId,
    courtId: ov.courtId ?? null,
    date: ov.date,
    startTime: ov.startTime,
    endTime: ov.endTime,
    status: 'confirmed',
    bookingType: ov.note === 'Maintenance' ? 'blocked' : (ov.note === 'Reserved' ? 'reserved' : 'court'),
    blockReason: ov.note === 'Maintenance' ? 'Maintenance' : undefined,
    customerName: ov.note === 'Maintenance' ? 'Maintenance' : 'Reserved',
    userName: undefined,
    // Flag synthetic bookings so the calendar knows they were created from overrides,
    // not real bookings — click behaviour skips them (no detail sheet for overrides).
    _isOverride: true,
    userAvatarUrl: undefined,
    courtNumber: undefined,
    courtName: undefined,
    subUnitIndex: undefined,
    price: undefined,
    paymentStatus: undefined,
  } as ApiBooking;
}

function cellToneClasses(tone: CellBooking['tone']) {
  switch (tone) {
    case 'reserved':
      return 'border-[#a8d9b0] bg-[#eefaf1] text-[#17803d]';
    case 'game':
      return 'border-[#cdbef0] bg-[#f4f0fe] text-[#6d28d9]';
    case 'blocked':
      return 'border-[#f0b8bc] bg-[#fff3f3] text-[#d63c43]';
    case 'pending':
      return 'border-[#f3d493] bg-[#fff8e7] text-[#b66a00]';
    case 'private':
    default:
      return 'border-[#b8cae7] bg-[#eef4ff] text-[#2453a6]';
  }
}

export function OwnerCalendarScreen({ onBack, onNavigate }: OwnerCalendarScreenProps) {
  const { venues, status } = useOwnerDashboard({ withAnalytics: false });
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser ? userHasPermission(currentUser, 'owner.bookings.manage') : false;
  const [venue, setVenue] = useState(readSavedVenue);
  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => todayYMD());
  const [tooltip, setTooltip] = useState<{ label: string; subLabel?: string; detail: string; extra: number; x: number; y: number } | null>(null);
  const [detailBooking, setDetailBooking] = useState<ApiBooking | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const bookedDates = useMemo(() => {
    const set = new Set<string>();
    for (const booking of bookings) {
      if (booking.status !== 'cancelled' && booking.date) set.add(booking.date);
    }
    return set;
  }, [bookings]);
  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${prettyDate(ymd(first))} - ${prettyDate(ymd(last))}`;
  }, [weekDays]);

  useEffect(() => {
    if (weekDays.some((d) => ymd(d) === selectedDate)) return;
    setSelectedDate(ymd(weekDays[0]));
  }, [selectedDate, weekDays]);

  useEffect(() => {
    if (venues.length === 0) return;
    const venueIds = venues.map((v) => v.slug || v.id);
    if (venue && venueIds.includes(venue)) return;
    const savedVenue = readSavedVenue();
    const nextVenue = savedVenue && venueIds.includes(savedVenue) ? savedVenue : venueIds[0];
    setVenue(nextVenue);
    saveSelectedVenue(nextVenue);
  }, [venue, venues]);

  useEffect(() => {
    if (!venue) {
      setCourts([]);
      setBookings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    Promise.all([listCourts(venue), getVenueBookings(venue), listSlotOverrides(venue)])
      .then(([courtRows, bookingRows, overrides]) => {
        if (cancelled) return;
        setCourts(courtRows);
        // Merge maintenance / reserved overrides as synthetic bookings so they
        // appear in the calendar table. A venue-wide override (courtId null) is
        // duplicated onto every court so it appears on each court row instead of
        // the "Unassigned" catch-all.
        const merged: ApiBooking[] = [...bookingRows];
        for (const ov of overrides || []) {
          if (ov.note !== 'Maintenance' && ov.note !== 'Reserved') continue;
          if (ov.courtId) {
            merged.push(overrideToBooking(ov, venue));
          } else {
            for (const court of courtRows) {
              merged.push(overrideToBooking({ ...ov, courtId: court.id }, venue));
            }
          }
        }
        setBookings(merged);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setCourts([]);
        setBookings([]);
        setLoadError(err?.message || 'Could not load this venue calendar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venue, reloadKey]);

  const hasVenues = venues.length > 0;

  const rows = useMemo<CalendarRow[]>(() => {
    const out: CalendarRow[] = courts.map((court) => ({
      id: court.id,
      label: court.courtName || `Court ${court.courtNumber}`,
      subLabel: court.surfaceType || undefined,
      courtId: court.id,
    }));
    const hasUnassigned = bookings.some((booking) => booking.date === selectedDate && !booking.courtId && booking.status !== 'cancelled');
    if (hasUnassigned) {
      out.push({
        id: 'unassigned',
        label: 'Unassigned / Venue-wide',
        subLabel: 'Open play or bookings without a court',
      });
    }
    return out;
  }, [bookings, courts, selectedDate]);

  // Court-name column shrinks to fit the longest label (clamped) so short names
  // like "Court 1" don't leave a wide empty gutter, but "Unassigned / Venue-wide"
  // still fits without truncating.
  const courtColWidth = useMemo(() => {
    const longest = Math.max(6, ...rows.map((r) => r.label.length));
    return Math.min(220, Math.max(120, Math.round(longest * 7.5) + 28));
  }, [rows]);
  const gridCols = `${courtColWidth}px repeat(24, minmax(56px, 1fr))`;
  const tableMinWidth = courtColWidth + 24 * 56;

  const visibleBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDate && booking.status !== 'cancelled' && (filter === 'all' ? true : bookingFilterOf(booking) === filter)),
    [bookings, filter, selectedDate],
  );

  const cells = useMemo(() => {
    const map = new Map<string, CellBooking[]>();
    for (const booking of visibleBookings) {
      const start = toMinutes(booking.startTime);
      const end = toMinutes(booking.endTime);
      if (start == null || end == null || end <= start) continue;
      const rowId = booking.courtId || 'unassigned';
      for (const hour of HOURS) {
        const slotStart = hour * 60;
        const slotEnd = slotStart + 60;
        if (start < slotEnd && end > slotStart) {
          const key = `${rowId}:${hour}`;
          const list = map.get(key) || [];
          list.push({
            id: booking.id,
            tone: bookingTone(booking),
            label: bookingLabel(booking),
            subLabel: bookingSubLabel(booking),
            detail: bookingDetail(booking),
          });
          map.set(key, list);
        }
      }
    }
    return map;
  }, [visibleBookings]);

  const rowSegments = useMemo(() => {
    const map = new Map<string, RowSegment[]>();
    for (const row of rows) {
      const segments: RowSegment[] = [];
      let i = 0;
      while (i < 24) {
        const items = cells.get(`${row.id}:${HOURS[i]}`) || [];
        if (items.length > 0) {
          const booking = items[0];
          // Count how many consecutive hours share the SAME booking id.
          let span = 1;
          let extras = items.length - 1;
          while (i + span < 24) {
            const next = cells.get(`${row.id}:${HOURS[i + span]}`) || [];
            if (next.length > 0 && next[0].id === booking.id) {
              span++;
              extras = Math.max(extras, next.length - 1);
            } else break;
          }
          segments.push({ type: 'booking', booking, span, extra: extras });
          i += span;
        } else {
          segments.push({ type: 'empty', span: 1 });
          i++;
        }
      }
      map.set(row.id, segments);
    }
    return map;
  }, [cells, rows]);

  const metrics = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'cancelled');
    const blocked = active.filter((b) => b.bookingType === 'blocked').length;
    const reserved = active.filter((b) => b.bookingType === 'reserved').length;
    const games = active.filter((b) => isPublicGame(b)).length;
    const openPrivate = active.length - blocked - games - reserved;
    return { games, openPrivate, reserved, blocked };
  }, [bookings]);

  const venueLabel = useMemo(
    () => venues.find((v) => (v.slug || v.id) === venue)?.displayName || 'Venue',
    [venue, venues],
  );

  return (
    <div className="scroll owner-calendar-screen safe-top safe-bottom bg-[var(--bg)]">
      <div className="owner-calendar-content px-5 pt-4 sm:px-0 sm:pt-0">
        <div className="bg-[var(--surface)] text-[var(--ink)] rounded-[8px] sm:rounded-none px-3 py-2.5 border border-[var(--hairline)] sm:border-x-0 sm:border-t-0 shadow-[var(--shadow-card)] sm:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex items-start gap-2">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="mt-0.5 h-7 w-7 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] sm:hidden flex items-center justify-center shrink-0"
              >
                <Icon name="chevron" size={18} className="rotate-180" />
              </button>
              <div className="min-w-0">
                <div className="font-heading font-extrabold text-[17px] leading-tight">Court Calendar</div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">
                  {venueLabel} · booked slots by court and hour
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {status !== 'loading' && !hasVenues && (
                <button
                  type="button"
                  onClick={() => onNavigate('owner-venues')}
                  className="h-9 w-full sm:w-auto px-4 rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] text-[12px] font-extrabold text-[#f59e0b] text-left sm:text-center"
                >
                  No venue yet. Add or Claim a Venue
                </button>
              )}
              <select
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value);
                  saveSelectedVenue(e.target.value);
                }}
                aria-label="Venue"
                disabled={!hasVenues || status === 'loading'}
                className={status !== 'loading' && !hasVenues ? 'hidden' : 'h-9 w-full min-w-0 sm:w-auto sm:min-w-[190px] rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--ink)] outline-none disabled:opacity-70'}
              >
                {status === 'loading' && <option value="">Loading venues...</option>}
                {status !== 'loading' && !hasVenues && <option value="">No venues yet</option>}
                {venues.map((v) => {
                  const id = v.slug || v.id;
                  return <option key={id} value={id}>{v.displayName || 'Venue'}</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        <div className={status !== 'loading' && !hasVenues ? 'hidden' : 'mt-4 space-y-4'}>
          <div className="rounded-[8px] border border-[var(--field-border)] bg-[var(--surface)] px-3 py-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">2-week window</div>
                <div className="text-[13px] font-extrabold text-[var(--ink)] mt-0.5">{weekRangeLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setWeekStart((prev) => addDays(prev, -14))} className="h-9 px-3 rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] text-[12px] font-bold text-[var(--ink)]">
                  Prev
                </button>
                <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="h-9 px-3 rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] text-[12px] font-bold text-[var(--ink)]">
                  This week
                </button>
                <button type="button" onClick={() => setWeekStart((prev) => addDays(prev, 14))} className="h-9 px-3 rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] text-[12px] font-bold text-[var(--ink)]">
                  Next
                </button>
              </div>
            </div>

            {/* A 7-column grid at every size so the whole week always fits with no
                horizontal scroll — cards flex to fill the width (tighter on mobile,
                roomier on desktop). */}
            <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-2">
              {weekDays.map((day) => {
                const dateId = ymd(day);
                const active = selectedDate === dateId;
                const hasBooking = bookedDates.has(dateId);
                return (
                  <button
                    key={dateId}
                    type="button"
                    onClick={() => setSelectedDate(dateId)}
                    className={`relative min-w-0 rounded-[8px] border px-1 py-1.5 sm:px-3 sm:py-2 lg:py-3 text-center sm:text-left ${active ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-deep)]' : 'border-[var(--field-border)] bg-[var(--surface-2)] text-[var(--ink)]'}`}
                  >
                    {hasBooking && (
                      <span
                        aria-label="Has bookings"
                        className="absolute right-1 top-1 sm:right-2 sm:top-2 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#d63c43]"
                      />
                    )}
                    <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                    <div className="mt-0.5 text-[11px] sm:text-[13px] font-extrabold whitespace-nowrap">{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="font-bold uppercase tracking-wide">Types:</span>
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`h-8 px-3 rounded-[999px] border text-[11px] font-extrabold ${filter === option.id ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--field-border)] bg-[var(--surface)] text-[var(--muted)]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="px-1">
              <LoadingSkeleton variant="card" count={4} />
            </div>
          ) : loadError ? (
            <ErrorState title="Couldn't load calendar" message={loadError} onRetry={() => setReloadKey((n) => n + 1)} />
          ) : courts.length === 0 ? (
            <div className="rounded-[8px] border border-[var(--field-border)] bg-[var(--surface)] px-4 py-4 text-[13px] text-[var(--muted)]">
              No courts yet.{' '}
              <button type="button" onClick={() => onNavigate('owner-venue', { id: venue, tab: 'courts' })} className="font-bold text-[#f59e0b] underline">
                Add a court
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[8px] border border-[var(--field-border)] bg-[var(--surface)] shadow-sm">
                <div style={{ minWidth: tableMinWidth }}>
                  <div className="grid border-b border-[var(--field-border)] text-[11px] text-[var(--muted)]" style={{ gridTemplateColumns: gridCols }}>
                    <div className="sticky left-0 z-20 px-3 py-3 border-r border-[var(--field-border)] bg-[var(--surface)]">Court</div>
                    {HOURS.map((hour) => (
                      <div key={hour} className="px-1 py-3 text-center border-r border-[var(--field-border)] last:border-r-0">
                        {hourLabel(hour)}
                      </div>
                    ))}
                  </div>
                  {rows.map((row) => (
                    <div key={row.id} className="grid border-b border-[var(--field-border)] last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
                      <div className="sticky left-0 z-10 px-3 py-2.5 text-left border-r border-[var(--field-border)] bg-[var(--surface)]">
                        <div className="text-[13px] font-extrabold text-[var(--ink)]">{row.label}</div>
                        {row.subLabel && <div className="text-[11px] text-[var(--muted)]">{row.subLabel}</div>}
                      </div>
                      {(rowSegments.get(row.id) || []).map((seg, si) => {
                        const isLast = si === (rowSegments.get(row.id) || []).length - 1;
                        if (seg.type === 'booking') {
                          const b = seg.booking;
                          const showTip = (e: React.MouseEvent) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setTooltip({ label: b.label, subLabel: b.subLabel, detail: b.detail, extra: seg.extra, x: rect.left + rect.width / 2, y: rect.top });
                          };
                          const realBooking = bookings.find((bk) => bk.id === b.id);
                          const isOverride = (realBooking as any)?._isOverride;
                          return (
                            <div
                              key={`${row.id}-s${si}`}
                              className={`p-1 ${isLast ? '' : 'border-r border-[var(--field-border)]'}`}
                              style={{ gridColumn: `span ${seg.span}` }}
                            >
                              <button
                                type="button"
                                onMouseEnter={showTip}
                                onMouseLeave={() => setTooltip(null)}
                                onClick={() => { if (!isOverride && realBooking) setDetailBooking(realBooking); }}
                                className={`h-[52px] w-full rounded-[6px] border px-2 py-1.5 flex flex-col justify-between overflow-hidden text-left ${isOverride ? 'cursor-default' : 'cursor-pointer hover:brightness-95'} ${cellToneClasses(b.tone)}`}
                              >
                                <div className="truncate text-[10px] font-extrabold uppercase tracking-[0.04em]">{b.label}</div>
                                {b.subLabel && <div className="truncate text-[10px] font-bold leading-tight opacity-80">{b.subLabel}</div>}
                                <div className="truncate text-[10px] leading-tight opacity-90">{b.detail}</div>
                                {seg.extra > 0 && <div className="text-[10px] font-bold">+{seg.extra} more</div>}
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`${row.id}-s${si}`}
                            className={`p-1 ${isLast ? '' : 'border-r border-[var(--field-border)]'}`}
                            style={{ gridColumn: `span ${seg.span}` }}
                          >
                            <div className="h-[52px] rounded-[6px] border border-dashed border-[var(--hairline)] bg-[var(--surface-2)]/60" />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
                <Legend color="#6d28d9" label="Game / Event" />
                <Legend color="#17803d" label="Reserved" />
                <Legend color="#2453a6" label="Private booking / Open play" />
                <Legend color="#d63c43" label="Blocked / maintenance" />
                <Legend color="#b66a00" label="Pending / awaiting payment" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Games" value={String(metrics.games)} tone="purple" active={filter === 'game'} onClick={() => setFilter(filter === 'game' ? 'all' : 'game')} />
            <Metric label="Open Play / Private Game" value={String(metrics.openPrivate)} tone="blue" active={filter === 'open_private'} onClick={() => setFilter(filter === 'open_private' ? 'all' : 'open_private')} />
            <Metric label="Reserved" value={String(metrics.reserved)} tone="green" active={filter === 'reserved'} onClick={() => setFilter(filter === 'reserved' ? 'all' : 'reserved')} />
            <Metric label="Blocked slots" value={String(metrics.blocked)} tone="red" active={filter === 'blocked'} onClick={() => setFilter(filter === 'blocked' ? 'all' : 'blocked')} />
          </div>
        </div>
      </div>
      {detailBooking && (
        <OwnerBookingDetailSheet
          booking={detailBooking}
          canManage={canManage}
          onClose={() => setDetailBooking(null)}
          onChanged={(updated) => {
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
            setDetailBooking(null);
          }}
        />
      )}
      {tooltip && createPortal(
        <div
          role="tooltip"
          className="fixed z-[9999] pointer-events-none"
          style={{ left: tooltip.x, bottom: window.innerHeight - tooltip.y + 8, transform: 'translateX(-50%)' }}
        >
          <div className="rounded-[6px] bg-[#1a2138] px-3 py-2 text-[11px] leading-snug shadow-xl max-w-[260px]">
            <div className="font-extrabold text-white">{tooltip.label}</div>
            {tooltip.subLabel && <div className="text-white/70 mt-0.5">{tooltip.subLabel}</div>}
            <div className="text-white/80 mt-0.5">{tooltip.detail}</div>
            {tooltip.extra > 0 && <div className="text-white/70 mt-0.5">+{tooltip.extra} more booking{tooltip.extra === 1 ? '' : 's'}</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Metric({ label, value, tone, active, onClick }: { label: string; value: string; tone: 'blue' | 'green' | 'red' | 'purple'; active?: boolean; onClick?: () => void }) {
  const color = tone === 'green' ? 'text-[#17803d]' : tone === 'red' ? 'text-[#d63c43]' : tone === 'purple' ? 'text-[#6d28d9]' : 'text-[#2453a6]';
  const activeColor = tone === 'green' ? '#17803d' : tone === 'red' ? '#d63c43' : tone === 'purple' ? '#6d28d9' : '#2453a6';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] border bg-[var(--surface)] px-3 py-3 shadow-sm text-left w-full transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{ borderColor: active ? activeColor : 'var(--field-border)', boxShadow: active ? `0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px ${activeColor}40` : undefined }}
    >
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-heading font-extrabold text-[17px] leading-tight ${color}`}>{value}</div>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}
