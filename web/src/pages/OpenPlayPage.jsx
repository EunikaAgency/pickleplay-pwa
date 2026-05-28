import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getGames, getVenue } from '../data/index.js';

export default function OpenPlayPage() {
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  let sessions = getGames().filter(g => g.format === 'open_play' && g.status === 'upcoming');
  if (search.trim()) { const q = search.toLowerCase(); sessions = sessions.filter(s => s.title.toLowerCase().includes(q) || s.venueName.toLowerCase().includes(q)); }
  if (skillFilter) { const min = parseFloat(skillFilter); sessions = sessions.filter(s => s.skillMin <= min && s.skillMax >= min); }
  sessions.sort((a,b) => new Date(a.gameDate) - new Date(b.gameDate));

  return (
    <div>
      <section className="bg-gradient-to-br from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-base font-bold uppercase tracking-wider text-[#C1F100]">Just show up & play!</p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Open Play</h1>
          <p className="mt-2 text-white/70">{sessions.length} sessions — no team needed, just bring your paddle!</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input type="text" placeholder="Search by venue or title..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <input type="number" step="0.5" min="0" max="10" placeholder="Skill" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}
            className="h-12 w-28 rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base" />
          <Link to="/open-play/create" className="inline-flex h-12 items-center rounded-full bg-[#C1F100] px-6 text-base font-extrabold text-[#374D00] no-underline shadow-md hover:scale-105 active:scale-95 transition-transform">
            <Icon name="add" size={20} /> Host One
          </Link>
        </div>
        <div className="mt-6 space-y-4">
          {sessions.map((s, i) => {
            const venue = getVenue(s.venueId);
            return (
              <Link key={s.id} to={`/open-play/${s.id}`}
                className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-lg no-underline transition-all hover:-translate-y-1 hover:shadow-xl sm:flex-row"
                style={{ animation: `slide-up 0.3s ease-out ${i*0.05}s both` }}>
                {venue && <img src={venue.heroImage} alt="" className="h-44 w-full rounded-xl object-cover sm:h-32 sm:w-48 shrink-0" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Open Play</span>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-base font-extrabold uppercase">Skill {s.skillMin===s.skillMax?s.skillMin:`${s.skillMin}-${s.skillMax}`}</span>
                    {s.beginnerFriendly && <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-base font-extrabold uppercase text-on-primary-fixed">Beginners!</span>}
                    {!s.fee ? <span className="rounded-full bg-[#C1F100]/30 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Free!</span> : <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-base font-extrabold uppercase">${s.fee}</span>}
                  </div>
                  <h3 className="mt-2 font-heading text-lg font-bold text-on-surface">{s.title}</h3>
                  <p className="mt-1 text-base text-on-surface-variant">{s.venueName}</p>
                  <p className="mt-1 line-clamp-2 text-base text-on-surface-variant">{s.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-base text-on-surface-variant">
                    <span className="flex items-center gap-1"><Icon name="calendar_today" size={14} />{new Date(s.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                    <span className="flex items-center gap-1"><Icon name="schedule" size={14} />{s.startTime} - {s.endTime}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-[#C1F100]" style={{width:`${(s.participantCount/s.playerLimit)*100}%`}} /></div>
                    <span className="text-base font-extrabold">{s.participantCount}/{s.playerLimit}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
