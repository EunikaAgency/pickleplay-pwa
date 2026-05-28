import { Link } from 'react-router-dom';
import { getBookings } from '../../shared/data/index.js';
import useAuth from '../auth/authStore.js';

export default function MyBookingsPage() {
  const user = useAuth(s => s.user);
  const bookings = getBookings().filter(b => b.userId === user?.id);
  const upcoming = bookings.filter(b => b.status==='confirmed'||b.status==='pending');
  const past = bookings.filter(b => b.status==='completed'||b.status==='cancelled');

  if (!bookings.length) return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Bookings</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">📅</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No bookings yet</h2>
        <p className="mt-2 text-base text-on-surface-variant">Book a court to see your reservations here.</p>
        <Link to="/venues" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">Find Courts</Link>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Bookings</h1>
      <p className="mt-1 text-base text-on-surface-variant">{upcoming.length} upcoming · {past.length} past</p>
      {upcoming.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-xl font-bold">Upcoming</h2>
          <div className="mt-3 space-y-3">
            {upcoming.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0040E0] text-white text-xl">🏟️</div>
                  <div>
                    <p className="font-bold">{b.venueName}</p>
                    <p className="text-base text-on-surface-variant">{new Date(b.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {b.startTime}-{b.endTime}</p>
                    <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-base font-extrabold uppercase ${b.status==='confirmed'?'bg-[#C1F100]/20 text-[#374D00]':'bg-surface-container-high text-on-surface-variant'}`}>{b.status}</span>
                  </div>
                </div>
                <div className="text-right"><p className="font-extrabold">${b.totalPrice}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold">Past</h2>
          <div className="mt-3 space-y-3 opacity-60">
            {past.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-xl">📅</div>
                  <div><p className="font-bold">{b.venueName}</p><p className="text-base text-on-surface-variant">{new Date(b.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
                    <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-base font-extrabold uppercase ${b.status==='completed'?'bg-[#C1F100]/20 text-[#374D00]':'bg-error-container text-on-error-container'}`}>{b.status}</span></div>
                </div>
                <p className="font-extrabold">${b.totalPrice}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
