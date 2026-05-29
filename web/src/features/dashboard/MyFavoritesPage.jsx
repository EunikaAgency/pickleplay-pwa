import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { fetchMyFavorites, removeFavorite } from './api.js';

const TYPE_META = {
  venue: { icon: 'stadium', label: 'Venue', tone: 'bg-primary-container text-on-primary-container', href: (id) => `/venues/${id}` },
  coach: { icon: 'sports', label: 'Coach', tone: 'bg-tertiary-container text-on-tertiary-container', href: () => '/coaches' },
  club: { icon: 'group', label: 'Club', tone: 'bg-secondary-container text-on-secondary-container', href: (id) => `/clubs/${id}` },
  game: { icon: 'sports_tennis', label: 'Game', tone: 'bg-surface-container-high text-on-surface', href: (id) => `/open-play/${id}` },
  player: { icon: 'person', label: 'Player', tone: 'bg-surface-container-high text-on-surface', href: () => '/' },
};

export default function MyFavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    fetchMyFavorites({ signal: ctrl.signal })
      .then((data) => { setFavorites(data); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  async function handleRemove(id) {
    setRemoving((s) => new Set(s).add(id));
    try {
      await removeFavorite(id);
      setFavorites((fs) => fs.filter((f) => f._id !== id));
    } catch (e) {
      alert(`Could not remove: ${e.message}`);
    } finally {
      setRemoving((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold text-on-surface">Favorites</h1>
        <p className="mt-1 text-on-surface-variant">
          {loading ? 'Loading…' : error ? 'Could not load favorites.' : `${favorites.length} saved`}
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-error-container/30 p-6 text-center text-on-error-container shadow-md">
          Could not load your favorites ({error.status || 'network error'}).
        </div>
      )}

      {!loading && !error && favorites.length === 0 && (
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            { t: '🏟️ Venues', d: 'Save your go-to courts', to: '/venues' },
            { t: '🏆 Coaches', d: 'Coaches you trust', to: '/coaches' },
            { t: '🤝 Clubs', d: 'Clubs you love', to: '/clubs' },
          ].map(({ t, d, to }) => (
            <Link key={t} to={to} className="rounded-2xl bg-white p-6 shadow-lg text-center no-underline hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="text-4xl">{t.split(' ')[0]}</div>
              <h3 className="mt-3 font-heading text-base font-bold text-on-surface">{t.split(' ').slice(1).join(' ')}</h3>
              <p className="mt-1 text-base text-on-surface-variant">{d}</p>
            </Link>
          ))}
        </div>
      )}

      {favorites.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map((f) => {
            const meta = TYPE_META[f.favoritableType] || TYPE_META.venue;
            const busy = removing.has(f._id);
            return (
              <div key={f._id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-md">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                  <Icon name={meta.icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">{meta.label}</p>
                  <Link to={meta.href(f.favoritableId)} className="block font-semibold text-on-surface no-underline hover:underline truncate">
                    {f.favoritableId?.slice?.(-8) || 'Item'}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(f._id)}
                  disabled={busy}
                  aria-label="Remove from favorites"
                  className="flex size-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
                >
                  <Icon name="heart_minus" size={20} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
