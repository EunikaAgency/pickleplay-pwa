import { Link } from 'react-router-dom';
import { getGames } from '../../shared/data/index.js';

export default function MyEventsPage() {
  const tournaments = getGames().filter(g => g.eventType==='Tournament');
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Events</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No events yet</h2>
        <p className="mt-2 text-base text-on-surface-variant">Register for tournaments and clinics! {tournaments.length} tournaments available.</p>
        <Link to="/tournaments" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">Browse Events</Link>
      </div>
    </div>
  );
}
