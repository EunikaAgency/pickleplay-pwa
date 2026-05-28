import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyBookings } from './api.js';

const STATUS_TONE = {
  pending_approval: 'bg-tertiary-container text-on-tertiary-container',
  confirmed: 'bg-secondary-container text-on-secondary-container',
  cancelled: 'bg-error-container text-on-error-container',
  completed: 'bg-primary-container text-on-primary-container',
  no_show: 'bg-error-container text-on-error-container',
};

function BookingCard({ booking }) {
  const s = booking.status || 'pending_approval';
  return (
    <div className="rounded-2xl bg-white p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold text-on-surface">
            {booking.referenceCode || `Booking #${(booking._id || '').slice(-6)}`}
          </p>
          <p className="mt-0.5 text-base text-on-surface-variant">
            {booking.bookingType || 'court'} · venue {(booking.venueId || '').slice(-6)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${STATUS_TONE[s] || STATUS_TONE.pending_approval}`}>
          {s.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-base">
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Date</p>
          <p className="mt-0.5 text-on-surface">{booking.date || '—'}</p>
        </div>
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Time</p>
          <p className="mt-0.5 text-on-surface">{booking.startTime || '—'}{booking.endTime ? ` – ${booking.endTime}` : ''}</p>
        </div>
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Players</p>
          <p className="mt-0.5 text-on-surface tabular-nums">{booking.playerCount ?? '—'}</p>
        </div>
        <div>
          <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Amount</p>
          <p className="mt-0.5 text-on-surface tabular-nums">{booking.amount != null ? `PHP ${booking.amount}` : '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchMyBookings({ signal: ctrl.signal })
      .then((data) => { setBookings(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    for (const b of bookings) {
      const s = b.status || 'pending_approval';
      if (s === 'pending_approval' || s === 'confirmed') up.push(b);
      else pa.push(b);
    }
    return { upcoming: up, past: pa };
  }, [bookings]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Bookings</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : error ? 'Could not load your bookings.' : `${bookings.length} bookings`}
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container shadow-md">
          Could not load your bookings ({error.status || 'network error'}).
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <div className="text-6xl">📅</div>
          <h2 className="mt-4 font-heading text-xl font-bold">No bookings yet</h2>
          <p className="mt-2 text-base text-on-surface-variant">Reserve a court to see it here.</p>
          <Link to="/venues" className="mt-4 inline-flex h-12 items-center rounded-full bg-[#C1F100] px-6 text-base font-extrabold text-[#374D00] no-underline shadow-md hover:scale-105 active:scale-95 transition-transform">
            Browse venues
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-heading text-xl font-bold text-on-surface">Upcoming</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-xl font-bold text-on-surface">Past</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {past.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
