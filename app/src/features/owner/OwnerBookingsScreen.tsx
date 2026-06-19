import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Chip } from '../../shared/components/ui/Chip';
import { Toast } from '../../shared/components/ui/Toast';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { OwnerStat } from './components/OwnerStat';
import { OwnerBookingRow } from './components/OwnerBookingRow';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { OwnerBookingsFilterSheet, type SortBy, type StatusFilter } from './OwnerBookingsFilterSheet';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { money, prettyDate, todayYMD } from '../bookings/bookingDisplay';
import type { ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

type WhenFilter = 'all' | 'upcoming' | 'ongoing' | 'past';

interface OwnerBookingsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** Pre-select a status filter when deep-linked (e.g. from the home "Awaiting approval" card). */
  initialStatus?: StatusFilter;
}

const WHEN_TABS: { id: WhenFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'past', label: 'Past' },
];

// "HH:MM" → minutes since midnight (null if unparseable).
function toMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Bucket a booking relative to now (today's YMD + minutes since midnight).
function whenBucket(b: ApiBooking, today: string, nowMin: number): 'upcoming' | 'ongoing' | 'past' {
  const d = b.date || '';
  if (d > today) return 'upcoming';
  if (d < today) return 'past';
  // Same day → split on the time-of-day.
  const s = toMin(b.startTime);
  const e = toMin(b.endTime);
  if (s != null && s > nowMin) return 'upcoming';
  if (e != null && e <= nowMin) return 'past';
  // Started and not yet ended (or no usable times on a today booking).
  return 'ongoing';
}

// Creation date (YYYY-MM-DD) from a Mongo ObjectId's leading timestamp bytes —
// the real "when booked" date (seeded rows' createdAt is unreliable).
function bookedYMD(id?: string): string {
  if (!id || id.length < 8) return '';
  const secs = parseInt(id.slice(0, 8), 16);
  if (Number.isNaN(secs)) return '';
  const d = new Date(secs * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// All-venues bookings inbox: every booking across the owner's venues in one
// list (tagged by venue). Primary lens is the When tabs (upcoming/ongoing/past);
// status, sort order, and the venue picker live in the Filter & sort sheet.
export function OwnerBookingsScreen({ onBack, initialStatus = 'all' }: OwnerBookingsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry, bookings, combined, pending, updateBookingRow } = useOwnerDashboard({ withBookings: true });
  const [whenFilter, setWhenFilter] = useState<WhenFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<ApiBooking | null>(null);
  const [toast, setToast] = useState(false);

  // Snapshot "now" once per mount so filtering/sorting is stable across renders.
  const today = todayYMD();
  const [nowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });

  const todayCount = useMemo(() => bookings.filter((b) => b.date === today && b.status !== 'cancelled').length, [bookings, today]);

  const rows = useMemo(() => {
    // Upcoming/ongoing read most naturally soonest-first; past/all newest-first.
    const asc = whenFilter === 'upcoming' || whenFilter === 'ongoing';
    return bookings
      .filter((b) => (statusFilter === 'all' ? true : b.status === statusFilter))
      .filter((b) => (venueFilter === 'all' ? true : (b.venueId || '') === venueFilter))
      .filter((b) => (whenFilter === 'all' ? true : whenBucket(b, today, nowMin) === whenFilter))
      .sort((a, b) => {
        if (sortBy === 'booked') return (b.id || '').localeCompare(a.id || ''); // newest booking first
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return asc ? da.localeCompare(db) : db.localeCompare(da);
        const ta = a.startTime || '';
        const tb = b.startTime || '';
        return asc ? ta.localeCompare(tb) : tb.localeCompare(ta);
      });
  }, [bookings, statusFilter, venueFilter, whenFilter, sortBy, today, nowMin]);

  // Walk the sorted rows into contiguous groups for the separators — by play
  // date when sorting on date, by booked-date when sorting on recency.
  const groups = useMemo(() => {
    const out: { key: string; items: typeof rows }[] = [];
    for (const b of rows) {
      const key = sortBy === 'booked' ? bookedYMD(b.id) : (b.date || '');
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(b);
      else out.push({ key, items: [b] });
    }
    return out;
  }, [rows, sortBy]);

  const sheetActiveCount =
    (statusFilter !== 'all' ? 1 : 0) + (sortBy !== 'date' ? 1 : 0) + (venueFilter !== 'all' ? 1 : 0);

  const onChanged = (updated: ApiBooking) => {
    setToast(true);
    setTimeout(() => setToast(false), 1800);
    updateBookingRow(updated);
  };

  const header = <ScreenHeader onBack={onBack} eyebrow="Owner console" title="Bookings" subtitle="Across all your venues" />;

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<ErrorState title="Couldn't load bookings" message="We couldn't reach your venues. Tap to retry." onRetry={retry} /></div>;
  }

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <OwnerStat label="Awaiting approval" value={pending.length} icon="bell" tone="coral" />
          <OwnerStat label="Bookings today" value={todayCount} icon="calendar" tone="primary" />
          <OwnerStat label="Revenue this week" value={money(combined.week)} icon="payments" tone="lime" />
        </div>

        {/* When tabs inline; status / sort / venue tucked into the Filter & sort sheet. */}
        <div className="flex items-center gap-2">
          <div className="scroll-x flex gap-2 flex-1 min-w-0">
            {WHEN_TABS.map((f) => (
              <Chip key={f.id} selected={whenFilter === f.id} onClick={() => setWhenFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>
          <button
            type="button"
            className={`chip shrink-0 ${sheetActiveCount ? 'active' : 'bg-[var(--surface-2)]!'}`}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter and sort"
          >
            Filter{sheetActiveCount ? ` · ${sheetActiveCount}` : ''}
          </button>
        </div>

        {/* List */}
        {rows.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">
            {bookings.length === 0 ? 'No bookings yet. When players book a court at one of your venues, they show up here to confirm.' : 'No bookings match these filters.'}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {groups.map((g) => (
              <div key={g.key || 'undated'} className="space-y-3">
                {/* Date separator (play date, or "Booked …" when sorting by recency) */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)] shrink-0">
                    {sortBy === 'booked'
                      ? (prettyDate(g.key) ? `Booked ${prettyDate(g.key)}` : 'Booked —')
                      : (prettyDate(g.key) || 'No date')}
                  </span>
                  <span className="flex-1 h-px bg-[var(--hairline)]" />
                  <span className="text-[12px] font-bold text-[var(--muted)] tabular-nums shrink-0">
                    {g.items.length}
                  </span>
                </div>
                {g.items.map((b) => (
                  <OwnerBookingRow key={b.id} booking={b} canManage={canManage} showVenue onChanged={onChanged} onOpen={setDetail} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <OwnerBookingsFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        venues={venues}
        venueFilter={venueFilter}
        onVenueChange={setVenueFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onReset={() => { setStatusFilter('all'); setSortBy('date'); setVenueFilter('all'); }}
        resultCount={rows.length}
      />

      <OwnerBookingDetailSheet
        booking={detail}
        canManage={canManage}
        onClose={() => setDetail(null)}
        onChanged={onChanged}
      />

      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
