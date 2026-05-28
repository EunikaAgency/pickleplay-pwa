import { useParams, Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getVenue, getCourts, getGamesByVenue } from '../data/index.js';

export default function VenueDetailPage() {
  const { slug } = useParams();
  const venue = getVenue(slug);
  if (!venue) return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center"><div className="text-5xl">😕</div><h1 className="mt-4 font-heading text-3xl font-extrabold">Venue not found</h1><Link to="/venues" className="mt-4 font-bold text-primary no-underline hover:underline">Back to venues</Link></div>;

  const courts = getCourts(venue.id);
  const games = getGamesByVenue(venue.id);

  return (
    <div>
      <div className="relative h-56 overflow-hidden md:h-72">
        <img src={venue.heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0 px-5 mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {venue.isPartner && <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Partner</span>}
            {venue.isClaimed && <span className="rounded-full bg-[#C1F100]/80 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Claimed</span>}
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-base font-extrabold uppercase text-on-surface">{venue.accessType}</span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-white">{venue.name}</h1>
          <p className="flex items-center gap-1 text-base text-white/70"><Icon name="location_on" size={16} />{venue.address}, {venue.city}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="flex items-center gap-1 font-bold"><Icon name="star" size={18} filled className="text-[#2E5BFF]" />{venue.rating}</span>
          <span className="text-base text-on-surface-variant">({venue.reviewCount} reviews) · {venue.courtCount} courts · {venue.surface}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">About</h2>
              <p className="mt-3 text-base leading-relaxed text-on-surface-variant">{venue.description}</p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">Courts ({courts.length})</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {courts.map(c => (
                  <div key={c.id} className="rounded-2xl border-2 border-surface-variant p-4">
                    <div className="flex items-center justify-between"><h3 className="font-heading text-base font-bold">{c.name}</h3>
                      {c.status === 'maintenance' && <span className="rounded-full bg-error-container px-2.5 py-0.5 text-base font-extrabold uppercase text-on-error-container">Down</span>}
                    </div>
                    <p className="mt-1 text-base text-on-surface-variant">{c.surface}{c.isIndoor ? ' · Indoor' : ''} · <span className="font-bold">${c.pricePerHour}/hr</span></p>
                  </div>
                ))}
              </div>
            </div>

            {games.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="font-heading text-xl font-bold">Games here ({games.length})</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {games.slice(0,4).map(g => (
                    <Link key={g.id} to={`/open-play/${g.id}`} className="rounded-2xl border-2 border-surface-variant p-4 no-underline transition-all hover:shadow-md hover:border-primary/20">
                      <span className="rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">{g.eventType}</span>
                      <h3 className="mt-2 font-heading text-base font-bold text-on-surface">{g.title}</h3>
                      <p className="mt-1 text-base text-on-surface-variant">{new Date(g.gameDate).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {g.startTime} · {g.participantCount}/{g.playerLimit}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Hours</h3>
              <div className="mt-3 space-y-2 text-base"><div className="flex justify-between"><span className="text-on-surface-variant">Weekdays</span><span className="font-bold">{venue.hours.weekday}</span></div><div className="flex justify-between"><span className="text-on-surface-variant">Weekends</span><span className="font-bold">{venue.hours.weekend}</span></div></div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Amenities</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">{venue.amenities.map(a => <span key={a} className="rounded-full bg-surface-container-high px-3 py-1 text-base font-extrabold uppercase">{a}</span>)}</div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Pricing</h3>
              <p className="mt-2"><span className="text-2xl font-extrabold">${venue.pricePerHour}</span><span className="text-base text-on-surface-variant"> / hr</span></p>
            </div>
            <Link to={`/venues/${venue.slug}/book`} className="flex h-14 items-center justify-center rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">
              Book a Court 🎉
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
