import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { apiGet, apiImageUrl } from '../../shared/api/client.js';

const TABS = ['All', 'Venues', 'Coaches'];

// Debounce helper — fires the function `delay` ms after the last call.
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const debouncedQuery = useDebounce(query.trim(), 300);

  const [results, setResults] = useState({ venues: [], coaches: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults({ venues: [], coaches: [] });
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    apiGet(`/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`, { signal: ctrl.signal })
      .then((res) => {
        setResults({
          venues: res?.data?.venues || [],
          coaches: res?.data?.coaches || [],
        });
        setError(null);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debouncedQuery]);

  const showVenues = activeTab === 'All' || activeTab === 'Venues';
  const showCoaches = activeTab === 'All' || activeTab === 'Coaches';
  const hasResults = results.venues.length + results.coaches.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 font-heading text-4xl font-extrabold text-on-surface">Find anything</h1>
        <p className="mt-2 text-on-surface-variant">Courts and coaches across the Philippines.</p>
      </div>

      <div className="relative mt-6">
        <Icon name="search" size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-outline" />
        <input
          type="search"
          placeholder='Try "Makati" or "Reyes"…'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="h-16 w-full rounded-2xl border border-outline-variant bg-white pl-14 pr-5 text-lg shadow-lg focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
        {loading && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">Searching…</span>
        )}
      </div>

      {debouncedQuery && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 text-base font-extrabold transition-all ${
                activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mt-8 rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container shadow-md">
          Search failed ({error.status || 'network error'}). Try again.
        </div>
      )}

      {debouncedQuery && !loading && !error && (
        <div className="mt-8 space-y-8">
          {showVenues && results.venues.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">🏟️ Venues <span className="text-base font-normal text-on-surface-variant">({results.venues.length})</span></h2>
              <div className="mt-3 space-y-2">
                {results.venues.map((v) => (
                  <Link key={v._id} to={`/venues/${v.slug}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg no-underline transition-all hover:-translate-y-0.5 hover:shadow-xl">
                    {v.mainImageUrl ? (
                      <img src={apiImageUrl(v.mainImageUrl)} alt="" className="h-14 w-14 rounded-xl object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                        <Icon name="stadium" size={22} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-on-surface">{v.displayName}</p>
                      <p className="truncate text-base text-on-surface-variant">
                        {v.area || v.region || '—'}{v.courtCount ? ` · ${v.courtCount} courts` : ''}
                        {v.googleRating ? ` · ⭐${v.googleRating}` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {showCoaches && results.coaches.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">🏆 Coaches <span className="text-base font-normal text-on-surface-variant">({results.coaches.length})</span></h2>
              <div className="mt-3 space-y-2">
                {results.coaches.map((c) => (
                  <Link key={c._id} to="/coaches" className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-lg no-underline transition-all hover:-translate-y-0.5 hover:shadow-xl">
                    {c.avatarUrl ? (
                      <img src={apiImageUrl(c.avatarUrl)} alt="" className="h-14 w-14 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                        <Icon name="sports" size={22} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-on-surface">{c.displayName}</p>
                      <p className="truncate text-base text-on-surface-variant">
                        {c.coachRoleLabel || c.location || '—'}
                        {c.rateFrom ? ` · ${c.priceCurrency || 'PHP'} ${c.rateFrom}+` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!hasResults && (
            <div className="mt-16 text-center">
              <div className="text-5xl">😕</div>
              <p className="mt-3 text-lg font-bold text-on-surface-variant">Nothing found for &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {!debouncedQuery && (
        <div className="mt-16 text-center">
          <div className="text-6xl">🏓🔍🏟️</div>
          <p className="mt-4 text-lg text-on-surface-variant">Search venues + coaches across the Philippines</p>
        </div>
      )}
    </div>
  );
}
