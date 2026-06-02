import { useState, useEffect } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { getVenue, ApiError, type ApiVenueDetail } from '../../shared/lib/api';
import { indoorLabel, priceLabel, locationLine, venueAmenities, mapsUrl, venueImage } from '../../shared/lib/venueDisplay';

interface CourtDetailsScreenProps {
  courtId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const HERO_GRADIENT = 'linear-gradient(135deg,#4d6dff 0%,#0040e0 60%,#0035be 100%)';

export function CourtDetailsScreen({ courtId, onNavigate, onBack }: CourtDetailsScreenProps) {
  const [venue, setVenue] = useState<ApiVenueDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');

  // Fetch on mount (re-runs if courtId changes); state is only committed in the
  // async callbacks and skipped if the screen unmounted mid-flight.
  useEffect(() => {
    let cancelled = false;
    getVenue(courtId)
      .then((v) => {
        if (cancelled) return;
        setVenue(v);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  const retry = () => {
    setStatus('loading');
    getVenue(courtId)
      .then((v) => {
        setVenue(v);
        setStatus('ready');
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? 'notfound' : 'error');
      });
  };

  const loadingUI = (
    <div className="scroll safe-top safe-bottom px-4">
      <LoadingSkeleton variant="block" count={1} />
      <div className="mt-3">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    </div>
  );
  const errorUI = (
    <div className="scroll safe-top safe-bottom">
      <ErrorState
        title="Couldn't load this court"
        message="We couldn't reach the court directory. Try again in a moment."
        onRetry={retry}
      />
    </div>
  );
  const notFoundUI = (
    <div className="scroll safe-top safe-bottom">
      <EmptyState
        icon="location"
        title="Court not found"
        description="This court may have been removed. Try a different court nearby."
        action={{ label: 'Find another court', onPress: () => onNavigate('nearby') }}
      />
    </div>
  );

  // Real fetch state takes priority; DemoBranch only overrides for reviewer modes.
  const realState =
    status === 'loading' ? loadingUI : status === 'error' ? errorUI : status === 'notfound' ? notFoundUI : null;

  return (
    <DemoBranch loading={loadingUI} error={errorUI} empty={notFoundUI}>
      {realState ?? (venue && <CourtDetail venue={venue} onNavigate={onNavigate} onBack={onBack} />)}
    </DemoBranch>
  );
}

function CourtDetail({
  venue,
  onNavigate,
  onBack,
}: {
  venue: ApiVenueDetail;
  onNavigate: Navigate;
  onBack: () => void;
}) {
  const heroImage = venueImage(venue);
  const io = indoorLabel(venue);
  const courtsTotal = venue.courts?.length || venue.courtCount || 0;
  const price = priceLabel(venue);
  const location = locationLine(venue);
  const amenities = venueAmenities(venue);
  const about = venue.description || venue.oneLineSummary || '';

  const todayHours = venue.hours?.[DAY_KEYS[new Date().getDay()]];

  const tags = [io, courtsTotal ? `${courtsTotal} courts` : null, price].filter(Boolean) as string[];

  return (
    <div className="scroll pb-[30px]">
      <div className="detail-hero">
        <div
          className="img"
          style={heroImage ? { background: `url(${heroImage}) center/cover` } : { background: HERO_GRADIENT }}
        />
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2">
            <button className="icon-btn" aria-label="Share">
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" aria-label="Save">
              <Icon name="heart_o" size={16} />
            </button>
          </div>
        </div>
        <div className="info">
          {tags.length > 0 && (
            <div className="tag-row">
              {tags.map((t, i) => (
                <span key={t} className={`tag ${i === 0 ? 'lime' : ''}`}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <h1>{venue.displayName}</h1>
          {(venue.googleRating != null || location || venue.fullAddress) && (
            <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
              {venue.googleRating != null && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="star" size={14} /> {venue.googleRating}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Icon name="location" size={14} /> {location || venue.fullAddress}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="detail-body">
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Courts</div>
            <div className="val">{courtsTotal || '—'}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Surface</div>
            <div className="val capitalize">{venue.surfaceType || '—'}</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Today</div>
            <div className={`val ${todayHours && todayHours !== 'Closed' ? 'lime' : ''}`}>{todayHours || '—'}</div>
          </div>
        </div>

        <div className="location-card">
          <div className="map-preview">
            <div className="pin">
              <Icon name="location" size={16} />
            </div>
          </div>
          <div className="map-info">
            <div className="text">
              <div className="name">{venue.displayName}</div>
              <div className="addr">{venue.fullAddress || location || '—'}</div>
            </div>
            <button
              className="directions"
              aria-label="Get directions"
              onClick={() => window.open(mapsUrl(venue), '_blank')}
            >
              <Icon name="directions" size={18} />
            </button>
          </div>
        </div>

        {about && (
          <div className="about-card">
            <div className="t-eyebrow mb-1.5">About this venue</div>
            <p>{about}</p>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="section mt-0! p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Amenities</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-3 py-2.5 text-[13px] text-[var(--ink-2)] font-semibold"
                >
                  <span className="w-[22px] h-[22px] rounded-lg bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="check" size={12} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games this week — still demo content; the games feature isn't wired to the API yet. */}
        <div className="section p-0!">
          <div className="section-head px-0">
            <div>
              <div className="t-eyebrow">Games this week</div>
              <div className="hd-2 mt-1">Drop in or RSVP</div>
            </div>
            <button className="more" onClick={() => onNavigate('games')}>All</button>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { day: 'TOM', num: '14', title: 'Morning Doubles Mixer', time: '9:00 AM', loc: '4 spots left' },
              { day: 'SAT', num: '15', title: 'Saturday Mix-In',        time: '9:00 AM', loc: '8 spots left' },
              { day: 'SUN', num: '16', title: 'Beginner Clinic',        time: '2:00 PM', loc: '2 spots left' },
            ].map((g) => (
              <button
                key={g.title}
                className="game-row"
                onClick={() => onNavigate('game-details', { id: '1' })}
              >
                <div className="thumb lime">
                  <span className="day">{g.day}</span>
                  <span className="num">{g.num}</span>
                </div>
                <div className="body">
                  <div className="title">{g.title}</div>
                  <div className="meta">
                    <span className="m"><Icon name="clock" size={11} />{g.time}</span>
                    <span className="m"><Icon name="paddle" size={11} />{g.loc}</span>
                  </div>
                </div>
                <div className="rsvp bg-[var(--primary-tint)]! text-[var(--primary)]! shadow-none!">
                  <Icon name="chevron" size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
