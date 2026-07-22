import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminScreen, AdminFilters, AdminRow, AdminTag, AdminStates, adminNumber, type LoadState } from './AdminScaffold';
import { listAdminBookings, type AdminBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type BookingFilter = '' | 'pending_approval' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

const STATUS_COLOR: Record<string, string> = {
  pending_approval: 'var(--amber)',
  confirmed: 'var(--lime-ink)',
  completed: 'var(--blue)',
  cancelled: 'var(--coral)',
  no_show: 'var(--coral)',
};

/**
 * Admin console: the platform-wide court-bookings report. Filter by status;
 * "declined" surfaces owner rejections (stored as a cancelled row tagged
 * `owner_rejected`). Gated by `admin.bookings.manage`.
 */
export function AdminBookingsScreen({ onNavigate }: Props) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<BookingFilter>('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      // 'declined' isn't a real status — fetch cancelled and split client-side.
      const queryStatus = filter === 'declined' ? 'cancelled' : filter;
      const data = await listAdminBookings({ limit: 500, status: queryStatus || undefined });
      if (id !== reqId.current) return;
      const rows = filter === 'declined'
        ? data.filter((b) => b.cancellationType === 'owner_rejected')
        : filter === 'cancelled'
          ? data.filter((b) => b.cancellationType !== 'owner_rejected')
          : data;
      setBookings(rows);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => bookings.reduce((sum, b) => sum + (b.amount || 0), 0), [bookings]);

  return (
    <AdminScreen
      onBack={() => onNavigate('admin-hub')}
      title="Bookings"
      subtitle={`${bookings.length} bookings · ₱${adminNumber(total)} total · All court bookings across the platform with revenue totals.`}
      onRefresh={() => void load()}
    >
      <AdminFilters<BookingFilter>
        value={filter}
        onChange={setFilter}
        filters={[
          { value: '', label: 'All' },
          { value: 'pending_approval', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'declined', label: 'Declined' },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={bookings.length === 0}
        emptyIcon="event_available"
        emptyTitle="No bookings"
        emptyDescription="No bookings match this filter."
      >
        <div className="space-y-3 pb-6">
          {bookings.map((b) => {
            const s = b.status || 'pending_approval';
            const declined = s === 'cancelled' && b.cancellationType === 'owner_rejected';
            const label = (declined ? 'declined' : s).replace(/_/g, ' ');
            return (
              <AdminRow
                key={b._id || b.id}
                icon="event_available"
                title={b.referenceCode || `#${(b._id || b.id || '').slice(-6)}`}
                subtitle={[b.venueName, b.userName].filter(Boolean).join(' · ') || b.bookingType || 'court'}
                meta={
                  <div className="flex flex-col items-end gap-1">
                    <AdminTag label={label} color={STATUS_COLOR[s] || 'var(--muted)'} />
                    {b.amount != null && <span className="t-sm tabular-nums">₱{adminNumber(b.amount)}</span>}
                  </div>
                }
              >
                {(b.date || b.startTime) && (
                  <div className="t-sm mt-2">
                    {b.date}{b.startTime ? ` · ${b.startTime}${b.endTime ? `–${b.endTime}` : ''}` : ''}
                    {b.playerCount != null ? ` · ${b.playerCount} player${b.playerCount === 1 ? '' : 's'}` : ''}
                  </div>
                )}
              </AdminRow>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
