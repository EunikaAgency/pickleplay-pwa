import { Link } from 'react-router-dom';
import { getGames } from '../../shared/data/index.js';

export default function MyWaitlistsPage() {
  const full = getGames().filter(g => g.participantCount >= g.playerLimit && g.status === 'upcoming');
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">Waitlists</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">📋</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No waitlists</h2>
        <p className="mt-2 text-base text-on-surface-variant">Join a waitlist for a full game to see it here.</p>
        <p className="mt-3 text-base font-bold">{full.length} full games with waitlists available</p>
        <Link to="/games" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">Browse Games</Link>
      </div>
    </div>
  );
}
