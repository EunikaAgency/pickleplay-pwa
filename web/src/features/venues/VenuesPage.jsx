import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getVenues } from '../../shared/data/index.js';
import VenueMap from '../../shared/components/VenueMap.jsx';

export default function VenuesPage() {
  const [viewMode, setViewMode] = useState('list');
  const [accessFilter, setAccessFilter] = useState('All');
  const [surfaceFilter, setSurfaceFilter] = useState('All');
  const [search, setSearch] = useState('');

  let venues = getVenues();
  if (accessFilter !== 'All') venues = venues.filter(v => v.accessType === accessFilter.toLowerCase());
  if (surfaceFilter !== 'All') venues = venues.filter(v => v.surface === surfaceFilter);
  if (search.trim()) {
    const q = search.toLowerCase();
    venues = venues.filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
  }

  return (
    <div>
      {/* Colorful header */}
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-base font-bold uppercase tracking-wider text-[#C1F100]">Where to play</p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Courts near you</h1>
          <p className="mt-2 text-white/70">{venues.length} venues ready for your next game</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Toggle + Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-lg">
          <div className="flex rounded-full bg-surface-container-low p-0.5">
            {['list','map'].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-base font-bold capitalize transition-all ${
                  viewMode === m ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}>
                <Icon name={m === 'list' ? 'list' : 'map'} size={18} /> {m}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input type="text" placeholder="Search venues..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <select value={accessFilter} onChange={e => setAccessFilter(e.target.value)} className="h-12 rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base">
            {['All','Public','Private'].map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={surfaceFilter} onChange={e => setSurfaceFilter(e.target.value)} className="h-12 rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base">
            {['All','Hard Court','Soft Court'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {viewMode === 'list' ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue, i) => (
              <Link key={venue.id} to={`/venues/${venue.slug}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl no-underline"
                style={{ animation: `slide-up 0.3s ease-out ${i * 0.05}s both` }}>
                <div className="relative h-44 overflow-hidden">
                  <img src={venue.heroImage} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex gap-1.5">
                    {venue.isPartner && <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Partner</span>}
                    {venue.isIndoor && <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-base font-extrabold uppercase text-on-surface">Indoor</span>}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-heading text-lg font-bold text-on-surface">{venue.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-base text-on-surface-variant"><Icon name="location_on" size={14} />{venue.city}</p>
                  <div className="mt-2 flex items-center gap-3 text-base">
                    <span className="flex items-center gap-1 font-bold"><Icon name="star" size={14} filled className="text-[#2E5BFF]" />{venue.rating}</span>
                    <span className="text-on-surface-variant">{venue.courtCount} courts</span>
                    <span className="text-on-surface-variant">{venue.surface}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex h-96 items-center justify-center rounded-2xl bg-white shadow-lg">
            <VenueMap venues={venues} />
          </div>
        )}

        {venues.length === 0 && (
          <div className="mt-16 text-center">🔍<p className="mt-3 text-lg font-bold text-on-surface-variant">No venues found. Try adjusting your filters.</p></div>
        )}
      </div>
    </div>
  );
}
