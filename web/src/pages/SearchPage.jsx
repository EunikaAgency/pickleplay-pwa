import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getVenues, getGames, getClubs, getUsers } from '../data/index.js';

const TABS = ['All','Venues','Games','Clubs','Players'];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const q = query.toLowerCase().trim();

  const venues = q ? getVenues().filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q)).slice(0,5) : [];
  const games = q ? getGames().filter(g => g.title.toLowerCase().includes(q) || g.venueName.toLowerCase().includes(q)).slice(0,5) : [];
  const clubs = q ? getClubs().filter(c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))).slice(0,5) : [];
  const players = q ? getUsers().filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q)).slice(0,5) : [];
  const hasResults = venues.length + games.length + clubs.length + players.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 font-heading text-4xl font-extrabold text-on-surface">Find anything</h1>
        <p className="mt-2 text-on-surface-variant">Courts, games, clubs, players — all in one place.</p>
      </div>

      <div className="relative mt-6">
        <Icon name="search" size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-outline" />
        <input type="text" placeholder='Try "San Diego" or "Clinic"...' value={query} onChange={e => setQuery(e.target.value)} autoFocus
          className="h-16 w-full rounded-2xl border border-outline-variant bg-white pl-14 pr-5 text-lg shadow-lg focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
      </div>

      {q && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 text-base font-extrabold transition-all ${
                activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}>{tab}</button>
          ))}
        </div>
      )}

      {q && (
        <div className="mt-8 space-y-8">
          {(['All','Venues'].includes(activeTab)) && venues.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">🏟️ Venues</h2>
              <div className="mt-3 space-y-2">
                {venues.map(v => (
                  <Link key={v.id} to={`/venues/${v.slug}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg no-underline transition-all hover:-translate-y-0.5 hover:shadow-xl">
                    <img src={v.heroImage} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    <div><p className="font-bold text-on-surface">{v.name}</p><p className="text-base text-on-surface-variant">{v.city} · {v.courtCount} courts · ⭐{v.rating}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(['All','Games'].includes(activeTab)) && games.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">🏓 Games</h2>
              <div className="mt-3 space-y-2">
                {games.map(g => (
                  <Link key={g.id} to={`/open-play/${g.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg no-underline transition-all hover:-translate-y-0.5 hover:shadow-xl">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#0040E0] to-[#2E5BFF] text-2xl">🏓</div>
                    <div><p className="font-bold text-on-surface">{g.title}</p><p className="text-base text-on-surface-variant">{g.venueName} · {new Date(g.gameDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {g.startTime}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(['All','Clubs'].includes(activeTab)) && clubs.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">🤝 Clubs</h2>
              <div className="mt-3 space-y-2">
                {clubs.map(c => (
                  <Link key={c.id} to={`/clubs/${c.slug}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg no-underline transition-all hover:-translate-y-0.5 hover:shadow-xl">
                    <img src={c.avatarUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    <div><p className="font-bold text-on-surface">{c.name}</p><p className="text-base text-on-surface-variant">{c.memberCount} members · {c.tags.slice(0,3).join(', ')}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(['All','Players'].includes(activeTab)) && players.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">👤 Players</h2>
              <div className="mt-3 space-y-2">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg">
                    <img src={p.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
                    <div><p className="font-bold text-on-surface">{p.firstName} {p.lastName}</p><p className="text-base text-on-surface-variant">{p.skillLabel} · {p.location}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!hasResults && (
            <div className="mt-16 text-center text-5xl">😕<p className="mt-3 text-lg font-bold text-on-surface-variant">Nothing found for &ldquo;{query}&rdquo;</p></div>
          )}
        </div>
      )}

      {!q && (
        <div className="mt-16 text-center text-6xl">🏓🔍🏟️<p className="mt-4 text-lg text-on-surface-variant">Search for anything pickleball</p></div>
      )}
    </div>
  );
}
