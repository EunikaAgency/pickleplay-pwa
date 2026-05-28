import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getClubs } from '../data/index.js';

export default function ClubsPage() {
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  let clubs = getClubs();
  if (search.trim()) { const q = search.toLowerCase(); clubs = clubs.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))); }
  if (skillFilter) { const min = parseFloat(skillFilter); clubs = clubs.filter(c => c.skillMin <= min && c.skillMax >= min); }

  return (
    <div>
      <section className="bg-gradient-to-r from-[#2E5BFF] to-[#0040E0] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-base font-bold uppercase tracking-wider text-white/70">Community</p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Clubs</h1>
          <p className="mt-2 text-white/70">{clubs.length} clubs — find your pickle crew</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input type="text" placeholder="Search clubs..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <input type="number" step="0.5" min="0" max="10" placeholder="Skill" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}
            className="h-12 w-28 rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base" />
          <Link to="/clubs/create" className="inline-flex h-12 items-center rounded-full bg-[#C1F100] px-6 text-base font-extrabold text-[#374D00] no-underline shadow-md hover:scale-105 active:scale-95 transition-transform">
            <Icon name="add" size={20} /> Create
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club, i) => (
            <Link key={club.id} to={`/clubs/${club.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl no-underline"
              style={{ animation: `slide-up 0.3s ease-out ${i * 0.05}s both` }}>
              <div className="h-32 overflow-hidden">
                <img src={club.photoUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
              </div>
              <div className="-mt-8 p-4">
                <img src={club.avatarUrl} alt="" className="relative z-10 h-16 w-16 rounded-2xl border-4 border-white object-cover shadow-md" loading="lazy" />
                <h3 className="mt-2 font-heading text-lg font-bold text-on-surface">{club.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-base text-on-surface-variant">{club.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-bold text-on-surface">{club.memberCount} members</span>
                  {club.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-base font-extrabold uppercase text-on-surface-variant">{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
