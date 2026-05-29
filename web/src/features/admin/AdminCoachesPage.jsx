import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { fetchCoaches } from '../coaches/api.js';

export default function AdminCoachesPage() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCoaches({ limit: 500, signal: ctrl.signal })
      .then((data) => { setCoaches(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => {
    let rows = coaches;
    if (filter === 'verified') rows = rows.filter((c) => c.isVerified);
    if (filter === 'unverified') rows = rows.filter((c) => !c.isVerified);
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((c) =>
        (c.name || '').toLowerCase().includes(needle) ||
        (c.location || '').toLowerCase().includes(needle) ||
        (c.slug || '').toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [coaches, q, filter]);

  const verifiedCount = useMemo(() => coaches.filter((c) => c.isVerified).length, [coaches]);

  const columns = [
    {
      key: 'name',
      header: 'Coach',
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.avatar ? (
            <img src={c.avatar} alt="" className="size-9 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
              <Icon name="sports" size={18} />
            </div>
          )}
          <div className="min-w-0">
            <Link to={`/coaches`} target="_blank" className="font-semibold text-on-surface no-underline hover:underline">{c.name}</Link>
            <p className="truncate text-label-sm text-on-surface-variant">{c.location || c.region || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: (c) => c.isVerified ? <Icon name="verified" size={20} className="text-primary" /> : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'rateFrom',
      header: 'Rate',
      render: (c) => c.rateFrom != null ? <span className="tabular-nums">{c.priceCurrency} {c.rateFrom}+</span> : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (c) => c.rating != null && c.rating > 0 ? (
        <span className="flex items-center gap-1"><Icon name="star" size={14} filled className="text-[#2E5BFF]" />{c.rating} <span className="text-label-sm text-on-surface-variant">({c.reviewCount})</span></span>
      ) : <span className="text-on-surface-variant">no reviews</span>,
    },
    {
      key: 'yearsExperience',
      header: 'Years',
      render: (c) => c.yearsExperience != null ? <span className="tabular-nums">{c.yearsExperience}</span> : <span className="text-on-surface-variant">·</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Coaches</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : `${filtered.length} of ${coaches.length}`} coaches
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
        <div className="relative flex-1 min-w-[240px]">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            aria-label="Search coaches"
            placeholder="Search by name, location, or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {[
            { id: 'all', label: `All (${coaches.length})` },
            { id: 'verified', label: `Verified (${verifiedCount})` },
            { id: 'unverified', label: `Unverified (${coaches.length - verifiedCount})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-base font-semibold transition-colors ${
                filter === opt.id ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        emptyMessage={q ? `No coaches match "${q}".` : 'No coaches yet.'}
        rowKey="id"
      />
    </div>
  );
}
