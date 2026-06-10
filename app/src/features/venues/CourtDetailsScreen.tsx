import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { getVenue, listGames, ApiError, type ApiVenueDetail, type ApiGame } from '../../shared/lib/api';
import { indoorLabel, priceLabel, locationLine, venueAmenities, mapsUrl, venueImage, venueCoords } from '../../shared/lib/venueDisplay';

interface CourtDetailsScreenProps {
  courtId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const HERO_GRADIENT = 'linear-gradient(135deg,#4d6dff 0%,#0040e0 60%,#0035be 100%)';

// Leaflet's default marker asset paths break under bundlers, so point them at the
// CDN copies (same approach as NearbyScreen's map).
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// --- Small game-row formatters (kept local; the venues slice must not import the
// games slice's gameDisplay.ts — cross-feature code only travels via shared/). ---

/** The date "thumb" (e.g. SAT / 15) from a game's date, falling back to its label. */
function gameThumb(g: ApiGame): { day: string; num: string } {
  if (g.date) {
    const d = new Date(`${g.date}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), num: String(d.getDate()) };
    }
  }
  return { day: (g.whenLabel || 'TBD').slice(0, 3).toUpperCase(), num: '' };
}

function gameTitle(g: ApiGame): string {
  if (g.title && g.title.trim()) return g.title.trim();
  if (g.gameType) return `${g.gameType[0].toUpperCase()}${g.gameType.slice(1)} game`;
  return 'Pickleball game';
}

function gameSpots(g: ApiGame): string {
  if (g.spotsLeft != null) return `${g.spotsLeft} spot${g.spotsLeft === 1 ? '' : 's'} left`;
  return g.skillLabel || g.durationLabel || '';
}

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
  const coords = venueCoords(venue);

  const todayHours = venue.hours?.[DAY_KEYS[new Date().getDay()]];

  const tags = [io, courtsTotal ? `${courtsTotal} courts` : null, price].filter(Boolean) as string[];

  // Real games hosted at this venue (published = joinable). Read-only surface of
  // already-public game browse, so no new permission gates it.
  const [games, setGames] = useState<ApiGame[]>([]);
  const [gamesStatus, setGamesStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setGamesStatus('loading');
    listGames({ venueId: venue.id })
      .then((list) => {
        if (cancelled) return;
        setGames(list.slice(0, 4));
        setGamesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setGamesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [venue.id]);

  return (
    <div className="scroll pb-[110px]">
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
          {coords ? (
            <div className="h-[140px] relative">
              <MapContainer
                center={coords}
                zoom={15}
                className="w-full h-full"
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                keyboard={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={coords} icon={markerIcon} />
              </MapContainer>
            </div>
          ) : (
            <div className="map-preview">
              <div className="pin">
                <Icon name="location" size={16} />
              </div>
            </div>
          )}
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

        {/* Games hosted at this venue — live from the games API (published = joinable). */}
        <div className="section p-0!">
          <div className="section-head px-0">
            <div>
              <div className="t-eyebrow">Games here</div>
              <div className="hd-2 mt-1">Drop in or RSVP</div>
            </div>
            {games.length > 0 && (
              <button className="more" onClick={() => onNavigate('games')}>All</button>
            )}
          </div>
          {gamesStatus === 'loading' ? (
            <LoadingSkeleton variant="card" count={2} />
          ) : gamesStatus === 'error' ? (
            <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-5 text-center">
              Couldn't load games for this court.
            </div>
          ) : games.length === 0 ? (
            <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-5 text-center">
              No games scheduled here yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {games.map((g) => {
                const thumb = gameThumb(g);
                const time = g.timeLabel || g.whenLabel || '';
                const spots = gameSpots(g);
                return (
                  <button
                    key={g.id}
                    className="game-row"
                    onClick={() => onNavigate('game-details', { id: g.id })}
                  >
                    <div className="thumb lime">
                      <span className="day">{thumb.day}</span>
                      {thumb.num && <span className="num">{thumb.num}</span>}
                    </div>
                    <div className="body">
                      <div className="title">{gameTitle(g)}</div>
                      <div className="meta">
                        {time && <span className="m"><Icon name="clock" size={11} />{time}</span>}
                        {spots && <span className="m"><Icon name="paddle" size={11} />{spots}</span>}
                      </div>
                    </div>
                    <div className="rsvp bg-[var(--primary-tint)]! text-[var(--primary)]! shadow-none!">
                      <Icon name="chevron" size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="app-action-bar">
        {price ? (
          <Button fullWidth onClick={() => onNavigate('book-court', { venueId: venue.id })}>
            <Icon name="calendar" size={16} /> Book this court
          </Button>
        ) : (
          <>
            <Button fullWidth variant="outline" disabled>
              <Icon name="lock" size={16} /> Booking unavailable
            </Button>
            <div className="text-[12px] text-[var(--muted)] font-semibold mt-2 text-center">
              No rates listed for this court yet.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
