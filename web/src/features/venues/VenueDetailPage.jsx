import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { fetchVenueBySlug } from './api.js';

export default function VenueDetailPage() {
  const { slug } = useParams();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setVenue(null);
    fetchVenueBySlug(slug, { signal: ctrl.signal })
      .then((v) => { setVenue(v); setError(null); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [slug]);

  if (loading) {
    return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center text-on-surface-variant">Loading venue…</div>;
  }

  if (error?.status === 404 || (!loading && !venue)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl">😕</div>
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Venue not found</h1>
        <Link to="/venues" className="mt-4 font-bold text-primary no-underline hover:underline">Back to venues</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-heading text-2xl font-extrabold">Could not load venue</h1>
        <p className="mt-2 text-on-surface-variant">{error.message}</p>
        <Link to="/venues" className="mt-4 font-bold text-primary no-underline hover:underline">Back to venues</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-56 overflow-hidden md:h-72 bg-gradient-to-br from-[#0040E0] to-[#2E5BFF]">
        {venue.heroImage ? (
          <img src={venue.heroImage} alt="" className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40"><Icon name="sports_tennis" size={72} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0 px-5 mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {venue.isPartner && <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Verified</span>}
            {venue.isClaimed && <span className="rounded-full bg-[#C1F100]/80 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Claimed</span>}
            {venue.indoorOutdoor && <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-base font-extrabold uppercase text-on-surface">{venue.indoorOutdoor}</span>}
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-white">{venue.name}</h1>
          <p className="flex items-center gap-1 text-base text-white/70">
            <Icon name="location_on" size={16} />
            {venue.fullAddress || `${venue.city}${venue.region ? `, ${venue.region}` : ''}`}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {venue.rating != null && <span className="flex items-center gap-1 font-bold"><Icon name="star" size={18} filled className="text-[#2E5BFF]" />{venue.rating}</span>}
          <span className="text-base text-on-surface-variant">
            {venue.reviewCount ? `(${venue.reviewCount} reviews) · ` : ''}{venue.courtCount} courts{venue.surface ? ` · ${venue.surface}` : ''}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {(venue.description || venue.summary) && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="font-heading text-xl font-bold">About</h2>
                <p className="mt-3 text-base leading-relaxed text-on-surface-variant whitespace-pre-line">{venue.description || venue.summary}</p>
              </div>
            )}

            {venue.gallery?.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="font-heading text-xl font-bold">Gallery</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {venue.gallery.map((src, i) => (
                    <img key={i} src={src} alt="" className="aspect-video w-full rounded-xl object-cover"
                      onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {venue.amenities?.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h3 className="font-heading text-base font-bold">Amenities</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {venue.amenities.map(a => <span key={a} className="rounded-full bg-surface-container-high px-3 py-1 text-base font-extrabold uppercase">{a}</span>)}
                </div>
              </div>
            )}

            {venue.priceFrom != null && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h3 className="font-heading text-base font-bold">Pricing</h3>
                <p className="mt-2">
                  <span className="text-2xl font-extrabold">{venue.pricingCurrency} {venue.priceFrom}</span>
                  <span className="text-base text-on-surface-variant"> and up</span>
                </p>
              </div>
            )}

            {(venue.phone || venue.email || venue.website) && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h3 className="font-heading text-base font-bold">Contact</h3>
                <div className="mt-3 space-y-2 text-base">
                  {venue.phone && <a href={`tel:${venue.phone}`} className="flex items-center gap-2 text-primary no-underline hover:underline"><Icon name="call" size={16} />{venue.phone}</a>}
                  {venue.email && <a href={`mailto:${venue.email}`} className="flex items-center gap-2 text-primary no-underline hover:underline"><Icon name="mail" size={16} />{venue.email}</a>}
                  {venue.website && <a href={venue.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary no-underline hover:underline"><Icon name="public" size={16} />Website</a>}
                </div>
              </div>
            )}

            {venue.bookingUrl ? (
              <a href={venue.bookingUrl} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">
                Book externally ↗
              </a>
            ) : (
              <Link to={`/venues/${venue.slug}/book`} className="flex h-14 items-center justify-center rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">
                Inquire about booking
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
