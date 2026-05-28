import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getGames, getVenues } from '../../shared/data/index.js';


export default function LeaguesPage() {
  const leagues = getGames().filter(g => g.eventType === 'Round Robin' || g.eventType === 'Tournament');

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto flex max-w-6xl items-center gap-8">
          <div className="flex-1">
            <p className="text-label-sm font-bold uppercase tracking-wider text-[#C1F100]">Game On</p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Leagues</h1>
            <p className="mt-2 text-white/70 max-w-md">Find your competitive edge. Seasons, standings, and bragging rights.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
            <div className="p-8 text-center">
              <div className="text-5xl">🏆</div>
              <h2 className="mt-4 font-heading text-2xl font-extrabold">League Play</h2>
              <p className="mt-2 text-on-surface-variant">Join a season-long league. Teams, standings, playoffs, and a champion crowned each season.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">Teams of 4</span>
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">8-week seasons</span>
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">Playoffs</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
            <div className="p-8 text-center">
              <div className="text-5xl">🪜</div>
              <h2 className="mt-4 font-heading text-2xl font-extrabold">Ladders</h2>
              <p className="mt-2 text-on-surface-variant">Challenge players above you. Win and climb the ranks. Always someone to play.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">Singles & Doubles</span>
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">Ongoing</span>
                <span className="rounded-full bg-surface-container-high px-4 py-2 text-base font-extrabold uppercase">Skill-based</span>
              </div>
            </div>
          </div>
        </div>

        {leagues.length > 0 && (
          <div className="mt-12">
            <h2 className="font-heading text-2xl font-extrabold">Active Events</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {leagues.map((l, i) => {
                const v = getVenues().find(ven => ven.id === l.venueId);
                return (
                  <Link key={l.id} to={`/open-play/${l.id}`}
                    className="rounded-2xl bg-white shadow-lg no-underline hover:-translate-y-1 hover:shadow-xl transition-all overflow-hidden"
                    style={{animation:`slide-up 0.3s ease-out ${i*0.05}s both`}}>
                    {v && <img src={v.heroImage} alt="" className="h-36 w-full object-cover" />}
                    <div className="p-4">
                      <span className="rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-label-sm font-extrabold uppercase text-[#374D00]">{l.eventType}</span>
                      <h3 className="mt-2 font-heading text-lg font-bold">{l.title}</h3>
                      <p className="mt-1 text-on-surface-variant">{l.venueName}</p>
                      <div className="mt-2 flex items-center gap-3 text-on-surface-variant">
                        <span className="flex items-center gap-1"><Icon name="calendar_today" size={14} />{new Date(l.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                        <span>{l.startTime}</span>
                        <span>{l.participantCount}/{l.playerLimit} joined</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
