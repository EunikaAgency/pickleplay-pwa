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
import { apiImageUrl, getVenue, listGames, ApiError, type ApiVenueDetail, type ApiGame } from '../../shared/lib/api';
import {
  indoorLabel, priceRangeLabel, currencySymbol, locationLine, venueAmenities,
  mapsUrl, venueImage, venueCoords,
} from '../../shared/lib/venueDisplay';
import { useVenueAvailability } from '../../shared/hooks/useVenueAvailability';
import { getCurrentLocation, haversineKm, formatDistance } from '../../shared/lib/geo';

interface CourtDetailsScreenProps {
  courtId: string;
  /** 'lobby' = booking this court should hand back to create-game afterwards. */
  intent?: 'lobby';
  onNavigate: Navigate;
  onBack: () => void;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// Display order for the weekly hours card (week starts Monday, reads naturally).
const WEEK: { key: string; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];
const HERO_GRADIENT = 'linear-gradient(135deg,#4d6dff 0%,#0040e0 60%,#0035be 100%)';
const SAVED_KEY = 'pb-saved-venues';

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

// --- Schedule / availability helpers (self-contained) ---

/** Local YYYY-MM-DD for "today" (matches how the API stores/compares dates). */
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2:00 PM" — the 12h label the Book screen's time prefill expects (to24h-parseable). */
function timeParam(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${ampm}`;
}

/** "2 PM" — a compact chip label for an open hour. */
function hourCompact(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

/** Parse a "06:00 - 22:00" hours string into the bookable start-hour window. */
function parseDayRange(s?: string): { open: number; lastStart: number } | null {
  if (!s || /closed/i.test(s)) return null;
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = Number(m[1]);
  const closeH = Number(m[3]);
  const closeM = Number(m[4]);
  // A booking starting at `lastStart` ends within the closing time.
  const lastStart = closeM > 0 ? closeH : closeH - 1;
  if (lastStart < open) return null; // overnight/odd ranges fall back to the Book flow
  return { open, lastStart };
}

/** "24 hours" → "1 day"; otherwise "N hours" (matches the API's wording). */
function payWindowLabel(hours?: number | null): string {
  const h = hours ?? 24;
  return h % 24 === 0 ? `${h / 24} day${h / 24 === 1 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`;
}

function readSavedVenues(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function CourtDetailsScreen({ courtId, intent, onNavigate, onBack }: CourtDetailsScreenProps) {
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
      {realState ?? (venue && <CourtDetail venue={venue} intent={intent} onNavigate={onNavigate} onBack={onBack} />)}
    </DemoBranch>
  );
}

function CourtDetail({
  venue,
  intent,
  onNavigate,
  onBack,
}: {
  venue: ApiVenueDetail;
  intent?: 'lobby';
  onNavigate: Navigate;
  onBack: () => void;
}) {
  const heroImage = venueImage(venue);
  const io = indoorLabel(venue);
  const courts = venue.courts ?? [];
  const courtsTotal = courts.length || venue.courtCount || 0;
  const price = priceRangeLabel(venue, courts);
  const location = locationLine(venue);
  const amenities = venueAmenities(venue);
  const about = venue.description || venue.oneLineSummary || '';
  // Platform-curated highlights — derived server-side from real venue data +
  // editorial, not owner-typed claims (see api computeVenueHighlights).
  const highlights = venue.curatedHighlights ?? { bestFor: [], whatPlayersLike: [] };
  const hasHighlights = highlights.bestFor.length > 0 || highlights.whatPlayersLike.length > 0;
  const coords = venueCoords(venue);
  const sym = currencySymbol(venue.pricingCurrency);

  const requireApproval = !!venue.requireBookingApproval;
  const reviewCount = venue.googleReviewCount ?? null;

  const todayKey = DAY_KEYS[new Date().getDay()];
  const todayHours = venue.hours?.[todayKey];
  const hasHours = !!venue.hours && Object.keys(venue.hours).length > 0;

  // Gallery photos (resolved to absolute URLs, junk dropped). The hero already
  // shows the primary, so drop it from the strip to avoid showing it twice.
  const gallery = (venue.gallery ?? []).map((u) => apiImageUrl(u)).filter(Boolean);
  const galleryStrip = heroImage ? gallery.filter((u) => u !== heroImage) : gallery;
  const showGallery = galleryStrip.length > 0;

  const tags = [io, courtsTotal ? `${courtsTotal} courts` : null, price].filter(Boolean) as string[];

  // Saved (device-local favourite) + share state.
  const [saved, setSaved] = useState(() => readSavedVenues().includes(venue.id));
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  // Best-effort distance: if the device already granted location (or grants it
  // now), show how far the venue is. Silent on denial — it's a nicety.
  useEffect(() => {
    if (!coords) return;
    let alive = true;
    getCurrentLocation()
      .then((me) => { if (alive) setDistanceKm(haversineKm(me, coords)); })
      .catch(() => { /* no location — just omit the distance */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  const toggleSave = () => {
    const cur = readSavedVenues();
    const next = cur.includes(venue.id) ? cur.filter((x) => x !== venue.id) : [...cur, venue.id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(venue.id));
  };

  const share = async () => {
    const url = `${window.location.origin}/venues/${venue.slug || venue.id}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: venue.displayName, text: `Check out ${venue.displayName} on PickleBallers`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied');
      setTimeout(() => setShareMsg(null), 2000);
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  };

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

  // Today's open slots (live free-court count, bounded by opening hours).
  const today = localToday();
  const avail = useVenueAvailability(venue.id, today);
  const todayClosed = !!todayHours && /closed/i.test(todayHours);
  const range = parseDayRange(todayHours);
  const freeHours: number[] = [];
  if (range) {
    for (let h = Math.max(range.open, avail.minBookableHour); h <= range.lastStart; h++) {
      if (!avail.startDisabled(h)) freeHours.push(h);
    }
  }
  const SLOT_CAP = 12;
  const slotChips = freeHours.slice(0, SLOT_CAP);

  const ctaLabel = intent === 'lobby'
    ? 'Book & set up lobby'
    : requireApproval ? 'Request to book' : 'Book this court';

  return (
    <div className="scroll pb-[130px]">
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
          <div className="flex gap-2 items-center">
            {shareMsg && (
              <span className="text-[11px] font-bold text-white bg-black/55 rounded-full px-2.5 py-1">{shareMsg}</span>
            )}
            <button className="icon-btn" aria-label="Share this court" onClick={share}>
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" aria-label={saved ? 'Remove from saved' : 'Save this court'} aria-pressed={saved} onClick={toggleSave}>
              <Icon name={saved ? 'heart' : 'heart_o'} size={16} className={saved ? 'text-[var(--coral)]' : ''} />
            </button>
          </div>
        </div>
        <div className="info">
          {(tags.length > 0 || venue.isVerified) && (
            <div className="tag-row">
              {tags.map((t, i) => (
                <span key={t} className={`tag ${i === 0 ? 'lime' : ''}`}>
                  {t}
                </span>
              ))}
              {venue.isVerified && (
                <span className="tag inline-flex items-center gap-1">
                  <Icon name="verified" size={11} /> Verified
                </span>
              )}
            </div>
          )}
          <h1>{venue.displayName}</h1>
          {(venue.googleRating != null || location || venue.fullAddress) && (
            <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
              {venue.googleRating != null && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="star" size={14} /> {venue.googleRating}
                  {reviewCount != null && reviewCount > 0 && ` · ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}
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
            <div className="eyebrow">Price</div>
            <div className="val">{price || '—'}</div>
            {(venue as any).pricingTaxLabel && <div className="t-sm mt-0.5 text-[var(--muted)]">{(venue as any).pricingTaxLabel}</div>}
            {venue.openPlayPrice != null && Number(venue.openPlayPrice) > 0 && (
              <div className="t-sm mt-1 font-semibold text-[var(--lime-ink,var(--muted))]">Open play: {sym}{Number(venue.openPlayPrice)}/session</div>
            )}
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

        {/* Photos — the rest of the venue's gallery beyond the hero. */}
        {showGallery && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Photos</div>
            </div>
            <div className="scroll-x flex gap-2.5 -mx-1 px-1">
              {galleryStrip.map((src, i) => (
                <button
                  key={src + i}
                  className="shrink-0 w-[180px] h-[120px] rounded-[16px] overflow-hidden border-[0.5px] border-[var(--hairline)] active:scale-[0.98] transition-transform"
                  style={{ background: `url(${src}) center/cover` }}
                  aria-label={`Photo ${i + 1} of ${venue.displayName}`}
                  onClick={() => window.open(src, '_blank')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Open today — live availability, only on a bookable venue. */}
        {price && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div>
                <div className="t-eyebrow">Availability</div>
                <div className="hd-2 mt-1">Open today</div>
              </div>
              <button className="more" onClick={() => onNavigate('book-court', { venueId: venue.id, intent })}>
                Pick a date
              </button>
            </div>
            {todayClosed ? (
              <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-4 text-center">
                Closed today — pick another day to book.
              </div>
            ) : !range ? (
              <Button fullWidth variant="outline" onClick={() => onNavigate('book-court', { venueId: venue.id, intent })}>
                <Icon name="clock" size={15} /> See available times
              </Button>
            ) : slotChips.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {slotChips.map((h) => (
                    <button
                      key={h}
                      className="chip"
                      onClick={() => onNavigate('book-court', { venueId: venue.id, date: today, time: timeParam(h), intent })}
                    >
                      {hourCompact(h)}
                    </button>
                  ))}
                  {freeHours.length > SLOT_CAP && (
                    <button className="chip" onClick={() => onNavigate('book-court', { venueId: venue.id, date: today, intent })}>
                      +{freeHours.length - SLOT_CAP} more
                    </button>
                  )}
                </div>
                <div className="text-[12px] text-[var(--muted)] font-semibold mt-2.5">
                  Tap a time to book it{avail.availability == null ? ' · checking live availability…' : ''}.
                </div>
              </>
            ) : (
              <div className="text-[13px] text-[var(--muted)] font-semibold bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-4 text-center">
                No open slots left today — try another day.
              </div>
            )}
          </div>
        )}

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
              {distanceKm != null && (
                <div className="addr inline-flex items-center gap-1 text-[var(--primary)]! font-bold">
                  <Icon name="navigate" size={12} /> {formatDistance(distanceKm)} away
                </div>
              )}
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

        {/* Highlights — platform-curated from real data + editorial, not owner claims. */}
        {hasHighlights && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Highlights</div>
            </div>
            {highlights.bestFor.length > 0 && (
              <div className="mb-3">
                <div className="t-eyebrow mb-1.5">Best for</div>
                <div className="flex flex-wrap gap-2">
                  {highlights.bestFor.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] px-3 py-1.5 text-[12.5px] font-semibold"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {highlights.whatPlayersLike.length > 0 && (
              <div>
                <div className="t-eyebrow mb-1.5">What players like</div>
                <div className="flex flex-wrap gap-2">
                  {highlights.whatPlayersLike.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink-2)] px-3 py-1.5 text-[12.5px] font-semibold"
                    >
                      <Icon name="check" size={12} className="text-[var(--lime-ink)]" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full weekly hours — collapsed to today, expandable. */}
        {hasHours && (
          <div className="section p-0!">
            <button
              className="section-head px-0 w-full"
              onClick={() => setHoursOpen((v) => !v)}
              aria-expanded={hoursOpen}
            >
              <div className="hd-2">Hours</div>
              <span className="more inline-flex items-center gap-1">
                {hoursOpen ? 'Hide' : 'All hours'}
                <Icon name="chevron" size={14} className={hoursOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
              </span>
            </button>
            <div className="bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] divide-y divide-[var(--hairline)]">
              {WEEK.filter((d) => hoursOpen || d.key === todayKey).map((d) => {
                const val = venue.hours?.[d.key];
                const isToday = d.key === todayKey;
                const closed = !val || /closed/i.test(val);
                return (
                  <div key={d.key} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                    <span className={`font-semibold ${isToday ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}>
                      {d.label}{isToday ? ' · Today' : ''}
                    </span>
                    <span className={`font-bold ${closed ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                      {val && !closed ? val : 'Closed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {amenities.length > 0 && (
          <div className="section p-0!">
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

        {/* Per-court breakdown — number, type, surface, rate. */}
        {courts.length > 0 && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Courts</div>
              <span className="more">{courts.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {courts.map((c) => {
                const meta = [
                  c.indoor != null ? (c.indoor ? 'Indoor' : 'Outdoor') : null,
                  c.surfaceType ? c.surfaceType.charAt(0).toUpperCase() + c.surfaceType.slice(1) : null,
                ].filter(Boolean);
                const rate = typeof c.hourlyRate === 'number' && c.hourlyRate > 0
                  ? c.hourlyRate
                  : (typeof venue.priceFrom === 'number' ? venue.priceFrom : null);
                const thumb = apiImageUrl(c.mainImageUrl);
                const photos = (c.galleryImageUrls ?? []).map((u) => apiImageUrl(u)).filter(Boolean) as string[];
                // This court's own hours for today (each court can keep its own schedule).
                const courtToday = c.hours?.[todayKey];
                const courtTodayLabel = courtToday
                  ? (/closed/i.test(courtToday) ? 'Closed today' : `Open today · ${courtToday.replace(' - ', '–')}`)
                  : null;
                // Owner-set "Court profile" attributes — only the ones that carry a value.
                const profile = [
                  c.floorType ? `${c.floorType} floor` : null,
                  c.ballType ? `${c.ballType} ball` : null,
                  c.spaceAroundCourt ? `${c.spaceAroundCourt} clearance` : null,
                  c.hasAircon ? 'Air-conditioned' : null,
                  c.highCeiling ? 'High ceiling' : null,
                  c.hasRefreshmentStand ? 'Refreshment stand' : null,
                ].filter(Boolean) as string[];
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {thumb ? (
                        <div className="w-11 h-11 rounded-[10px] shrink-0" style={{ background: `url(${thumb}) center/cover` }} />
                      ) : (
                        <div className="w-11 h-11 rounded-[10px] shrink-0 bg-[var(--primary-tint)] text-[var(--primary)] inline-flex items-center justify-center font-heading font-bold">
                          {c.courtNumber}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold text-[var(--ink)] truncate">
                          {c.courtName || `Court ${c.courtNumber}`}
                        </div>
                        {meta.length > 0 && (
                          <div className="text-[12px] text-[var(--muted)] font-semibold">{meta.join(' · ')}</div>
                        )}
                        {courtTodayLabel && (
                          <div className={`text-[11.5px] font-semibold ${courtToday && !/closed/i.test(courtToday) ? 'text-[var(--lime-ink,var(--muted))]' : 'text-[var(--muted)]'}`}>{courtTodayLabel}</div>
                        )}
                      </div>
                      {rate != null && (
                        <div className="text-[13px] font-bold text-[var(--ink)] shrink-0">{sym}{rate}<span className="text-[var(--muted)] font-semibold">/hr</span></div>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-[12.5px] text-[var(--muted)] leading-snug">{c.description}</p>
                    )}
                    {profile.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full border-[0.5px] border-[var(--hairline)] text-[var(--ink-2)] px-2.5 py-1 text-[11.5px] font-semibold"
                          >
                            <Icon name="check" size={11} className="text-[var(--lime-ink)]" />
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.isSplittable && (
                      <div className="text-[12px] font-semibold text-[var(--blue)]">
                        Splittable into {c.splitCount ?? 2} half-courts
                        {c.subUnitRates?.length ? (
                          <span className="text-[var(--muted)]">
                            {' · '}{c.subUnitRates.map((r) => `Half ${r.index + 1}: ${sym}${r.hourlyRate}/hr`).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {photos.length > 0 && (
                      <div className="scroll-x flex gap-2 -mx-1 px-1">
                        {photos.map((src, i) => (
                          <button
                            key={src + i}
                            type="button"
                            className="w-20 h-16 rounded-[10px] shrink-0 active:scale-[0.98] transition-transform"
                            style={{ background: `url(${src}) center/cover` }}
                            aria-label={`Photo ${i + 1} of ${c.courtName || `Court ${c.courtNumber}`}`}
                            onClick={() => window.open(src, '_blank')}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact — call or visit the venue's site. */}
        {(venue.phone || venue.website) && (
          <div className="section p-0!">
            <div className="section-head px-0">
              <div className="hd-2">Contact</div>
            </div>
            <div className="flex flex-col gap-2">
              {venue.phone && (
                <a
                  href={`tel:${venue.phone}`}
                  className="flex items-center gap-3 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-3 text-[14px] font-bold text-[var(--ink)]"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="mic" size={15} />
                  </span>
                  {venue.phone}
                </a>
              )}
              {venue.website && (
                <a
                  href={/^https?:\/\//i.test(venue.website) ? venue.website : `https://${venue.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-4 py-3 text-[14px] font-bold text-[var(--ink)]"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                    <Icon name="globe" size={15} />
                  </span>
                  <span className="truncate">Visit website</span>
                  <Icon name="forward" size={14} className="ml-auto text-[var(--muted)]" />
                </a>
              )}
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
          <>
            {requireApproval && intent !== 'lobby' && (
              <div className="flex items-start gap-2 mb-2 text-[12px] font-semibold text-[var(--ink-2)]">
                <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <span>The owner approves first — once approved, pay within {payWindowLabel(venue.bookingPayWindowHours)} to confirm.</span>
              </div>
            )}
            {((venue as any).cancellationWindowHours != null || (venue as any).refundPercent != null) && (
              <div className="flex items-start gap-2 mb-2 text-[12px] text-[var(--ink-2)]">
                <Icon name="info" size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                <span>Free cancellation up to <strong>{(venue as any).cancellationWindowHours ?? 24}h</strong> before — <strong>{(venue as any).refundPercent ?? 100}%</strong> refund.{((venue as any).noShowFee || 0) > 0 ? ` ₱${(venue as any).noShowFee} no-show fee.` : ''}</span>
              </div>
            )}
            <Button fullWidth onClick={() => onNavigate('book-court', { venueId: venue.id, intent })}>
              <Icon name="calendar" size={16} /> {ctaLabel}
            </Button>
          </>
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
