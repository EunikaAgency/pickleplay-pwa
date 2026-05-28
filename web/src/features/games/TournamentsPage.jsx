import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getGames, getVenues } from '../../shared/data/index.js';

export default function TournamentsPage() {
  const tournaments = getGames().filter(g => g.eventType === 'Tournament' && g.status === 'upcoming');
  const venues = getVenues();

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto flex max-w-6xl items-center gap-8">
          <div className="flex-1">
            <p className="text-label-sm font-bold uppercase tracking-wider text-[#C1F100]">Game On</p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Tournaments</h1>
            <p className="mt-2 text-white/70 max-w-md">{tournaments.length} upcoming — grab a partner and compete!</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12">
        {tournaments.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t, i) => {
              const v = venues.find(ven => ven.id === t.venueId);
              return (
                <Link key={t.id} to={`/open-play/${t.id}`}
                  className="group overflow-hidden rounded-2xl bg-white shadow-lg no-underline hover:-translate-y-1 hover:shadow-xl transition-all"
                  style={{animation:`slide-up 0.3s ease-out ${i*0.05}s both`}}>
                  {v ? <img src={v.heroImage} alt="" className="h-40 w-full object-cover" /> : <div className="h-40 w-full bg-gradient-to-r from-[#0040E0] to-[#2E5BFF]" />}
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏆</span>
                      <span className="text-label-sm font-extrabold uppercase text-on-surface-variant">{t.format.replace('_',' ')}</span>
                    </div>
                    <h3 className="mt-1 font-heading text-lg font-bold">{t.title}</h3>
                    <p className="mt-1 text-on-surface-variant">{t.venueName}</p>
                    <div className="mt-3 flex items-center gap-3 text-on-surface-variant">
                      <span className="flex items-center gap-1"><Icon name="calendar_today" size={14} />{new Date(t.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                      <span>{t.startTime}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-label-sm font-extrabold uppercase text-[#374D00]">Skill {t.skillMin===t.skillMax?t.skillMin:`${t.skillMin}-${t.skillMax}`}</span>
                      {t.fee && <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-extrabold uppercase">${t.fee}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <h2 className="mt-6 font-heading text-2xl font-extrabold">No tournaments yet</h2>
            <p className="mt-2 text-on-surface-variant">Be the first to organize one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
