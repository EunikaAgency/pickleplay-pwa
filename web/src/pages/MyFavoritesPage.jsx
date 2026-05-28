import { Link } from 'react-router-dom';

export default function MyFavoritesPage() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">Favorites</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {[
          { t:'🏟️ Venues', d:'Save your go-to courts', to:'/venues' },
          { t:'🤝 Clubs', d:'Clubs you love', to:'/clubs' },
          { t:'👤 Players', d:'Your pickle crew', to:'/players' },
        ].map(({t,d,to}) => (
          <Link key={t} to={to} className="rounded-2xl bg-white p-6 shadow-lg text-center no-underline hover:-translate-y-1 hover:shadow-xl transition-all">
            <div className="text-4xl">{t.split(' ')[0]}</div>
            <h3 className="mt-3 font-heading text-base font-bold text-on-surface">{t.split(' ')[1]}</h3>
            <p className="mt-1 text-base text-on-surface-variant">{d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
