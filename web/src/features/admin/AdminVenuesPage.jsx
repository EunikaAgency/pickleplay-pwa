import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../shared/components/dashboard/DataTable.jsx';
import Icon from '../../shared/components/Icon.jsx';
import { fetchVenues } from '../venues/api.js';

const STATE_TONE = {
  claimed: 'bg-primary-container text-on-primary-container',
  active: 'bg-secondary-container text-on-secondary-container',
  unclaimed: 'bg-surface-container-high text-on-surface-variant',
  delisted: 'bg-error-container text-on-error-container',
};

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  useEffect(() => {
    const ctrl = new AbortController();
    fetchVenues({ limit: 500, signal: ctrl.signal })
      .then((data) => { setVenues(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => {
    let rows = venues;
    if (stateFilter !== 'all') {
      rows = rows.filter((v) => {
        const s = v.raw?.state || (v.isClaimed ? 'claimed' : 'unclaimed');
        return s === stateFilter;
      });
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((v) =>
        (v.name || '').toLowerCase().includes(needle) ||
        (v.city || '').toLowerCase().includes(needle) ||
        (v.region || '').toLowerCase().includes(needle) ||
        (v.slug || '').toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [venues, q, stateFilter]);

  const counts = useMemo(() => {
    const c = { claimed: 0, unclaimed: 0 };
    for (const v of venues) {
      const s = v.raw?.state || (v.isClaimed ? 'claimed' : 'unclaimed');
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [venues]);

  const columns = [
    {
      key: 'name',
      header: 'Venue',
      render: (v) => (
        <div className="flex items-center gap-3">
          {v.heroImage ? (
            <img src={v.heroImage} alt="" className="size-10 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <Icon name="stadium" size={18} />
            </div>
          )}
          <div className="min-w-0">
            <Link to={`/venues/${v.slug}`} target="_blank" className="font-semibold text-on-surface hover:underline no-underline">{v.name}</Link>
            <p className="truncate text-label-sm text-on-surface-variant">{v.city}{v.region ? ` · ${v.region}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      render: (v) => {
        const s = v.raw?.state || (v.isClaimed ? 'claimed' : 'unclaimed');
        return (
          <div className="flex flex-col gap-1">
            <span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase inline-block w-fit ${STATE_TONE[s] || STATE_TONE.unclaimed}`}>{s}</span>
            {v.isPartner && <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-label-sm font-bold uppercase text-[#374D00] inline-block w-fit">Verified</span>}
          </div>
        );
      },
    },
    { key: 'courtCount', header: 'Courts', render: (v) => <span className="tabular-nums">{v.courtCount ?? '—'}</span> },
    {
      key: 'rating',
      header: 'Rating',
      render: (v) => v.rating != null ? (
        <span className="flex items-center gap-1"><Icon name="star" size={14} filled className="text-[#2E5BFF]" />{v.rating} <span className="text-label-sm text-on-surface-variant">({v.reviewCount || 0})</span></span>
      ) : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'priceFrom',
      header: 'Price',
      render: (v) => v.priceFrom != null ? <span className="tabular-nums">{v.pricingCurrency} {v.priceFrom}</span> : <span className="text-on-surface-variant">·</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (v) => (
        <Link to={`/venues/${v.slug}`} target="_blank" className="text-label-sm font-semibold text-primary no-underline hover:underline">
          View ↗
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-on-surface">Venues</h1>
          <p className="mt-1 text-on-surface-variant">
            {loading ? 'Loading…' : `${filtered.length} of ${venues.length}`} venues
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
        <div className="relative flex-1 min-w-[240px]">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            aria-label="Search venues"
            placeholder="Search by name, city, or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-10 pr-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {[
            { id: 'all', label: `All (${venues.length})` },
            { id: 'claimed', label: `Claimed (${counts.claimed || 0})` },
            { id: 'unclaimed', label: `Unclaimed (${counts.unclaimed || 0})` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStateFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-base font-semibold transition-colors ${
                stateFilter === opt.id ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
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
        emptyMessage={q ? `No venues match "${q}".` : 'No venues yet.'}
        rowKey="id"
      />
    </div>
  );
}
