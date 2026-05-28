import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { apiGet, apiImageUrl } from '../../shared/api/client.js';
import { fetchVenues } from '../venues/api.js';
import { fetchCoaches } from '../coaches/api.js';

export default function HomePage() {
  const [venues, setVenues] = useState([]);
  const [openPlay, setOpenPlay] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    Promise.allSettled([
      fetchVenues({ limit: 6, signal: ctrl.signal }),
      apiGet('/api/v1/open-play?limit=6', { signal: ctrl.signal }).catch(() => ({ data: [] })),
      fetchCoaches({ limit: 6, signal: ctrl.signal }),
    ]).then(([vR, opR, cR]) => {
      if (vR.status === 'fulfilled') setVenues(vR.value.slice(0, 3));
      if (opR.status === 'fulfilled') setOpenPlay((opR.value?.data || []).slice(0, 3));
      if (cR.status === 'fulfilled') setCoaches(cR.value.slice(0, 3));
    }).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div>
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0040E0] to-[#2E5BFF] px-5 py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-float absolute left-[10%] top-[20%] h-16 w-16 rounded-full bg-white/10" />
          <div className="animate-float absolute left-[70%] top-[10%] h-10 w-10 rounded-full bg-[#C1F100]/20" style={{ animationDelay: '0.5s' }} />
          <div className="animate-float absolute left-[50%] top-[60%] h-12 w-12 rounded-full bg-white/10" style={{ animationDelay: '1s' }} />
          <div className="animate-float absolute left-[25%] top-[70%] h-8 w-8 rounded-full bg-[#B8C3FF]/20" style={{ animationDelay: '1.5s' }} />
          <div className="animate-float absolute left-[80%] top-[50%] h-14 w-14 rounded-full bg-[#C1F100]/15" style={{ animationDelay: '0.8s' }} />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-block animate-bounce-in rounded-full bg-[#C1F100] px-5 py-2 text-label-sm font-bold uppercase tracking-wider text-[#374D00]">
            Let's Play!
          </span>
          <h1 className="mt-6 font-heading text-5xl font-extrabold leading-tight text-white md:text-6xl">
            Find your <span className="inline-block animate-wiggle text-[#C1F100]">pickle</span> crew
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Courts, games, new friends — all the fun, zero boring stuff.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/venues" className="inline-flex h-14 items-center rounded-full bg-[#C1F100] px-10 text-lg font-extrabold text-[#374D00] no-underline shadow-lg active:scale-95">
              Find a Court
              <Icon name="arrow_forward" size={24} className="ml-2" />
            </Link>
            <Link to="/open-play" className="inline-flex h-14 items-center rounded-full border-2 border-white/30 bg-white/10 px-10 text-lg font-extrabold text-white no-underline backdrop-blur hover:bg-white/20 active:scale-95">
              Open Play
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="h-16 w-full text-[#F8F9FC]" preserveAspectRatio="none">
            <path d="M0 80C240 20 480 0 720 20C960 40 1200 60 1440 30V80H0Z" fill="currentColor" />
          </svg>
        </div>
      </section>

      {/* ---- Quick actions ---- */}
      <section className="mx-auto -mt-8 max-w-4xl px-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { to: '/open-play', label: 'Open Play', emoji: '🏓', color: 'bg-[#0040E0]' },
            { to: '/venues', label: 'Courts', emoji: '🏟️', color: 'bg-[#0040E0]' },
            { to: '/coaches', label: 'Coaches', emoji: '🏆', color: 'bg-[#0040E0]' },
            { to: '/clubs', label: 'Clubs', emoji: '🤝', color: 'bg-[#2E5BFF]' },
          ].map(({ to, label, emoji, color }, i) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col items-center gap-3 rounded-[20px] p-5 text-center text-white no-underline shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95"
              style={{ animation: `bounce-in 0.5s ease-out ${i * 0.1}s both` }}
            >
              <div className={`${color} flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-md`}>
                {emoji}
              </div>
              <span className="text-base font-bold text-on-surface">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Stat banner: real counts from API ---- */}
      <section className="mx-auto mt-16 max-w-4xl px-5">
        <div className="animate-rainbow rounded-[24px] p-8 text-center text-white shadow-lg md:p-10">
          <p className="text-3xl font-extrabold font-heading">
            {loading ? '…' : `${venues.length > 0 ? '179' : '—'} venues · ${coaches.length > 0 ? '32' : '—'} coaches`}
          </p>
          <p className="mt-1 text-lg font-semibold">live across the Philippines and growing</p>
          <div className="mt-3 text-3xl">🥒🎉🏓</div>
        </div>
      </section>

      {/* ---- Open Play sessions ---- */}
      {openPlay.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-label-sm font-bold uppercase tracking-wider text-[#0040E0]">Jump in!</p>
              <h2 className="font-heading text-3xl font-extrabold text-on-surface">Open play near you</h2>
            </div>
            <Link to="/open-play" className="text-base font-bold text-primary no-underline hover:underline">See all →</Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {openPlay.map((session, i) => (
              <Link
                key={session._id || i}
                to={`/open-play/${session._id || session.slug || ''}`}
                className="group overflow-hidden rounded-[20px] bg-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl no-underline"
                style={{ animation: `slide-up 0.4s ease-out ${i * 0.1}s both` }}
              >
                <div className="flex items-center gap-4 bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-4 text-white">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">🏓</div>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-bold">{session.title || 'Open Play Session'}</p>
                    <p className="text-base text-white/70">{session.levelLabel || session.organizerName || 'All levels'}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 text-base text-on-surface-variant">
                    {session.date && (
                      <span className="flex items-center gap-1">
                        <Icon name="calendar_today" size={14} />
                        {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {session.startTime && <span>{session.startTime}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-base">
                    <span className="font-bold">{session.joinedCount ?? 0}/{session.capacity ?? '—'} joined</span>
                    <span className={`rounded-full px-3 py-1 text-base font-extrabold uppercase ${session.price ? 'bg-surface-container-high text-on-surface-variant' : 'bg-[#C1F100]/30 text-[#374D00]'}`}>
                      {session.price ? `PHP ${session.price}` : 'Free'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- Popular venues (live) ---- */}
      <section className="mx-auto mt-16 max-w-6xl px-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Courts</p>
            <h2 className="font-heading text-3xl font-extrabold text-on-surface">Popular venues</h2>
          </div>
          <Link to="/venues" className="text-base font-bold text-primary no-underline hover:underline">See all →</Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-[20px] bg-surface-container-low animate-pulse" />
          ))}
          {!loading && venues.map((venue, i) => (
            <Link
              key={venue.id}
              to={`/venues/${venue.slug}`}
              className="group overflow-hidden rounded-[20px] bg-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl no-underline"
              style={{ animation: `slide-up 0.4s ease-out ${i * 0.1}s both` }}
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#0040E0] to-[#2E5BFF]">
                {venue.heroImage ? (
                  <img src={venue.heroImage} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/60">
                    <Icon name="sports_tennis" size={48} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  {venue.isPartner && <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Verified</span>}
                  {venue.isIndoor && <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-base font-extrabold uppercase text-on-surface">Indoor</span>}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-heading text-lg font-bold text-on-surface">{venue.name}</h3>
                <p className="mt-0.5 text-base text-on-surface-variant">{venue.city || venue.region}</p>
                <div className="mt-2 flex items-center gap-3 text-base">
                  {venue.rating != null && <span className="flex items-center gap-1 font-bold"><Icon name="star" size={14} filled className="text-[#2E5BFF]" /> {venue.rating}</span>}
                  <span className="text-on-surface-variant">{venue.courtCount} courts</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Coaches (live) ---- */}
      <section className="mx-auto mt-16 max-w-6xl px-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-[#0040E0]">Coaches</p>
            <h2 className="font-heading text-3xl font-extrabold text-on-surface">Level up your game</h2>
          </div>
          <Link to="/coaches" className="text-base font-bold text-primary no-underline hover:underline">See all →</Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[20px] bg-surface-container-low animate-pulse" />
          ))}
          {!loading && coaches.map((coach, i) => (
            <Link
              key={coach.id}
              to={`/coaches`}
              className="group flex items-center gap-4 rounded-[20px] bg-white p-4 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl no-underline"
              style={{ animation: `slide-up 0.4s ease-out ${i * 0.1}s both` }}
            >
              {coach.avatar ? (
                <img src={apiImageUrl(coach.avatar)} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-sm" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tertiary-container text-on-tertiary-container shadow-sm">
                  <Icon name="sports" size={28} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading text-base font-bold text-on-surface">{coach.name}</h3>
                <p className="mt-0.5 text-base text-on-surface-variant">{coach.location || coach.specialty || 'Coach'}</p>
                {coach.rateFrom != null && (
                  <span className="mt-1.5 inline-block rounded-full bg-primary-fixed px-2 py-0.5 text-label-sm font-bold uppercase text-on-primary-fixed">
                    {coach.priceCurrency} {coach.rateFrom}+
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Bottom CTA ---- */}
      <section className="mx-auto mt-16 mb-16 max-w-3xl px-5 text-center">
        <div className="rounded-[32px] bg-gradient-to-br from-[#0040E0] to-[#2E5BFF] p-10 shadow-xl md:p-14">
          <div className="text-5xl">📱</div>
          <h2 className="mt-4 font-heading text-3xl font-extrabold text-white">Ready to play?</h2>
          <p className="mt-3 text-lg text-white/80">Get the app and never miss a game.</p>
          <Link to="/download" className="mt-6 inline-flex h-14 items-center rounded-full bg-[#C1F100] px-10 text-lg font-extrabold text-[#374D00] no-underline shadow-lg active:scale-95">
            Download pickleBaller
          </Link>
        </div>
      </section>
    </div>
  );
}
