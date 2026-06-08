import { useMemo, useState } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Chip } from '../../shared/components/ui/Chip';
import { Toast } from '../../shared/components/ui/Toast';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { OwnerStat } from './components/OwnerStat';
import { OwnerBookingRow } from './components/OwnerBookingRow';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { money, todayYMD } from '../bookings/bookingDisplay';
import type { ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerBookingsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type StatusFilter = 'all' | 'pending_approval' | 'confirmed' | 'cancelled';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'confirmed', label: 'Complete' },
  { id: 'cancelled', label: 'Cancelled' },
];

// All-venues bookings inbox: every booking across the owner's venues in one
// list (tagged by venue), filterable by status and venue, with inline actions.
export function OwnerBookingsScreen({ onBack }: OwnerBookingsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const { venues, status, retry, bookings, combined, pending, updateBookingRow } = useOwnerDashboard({ withBookings: true });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [toast, setToast] = useState(false);

  const today = todayYMD();
  const todayCount = useMemo(() => bookings.filter((b) => b.date === today && b.status !== 'cancelled').length, [bookings, today]);

  const rows = useMemo(() => {
    return bookings
      .filter((b) => (statusFilter === 'all' ? true : b.status === statusFilter))
      .filter((b) => (venueFilter === 'all' ? true : (b.venueId || '') === venueFilter))
      // Newest booking first — most recently *made* reservation on top, across all
      // venues. We sort by booking id (a Mongo ObjectId whose leading bytes are the
      // creation timestamp), NOT createdAt: the seeded demo rows set createdAt to
      // the play-date (sometimes future), so sorting on it just looks like date
      // sorting and buries genuinely new bookings. The id reflects true insertion
      // order, so real new bookings always land on top.
      .sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  }, [bookings, statusFilter, venueFilter]);

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

        {/* Status filter */}
        <div className="scroll-x flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.id} selected={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}>{f.label}</Chip>
          ))}
        </div>

        {/* Venue filter */}
        {venues.length > 1 && (
          <div className="scroll-x flex gap-2">
            <Chip selected={venueFilter === 'all'} onClick={() => setVenueFilter('all')}>All venues</Chip>
            {venues.map((v) => (
              <Chip key={v.id} selected={venueFilter === v.id} onClick={() => setVenueFilter(v.id)}>{v.displayName}</Chip>
            ))}
          </div>
        )}

        {/* List */}
        {rows.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">
            {bookings.length === 0 ? 'No bookings yet. When players book a court at one of your venues, they show up here to confirm.' : 'No bookings match these filters.'}
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {rows.map((b) => (
              <OwnerBookingRow key={b.id} booking={b} canManage={canManage} showVenue onChanged={onChanged} />
            ))}
          </div>
        )}
      </div>

      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
