import { useEffect, useState } from 'react';
import { Chip } from '../../../shared/components/ui/Chip';
import { Toast } from '../../../shared/components/ui/Toast';
import { OwnerSection } from '../components/OwnerSection';
import { OwnerBookingRow } from '../components/OwnerBookingRow';
import { OwnerBookingDetailSheet } from '../OwnerBookingDetailSheet';
import { getVenueBookings, type ApiBooking } from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import type { Navigate } from '../../../shared/lib/navigation';

interface BookingsInboxTabProps {
  venueId: string;
  onNavigate: Navigate;
}

type Filter = 'all' | 'pending_approval' | 'confirmed' | 'cancelled';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'confirmed', label: 'Complete' },
  { id: 'cancelled', label: 'Cancelled' },
];

// Owner bookings inbox: review and cancel the bookings players make on this
// venue. Bookings arrive already paid + confirmed (no approval step). Mirrors
// the CourtsEditorTab mutation pattern (optimistic local update + toast).
// Server filters by status.
export function BookingsInboxTab({ venueId, onNavigate }: BookingsInboxTabProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.bookings.manage');
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<ApiBooking | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVenueBookings(venueId, filter === 'all' ? undefined : filter)
      .then((d) => { if (!cancelled) { setBookings(d); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [venueId, filter]);

  const onChanged = (updated: ApiBooking) => {
    setToast(true);
    setTimeout(() => setToast(false), 1800);
    // Drop it from the list if it no longer matches the active filter.
    setBookings((list) => {
      if (filter !== 'all' && updated.status !== filter) return list.filter((b) => b.id !== updated.id);
      return list.map((b) => (b.id === updated.id ? updated : b));
    });
  };

  return (
    <div className="space-y-4">
      <div className="scroll-x flex gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => { setFilter(f.id); setLoading(true); }}>{f.label}</Chip>
        ))}
      </div>

      <OwnerSection title="Bookings" icon="calendar" description={loading ? 'Loading…' : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`}>
        {error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load bookings.</div>
        ) : loading ? (
          <div className="t-sm">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">
            {filter === 'all' ? 'No bookings yet. When players book a court here, they show up for you to confirm.' : 'No bookings with this status.'}
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <OwnerBookingRow key={b.id} booking={b} canManage={canManage} onChanged={onChanged} onOpen={setDetail} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </OwnerSection>

      <OwnerBookingDetailSheet
        booking={detail}
        canManage={canManage}
        onClose={() => setDetail(null)}
        onChanged={onChanged}
        onNavigate={onNavigate}
      />

      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
