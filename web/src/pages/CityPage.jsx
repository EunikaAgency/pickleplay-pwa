import { useParams, Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getVenues, getGames } from '../data/index.js';

export default function CityPage() {
  const { slug } = useParams();
  const cityName = slug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const venues = getVenues().filter(v => v.city.toLowerCase().includes(slug?.toLowerCase() || ''));
  const games = getGames().filter(g => g.status === 'upcoming');

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="font-heading text-headline-xl font-bold text-on-surface">Pickleball in {cityName}</h1>
      <p className="mt-2 text-body-lg text-on-surface-variant">{venues.length} venues and {games.length} upcoming games in {cityName}.</p>

      {venues.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-headline-lg font-bold text-on-surface">Venues</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map(v => (
              <Link key={v.id} to={`/venues/${v.slug}`} className="rounded-[14px] bg-surface-container-lowest shadow-card no-underline hover:shadow-fab transition-shadow overflow-hidden">
                <div className="h-36 overflow-hidden"><img src={v.heroImage} alt="" className="h-full w-full object-cover" loading="lazy" /></div>
                <div className="p-4">
                  <h3 className="font-heading text-headline-md font-semibold text-on-surface">{v.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-body-md text-on-surface-variant"><Icon name="location_on" size={14} />{v.address}</p>
                  <p className="mt-1 text-body-md"><span className="font-semibold">{v.rating}</span> <span className="text-on-surface-variant">({v.reviewCount} reviews)</span></p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
