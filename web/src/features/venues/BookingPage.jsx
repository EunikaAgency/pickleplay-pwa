import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getVenue, getCourts } from '../../shared/data/index.js';

const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

export default function BookingPage() {
  const { slug } = useParams();
  // Hooks must run in the same order on every render — call them BEFORE the
  // not-found early return, then derive everything else from `venue`.
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const venue = getVenue(slug);
  if (!venue) return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center"><div className="text-5xl">😕</div><h1 className="mt-4 font-heading text-3xl font-extrabold">Venue not found</h1><Link to="/venues" className="mt-4 font-bold text-primary no-underline hover:underline">Back to venues</Link></div>;

  const courts = getCourts(venue.id);
  const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to={`/venues/${venue.slug}`} className="inline-flex items-center gap-1 text-base font-bold text-primary no-underline hover:underline"><Icon name="arrow_back" size={20} /> Back to {venue.name}</Link>

      <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-6 text-white">
        <p className="text-base font-bold uppercase tracking-wider text-[#C1F100]">Book a Court</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold">{venue.name}</h1>
        <p className="text-white/70">{venue.city}</p>
      </div>

      {/* Step 1: Court */}
      <section className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="font-heading text-xl font-bold"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0040E0] text-base text-white mr-2">1</span>Choose a court</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {courts.filter(c => c.status === 'active').map(court => (
            <button key={court.id} onClick={() => setSelectedCourt(court)}
              className={`rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md ${
                selectedCourt?.id === court.id ? 'border-primary bg-primary-fixed shadow-md' : 'border-surface-variant hover:bg-surface-container-low'
              }`}>
              <div className="flex items-center justify-between"><h3 className="font-heading text-base font-bold">{court.name}</h3><span className="text-base font-extrabold text-on-surface">${court.pricePerHour}/hr</span></div>
              <p className="mt-1 text-base text-on-surface-variant">{court.surface}{court.isIndoor ? ' · Indoor' : ''}</p>
            </button>
          ))}
        </div>
      </section>

      {selectedCourt && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="font-heading text-xl font-bold"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0040E0] text-base text-white mr-2">2</span>Pick a date</h2>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {dates.map(d => {
              const ds = d.toISOString().split('T')[0];
              return (
                <button key={ds} onClick={() => setSelectedDate(ds)}
                  className={`shrink-0 rounded-2xl px-5 py-3 text-center transition-all ${
                    selectedDate === ds ? 'bg-primary text-white shadow-md' : 'border-2 border-surface-variant hover:bg-surface-container-low'
                  }`}>
                  <div className="text-base font-extrabold uppercase">{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
                  <div className="text-xl font-extrabold">{d.getDate()}</div>
                  <div className="text-base uppercase">{d.toLocaleDateString('en-US',{month:'short'})}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedDate && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="font-heading text-xl font-bold"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0040E0] text-base text-white mr-2">3</span>Pick a time</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {HOURS.map(hour => (
              <button key={hour} onClick={() => setSelectedTime(hour)}
                className={`rounded-xl px-5 py-2.5 text-base font-bold transition-all ${
                  selectedTime === hour ? 'bg-primary text-white shadow-md' : 'border-2 border-surface-variant hover:bg-surface-container-low'
                }`}>{hour}</button>
            ))}
          </div>
        </section>
      )}

      {selectedTime && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="font-heading text-xl font-bold">🏓 Ready to book!</h2>
          <div className="mt-4 space-y-2 text-base">
            <div className="flex justify-between"><span className="text-on-surface-variant">Court</span><span className="font-bold">{selectedCourt.name}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Date</span><span className="font-bold">{new Date(selectedDate+'T00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Time</span><span className="font-bold">{selectedTime}</span></div>
            <hr className="border-surface-variant" />
            <div className="flex justify-between text-lg"><span className="font-extrabold">Total</span><span className="font-extrabold text-on-surface">${selectedCourt.pricePerHour}</span></div>
          </div>
          <button onClick={() => { if (!selectedCourt || !selectedDate || !selectedTime) return; alert(`Booking confirmed!\n${selectedCourt.name}\n${selectedDate} at ${selectedTime}\n$${selectedCourt.pricePerHour}`); }}
            className="mt-6 h-14 w-full rounded-2xl bg-[#C1F100] text-lg font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform">
            Confirm Booking 🎉
          </button>
        </section>
      )}
    </div>
  );
}
