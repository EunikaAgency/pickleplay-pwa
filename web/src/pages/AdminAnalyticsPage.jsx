import { getVenues, getGames, getUsers, getClubs } from '../data/index.js';

export default function AdminAnalyticsPage() {
  const venues = getVenues();
  const games = getGames();
  const users = getUsers();
  const clubs = getClubs();

  const stats = [
    { label: 'Total Users', value: users.length, change: '+12%' },
    { label: 'Active Venues', value: venues.length, change: '+5%' },
    { label: 'Total Games', value: games.length, change: '+18%' },
    { label: 'Active Clubs', value: clubs.length, change: '+3%' },
    { label: 'Upcoming Games', value: games.filter(g => g.status === 'upcoming').length, change: '' },
    { label: 'Revenue (est.)', value: '$4.2k', change: '+22%' },
  ];

  return (
    <div>
      <h1 className="font-heading text-headline-lg font-bold text-on-surface">Analytics</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-[14px] bg-surface-container-lowest p-6 shadow-card">
            <p className="text-label-sm font-bold uppercase text-on-surface-variant">{s.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-heading text-headline-xl font-bold text-on-surface">{s.value}</span>
              {s.change && <span className="text-body-md font-semibold text-secondary">{s.change}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
