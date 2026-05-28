import { useEffect, useState } from 'react';
import Icon from '../../shared/components/Icon.jsx';
import { fetchCoaches } from './api.js';

export default function CoachesPage() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchCoaches({ signal: ctrl.signal })
      .then((data) => { setCoaches(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div>
        <h1 className="font-heading text-headline-xl font-bold text-on-surface">Coaches</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">
          {loading ? 'Loading…' : error ? 'Could not reach the API' : `${coaches.length} coaches ready to level up your game.`}
        </p>
      </div>

      {error && (
        <div className="mt-12 rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container">
          Could not load coaches ({error.status || ''}). Try again in a moment.
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => (
          <div key={c.id} className="rounded-[14px] bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center gap-4">
              {c.avatar ? (
                <img src={c.avatar} alt={c.name} className="h-14 w-14 rounded-full object-cover" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                  <Icon name="person" size={28} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-heading text-headline-md font-semibold text-on-surface truncate">{c.name}</h3>
                <p className="text-body-md text-on-surface-variant truncate">{c.roleLabel || c.specialty || c.location}</p>
              </div>
            </div>
            {c.bio && <p className="mt-3 line-clamp-2 text-body-md text-on-surface-variant">{c.bio}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.rateFrom != null && (
                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-primary-fixed">
                  {c.priceCurrency} {c.rateFrom}+
                </span>
              )}
              {c.certifications?.slice(0, 1).map((t) => (
                <span key={t} className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-surface-variant">{t}</span>
              ))}
              {c.location && (
                <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                  <Icon name="location_on" size={12} />{c.location}
                </span>
              )}
            </div>
            {c.bookingUrl ? (
              <a href={c.bookingUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-11 items-center justify-center rounded-full bg-secondary-container text-body-md font-bold text-on-secondary-container shadow-sm no-underline">
                Book externally ↗
              </a>
            ) : c.email ? (
              <a href={`mailto:${c.email}`} className="mt-4 flex h-11 items-center justify-center rounded-full bg-secondary-container text-body-md font-bold text-on-secondary-container shadow-sm no-underline">
                Contact
              </a>
            ) : (
              <button disabled className="mt-4 h-11 w-full rounded-full bg-surface-container-high text-body-md font-bold text-on-surface-variant">No contact</button>
            )}
          </div>
        ))}
      </div>

      {!loading && !error && coaches.length === 0 && (
        <div className="mt-16 text-center text-on-surface-variant">No coaches yet.</div>
      )}
    </div>
  );
}
