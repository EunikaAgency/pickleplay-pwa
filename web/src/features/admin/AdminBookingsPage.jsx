import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { fetchAdminBookings } from './api.js';

const STATUS_TONE = {
  pending_approval: 'bg-tertiary-container text-on-tertiary-container',
  confirmed: 'bg-secondary-container text-on-secondary-container',
  cancelled: 'bg-error-container text-on-error-container',
  completed: 'bg-primary-container text-on-primary-container',
  no_show: 'bg-error-container text-on-error-container',
};

const fmt = new Intl.NumberFormat('en-US');

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchAdminBookings({ limit: 500, status: status || undefined, signal: ctrl.signal })
      .then((data) => { setBookings(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [status]);

  const totalAmount = useMemo(() => bookings.reduce((sum, b) => sum + (b.amount || 0), 0), [bookings]);

  const columns = [
    {
      key: '_id',
      header: 'Booking',
      render: (b) => (
        <div className="min-w-0">
          <p className="font-semibold text-on-surface">{b.referenceCode || `#${(b._id || '').slice(-6)}`}</p>
          <p className="text-label-sm text-on-surface-variant">{b.bookingType || 'court'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'When',
      render: (b) => (
        <div>
          <p className="text-on-surface">{b.date || '—'}</p>
          {b.startTime && <p className="text-label-sm text-on-surface-variant">{b.startTime}{b.endTime ? ` – ${b.endTime}` : ''}</p>}
        </div>
      ),
    },
    {
      key: 'venueId',
      header: 'Venue',
      render: (b) => <span className="text-on-surface-variant text-label-sm">{b.venueId?.slice?.(-6) || '—'}</span>,
    },
    {
      key: 'userId',
      header: 'User',
      render: (b) => <span className="text-on-surface-variant text-label-sm">{b.userId?.slice?.(-6) || '—'}</span>,
    },
    {
      key: 'playerCount',
      header: 'Players',
      render: (b) => <span className="tabular-nums">{b.playerCount ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (b) => b.amount != null ? <span className="tabular-nums">PHP {fmt.format(b.amount)}</span> : <span className="text-on-surface-variant">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => {
        const s = b.status || 'pending_approval';
        return <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[s] || STATUS_TONE.pending_approval}`}>{s.replace(/_/g, ' ')}</span>;
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-on-surface">Bookings</h1>
          <p className="mt-1 text-on-surface-variant">
            {loading ? 'Loading…' : `${bookings.length} bookings · PHP ${fmt.format(totalAmount)} total`}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
        <span className="text-base font-bold uppercase tracking-wider text-on-surface-variant">Status:</span>
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {[
            { id: '', label: 'All' },
            { id: 'pending_approval', label: 'Pending' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((opt) => (
            <button
              key={opt.id || 'all'}
              type="button"
              onClick={() => setStatus(opt.id)}
              className={`rounded-full px-3 py-1.5 text-base font-semibold transition-colors ${
                status === opt.id ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={bookings}
        loading={loading}
        error={error}
        emptyMessage={
          <div className="flex flex-col items-center gap-2">
            <Icon name="event_busy" size={48} className="text-on-surface-variant/50" />
            <p>No bookings yet — the booking flow isn't wired on the frontend.</p>
          </div>
        }
        rowKey="_id"
      />
    </div>
  );
}
