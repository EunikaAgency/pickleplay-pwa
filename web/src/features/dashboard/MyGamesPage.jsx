import { Link } from 'react-router-dom';
import { getGames } from '../../shared/data/index.js';
import useAuth from '../auth/authStore.js';

export default function MyGamesPage() {
  const user = useAuth(s => s.user);
  const all = getGames();
  const myGames = all.filter(g => g.participantIds.includes(user?.id));
  const organized = all.filter(g => g.organizerId === user?.id);
  const upcoming = myGames.filter(g => g.status==='upcoming');

  if (!myGames.length && !organized.length) return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Games</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">🏓</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No games yet</h2>
        <p className="mt-2 text-base text-on-surface-variant">Join a game or create your own!</p>
        <Link to="/games" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">Find Games</Link>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Games</h1>
      <p className="mt-1 text-base text-on-surface-variant">{upcoming.length} upcoming · {organized.length} organized</p>
      {upcoming.length > 0 && (
        <div className="mt-6"><h2 className="font-heading text-xl font-bold">Playing in</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {upcoming.map(g => (
              <Link key={g.id} to={`/open-play/${g.id}`} className="rounded-2xl bg-white p-4 shadow-lg no-underline hover:shadow-xl transition-shadow">
                <span className="rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">{g.eventType}</span>
                <h3 className="mt-2 font-heading text-base font-bold text-on-surface">{g.title}</h3>
                <p className="mt-1 text-base text-on-surface-variant">{new Date(g.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {g.startTime} · {g.venueName}</p>
                <p className="mt-1 text-base text-on-surface-variant">{g.participantCount}/{g.playerLimit} players</p>
              </Link>
            ))}
          </div>
        </div>
      )}
      {organized.length > 0 && (
        <div className="mt-8"><h2 className="font-heading text-xl font-bold">You organized</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {organized.map(g => (
              <Link key={g.id} to={`/open-play/${g.id}`} className="rounded-2xl bg-white p-4 shadow-lg no-underline hover:shadow-xl transition-shadow">
                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-base font-extrabold uppercase text-on-primary-fixed">Organizer</span>
                <h3 className="mt-2 font-heading text-base font-bold text-on-surface">{g.title}</h3>
                <p className="mt-1 text-base text-on-surface-variant">{new Date(g.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {g.venueName}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
