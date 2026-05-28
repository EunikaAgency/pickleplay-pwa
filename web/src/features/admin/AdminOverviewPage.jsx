import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../shared/api/client.js';
import { fetchAdminUsers, fetchTables } from './api.js';
import StatCard from '../../shared/components/dashboard/StatCard.jsx';
import MiniChart from '../../shared/components/dashboard/MiniChart.jsx';
import Icon from '../../shared/components/Icon.jsx';

// Build a 30-day series from any list of docs that has a date field.
// Returns [{ date: 'YYYY-MM-DD', value: number }] with zero-fill.
function buildDailySeries(docs, dateField, days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    series.set(d.toISOString().slice(0, 10), 0);
  }
  for (const doc of docs || []) {
    const raw = doc?.[dateField];
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (series.has(key)) series.set(key, series.get(key) + 1);
  }
  return [...series.entries()].map(([date, value]) => ({ date, value }));
}

const fmt = new Intl.NumberFormat('en-US');

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ users: 0, venues: 0, coaches: 0, bookings: 0 });
  const [series, setSeries] = useState({ signups: [], venues: [], coaches: [], reviews: [] });
  const [tables, setTables] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    setLoading(true);

    Promise.allSettled([
      fetchAdminUsers({ limit: 500, signal: ctrl.signal }),
      apiGet('/api/v1/venues?limit=500', { signal: ctrl.signal }),
      apiGet('/api/v1/coaches?limit=500', { signal: ctrl.signal }),
      apiGet('/api/v1/posts?limit=200', { signal: ctrl.signal }).catch(() => ({ data: [] })),
      fetchTables({ signal: ctrl.signal }).catch(() => null),
    ]).then(([usersR, venuesR, coachesR, , tablesR]) => {
      if (!alive) return;

      const users = usersR.status === 'fulfilled' ? usersR.value : [];
      const venues = (venuesR.status === 'fulfilled' && venuesR.value?.data) || [];
      const coaches = (coachesR.status === 'fulfilled' && coachesR.value?.data) || [];

      setStats({
        users: users.length,
        venues: venues.length,
        coaches: coaches.length,
        bookings: 0, // wired in next chunk
      });

      setSeries({
        signups: buildDailySeries(users, 'createdAt'),
        venues: buildDailySeries(venues, 'createdAt'),
        coaches: buildDailySeries(coaches, 'createdAt'),
        reviews: [], // requires GET /api/v1/admin/reviews; wired in moderation chunk
      });

      if (tablesR.status === 'fulfilled') setTables(tablesR.value);
      setError(null);
    }).catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; ctrl.abort(); };
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Admin overview</h1>
        <p className="mt-1 text-on-surface-variant">Live snapshot of the platform. Last 30 days for charts.</p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-2xl bg-error-container/30 p-4 text-base font-semibold text-on-error-container">
          Could not load some stats ({error.status || 'network error'}). Refresh to retry.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={loading ? '…' : fmt.format(stats.users)} icon="people" tone="primary" />
        <StatCard label="Venues" value={loading ? '…' : fmt.format(stats.venues)} icon="stadium" tone="secondary" />
        <StatCard label="Coaches" value={loading ? '…' : fmt.format(stats.coaches)} icon="sports" tone="tertiary" />
        <StatCard label="Bookings" value={loading ? '…' : fmt.format(stats.bookings)} icon="event_available" tone="neutral" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <MiniChart title="Signups · 30 days" data={series.signups} color="#0040E0" />
        <MiniChart title="New venues · 30 days" data={series.venues} color="#22c55e" />
        <MiniChart title="New coaches · 30 days" data={series.coaches} color="#a855f7" />
        <MiniChart title="New reviews · 30 days" data={series.reviews} color="#eab308" />
      </div>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-md">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-on-surface">Quick links</h2>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/admin/users', label: 'Users', icon: 'people' },
            { to: '/admin/venues', label: 'Venues', icon: 'stadium' },
            { to: '/admin/moderation', label: 'Moderation', icon: 'gavel' },
            { to: '/admin/reports', label: 'Reports', icon: 'analytics' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-3 rounded-xl border border-surface-variant bg-surface-container-low px-4 py-3 text-base font-semibold text-on-surface no-underline transition-colors hover:bg-surface-container-high"
            >
              <Icon name={l.icon} size={20} />
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      {tables && (
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-md">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-on-surface">Database collections</h2>
            <span className="text-label-sm text-on-surface-variant">via /api/tables/data</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-surface-variant text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="pb-2 pr-4 font-bold">Collection</th>
                  <th className="pb-2 pr-4 font-bold tabular-nums">Documents</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(tables) ? tables : Object.entries(tables || {}).map(([name, count]) => ({ name, count }))).map((row) => (
                  <tr key={row.name || row.collection} className="border-b border-surface-variant/30 last:border-0">
                    <td className="py-2 pr-4 font-semibold text-on-surface">{row.name || row.collection}</td>
                    <td className="py-2 pr-4 tabular-nums text-on-surface-variant">{fmt.format(row.count ?? row.documents ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
