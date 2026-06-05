import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { Segmented } from '../../shared/components/ui/Segmented';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { useAuthStore } from '../../shared/lib/authStore';
import { listOwnerVenues, listAllVenues, type ApiVenue } from '../../shared/lib/api';
import { priceLabel, locationLine, venueImage } from '../../shared/lib/venueDisplay';
import { formatDistance, type LatLng } from '../../shared/lib/geo';
import type { Navigate } from '../../shared/lib/navigation';
import {
  coordsOf, competitorsNear, marketSummary, compareToFocus,
  type CompetitorRow, type MetricStat, type Position,
} from './utils/marketMetrics';

interface OwnerNearbyScreenProps {
  onNavigate: Navigate;
}

// Metro Manila — most seeded venues are here; used when the focus venue and its
// competitors somehow yield no points (shouldn't happen once coords resolve).
const MAP_FALLBACK_CENTER: LatLng = [14.5995, 120.9842];

// Radius presets (miles → km) that bound "the area" around the focus venue.
const RADII = [
  { mi: 5, km: 8 },
  { mi: 10, km: 16 },
  { mi: 25, km: 40 },
];

// Frame the map to the focus venue + its competitor pins. Refits on change.
function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [48, 48], maxZoom: 14 });
  }, [map, points]);
  return null;
}

const peso = (n: number) => `₱${Math.round(n)}`;

// Phrase the focus venue's standing on a metric. Lower price is good; higher
// rating/court-count is good — so the same Position reads differently per metric.
function positionLabel(metric: 'price' | 'rating' | 'courts', pos: Position): string {
  if (pos === 'only') return 'Only court here';
  if (metric === 'price') return pos === 'lowest' ? 'Most affordable' : pos === 'highest' ? 'Priciest' : 'Mid-range';
  if (metric === 'rating') return pos === 'highest' ? 'Top rated' : pos === 'lowest' ? 'Lowest rated' : 'Mid-pack';
  return pos === 'highest' ? 'Largest' : pos === 'lowest' ? 'Smallest' : 'Mid-size';
}

// A positive standing (good for the owner) tints lime; a weak one tints coral.
function positionTone(metric: 'price' | 'rating' | 'courts', pos: Position): string {
  const good = metric === 'price' ? pos === 'lowest' : pos === 'highest';
  const bad = metric === 'price' ? pos === 'highest' : pos === 'lowest';
  if (pos === 'only') return 'bg-[var(--surface-2)] text-[var(--ink-2)]';
  if (good) return 'bg-[var(--lime-soft)] text-[var(--lime-ink)]';
  if (bad) return 'bg-[var(--coral-soft)] text-[var(--coral)]';
  return 'bg-[var(--surface-2)] text-[var(--ink-2)]';
}

function MetricTile({
  metric, icon, label, stat, fmt,
}: {
  metric: 'price' | 'rating' | 'courts';
  icon: string;
  label: string;
  stat: MetricStat;
  fmt: (n: number) => string;
}) {
  return (
    <div className="card p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-[var(--primary-tint)] text-[var(--primary)]">
          <Icon name={icon} size={16} />
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${positionTone(metric, stat.position)}`}>
          {positionLabel(metric, stat.position)}
        </span>
      </div>
      <div>
        <div className="font-heading font-semibold text-[20px] leading-none text-[var(--ink)] tabular-nums">
          {stat.value != null ? fmt(stat.value) : '—'}
        </div>
        <div className="t-eyebrow mt-1">{label}</div>
      </div>
      <div className="t-sm">
        {stat.areaAvg != null
          ? `Area avg ${fmt(stat.areaAvg)} · ${stat.sampleSize} court${stat.sampleSize === 1 ? '' : 's'}`
          : 'No nearby data'}
      </div>
    </div>
  );
}

// Per-competitor comparison chips (cheaper/pricier, higher/lower rated, courts).
function CompareTags({ competitor, focus }: { competitor: ApiVenue; focus: ApiVenue }) {
  const c = compareToFocus(competitor, focus);
  const tags: { text: string; tone: string }[] = [];
  // A competitor that's cheaper / higher-rated / bigger is a threat → coral;
  // the opposite is favourable to the owner → lime.
  if (c.price === 'lower') tags.push({ text: 'Cheaper', tone: 'coral' });
  if (c.price === 'higher') tags.push({ text: 'Pricier', tone: 'lime' });
  if (c.rating === 'higher') tags.push({ text: 'Higher rated', tone: 'coral' });
  if (c.rating === 'lower') tags.push({ text: 'Lower rated', tone: 'lime' });
  if (c.courts === 'higher') tags.push({ text: 'More courts', tone: 'coral' });
  if (c.courts === 'lower') tags.push({ text: 'Fewer courts', tone: 'lime' });
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map((t) => (
        <span
          key={t.text}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            t.tone === 'coral' ? 'bg-[var(--coral-soft)] text-[var(--coral)]' : 'bg-[var(--lime-soft)] text-[var(--lime-ink)]'
          }`}
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}

// Owner's Nearby tab — a local market map. Players/guests get NearbyScreen;
// App.tsx branches on owner.market.view.
export function OwnerNearbyScreen({ onNavigate }: OwnerNearbyScreenProps) {
  const user = useAuthStore((s) => s.user);
  const ownerId = user?.id ?? '';

  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [allVenues, setAllVenues] = useState<ApiVenue[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [focusId, setFocusId] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(16);

  // Owner's own venues drive the screen — a failure here is a screen error.
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    listOwnerVenues(ownerId)
      .then((v) => { if (!cancelled) { setVenues(v); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [ownerId]);

  // The full venue set for competitors — independent; a failure just means no
  // competitor pins, not a screen error (mirrors NearbyScreen's map fetch).
  useEffect(() => {
    let cancelled = false;
    listAllVenues({ sortBy: 'displayName' })
      .then((items) => { if (!cancelled) setAllVenues(items); })
      .catch(() => { /* leave competitors empty */ });
    return () => { cancelled = true; };
  }, []);

  const retry = () => {
    setStatus('loading');
    listOwnerVenues(ownerId)
      .then((v) => { setVenues(v); setStatus('ready'); })
      .catch(() => setStatus('error'));
  };

  // Only locatable venues can anchor the market. The focus falls back to the
  // first locatable venue until the owner explicitly picks one (derived, not
  // stored — so an unset/stale focusId resolves without a defaulting effect).
  const locatable = useMemo(() => venues.filter((v) => coordsOf(v) != null), [venues]);
  const focus = useMemo(
    () => locatable.find((v) => v.id === focusId) ?? locatable[0] ?? null,
    [locatable, focusId],
  );
  const focusCoords = useMemo(() => (focus ? coordsOf(focus) : null), [focus]);
  const ownIds = useMemo(() => new Set(venues.map((v) => v.id)), [venues]);

  const competitors = useMemo<CompetitorRow[]>(
    () => (focusCoords ? competitorsNear(focusCoords, allVenues, ownIds, radiusKm) : []),
    [focusCoords, allVenues, ownIds, radiusKm],
  );
  const summary = useMemo(() => (focus ? marketSummary(focus, competitors) : null), [focus, competitors]);
  // True when nothing was actually within the radius and we fell back to nearest.
  const widened = useMemo(
    () => competitors.length > 0 && competitors.every((c) => c.distanceKm > radiusKm),
    [competitors, radiusKm],
  );

  const ownPoints = useMemo<LatLng[]>(
    () => venues.map(coordsOf).filter((c): c is LatLng => c != null),
    [venues],
  );
  const fitPoints = useMemo<LatLng[]>(
    () => (focusCoords ? [focusCoords, ...competitors.map((c) => c.coords)] : ownPoints),
    [focusCoords, competitors, ownPoints],
  );

  const header = (
    <div className="app-header">
      <div>
        <div className="font-heading font-extrabold text-[20px] tracking-[-0.01em] leading-tight text-[var(--primary)]">
          Your market
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-0.5">How your courts compare nearby</div>
      </div>
      <button
        onClick={() => onNavigate('owner-venues')}
        aria-label="My venues"
        className="w-10 h-10 rounded-full bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
      >
        <Icon name="storefront" size={18} />
      </button>
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 lg:px-0 mt-4 space-y-3">
          <LoadingSkeleton variant="block" count={1} />
          <LoadingSkeleton variant="card" count={3} />
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 lg:px-0 mt-4">
          <ErrorState title="Couldn't load your market" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
        </div>
      </div>
    );
  }

  // No venues at all → prompt to create one (mirrors OwnerHomeScreen empty).
  if (venues.length === 0) {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 lg:px-0 mt-6">
          <EmptyState
            icon="storefront"
            title="No venues yet"
            description="List a venue to see how it stacks up against nearby courts — price, rating, court count, and competition."
            action={{ label: 'Create a venue', onPress: () => onNavigate('owner-new-venue') }}
          />
        </div>
      </div>
    );
  }

  // Has venues, but none has coordinates → can't anchor a map; explain it.
  if (!focus || !focusCoords) {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 lg:px-0 mt-6">
          <EmptyState
            icon="location"
            title="Add a map location"
            description="Your venues don't have a map pin yet, so we can't place them on the market map. Set a location in each venue's Location tab to see nearby competitors."
            action={{ label: 'Manage venues', onPress: () => onNavigate('owner-venues') }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom home-refined">
      {header}

      <div className="px-5 lg:px-0 mt-4 space-y-5">
        {/* Focus-venue selector (only when the owner has more than one locatable venue) */}
        {locatable.length > 1 && (
          <Segmented
            options={locatable.map((v) => ({ value: v.id, label: v.displayName }))}
            value={focus?.id ?? ''}
            onChange={setFocusId}
          />
        )}

        {/* Map: own venues = lime, competitors = grey, focus emphasized */}
        <div className="rounded-[22px] overflow-hidden h-[42vh] min-h-[260px] shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)]">
          <MapContainer center={focusCoords ?? MAP_FALLBACK_CENTER} zoom={12} className="w-full h-full" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToPoints points={fitPoints} />

            {/* Competitor pins (grey) */}
            {competitors.map((c) => (
              <CircleMarker
                key={`c-${c.venue.id}`}
                center={c.coords}
                radius={7}
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#8a93a6', fillOpacity: 0.9 }}
              >
                <Popup className="venue-popup" minWidth={224} maxWidth={224}>
                  <button
                    type="button"
                    className="venue-popup-card"
                    onClick={() => onNavigate('court-details', { id: c.venue.slug || c.venue.id })}
                  >
                    <div
                      className="venue-popup-img"
                      style={venueImage(c.venue) ? { backgroundImage: `url(${venueImage(c.venue)})` } : undefined}
                    >
                      {!venueImage(c.venue) && <Icon name="paddle" size={28} />}
                    </div>
                    <div className="venue-popup-body">
                      <div className="venue-popup-title">{c.venue.displayName}</div>
                      <div className="venue-popup-meta">
                        <span className="font-extrabold text-[var(--primary)]">{formatDistance(c.distanceKm)}</span>
                        <span className="opacity-40">·</span>
                        <span className="truncate min-w-0">{locationLine(c.venue) || '—'}</span>
                      </div>
                      <div className="venue-popup-foot">
                        <span className="venue-popup-price">{priceLabel(c.venue) ?? 'Courts'}</span>
                        <span className="venue-popup-cta">View <Icon name="chevron" size={12} /></span>
                      </div>
                    </div>
                  </button>
                </Popup>
              </CircleMarker>
            ))}

            {/* Own venues (lime); the focus venue is larger */}
            {venues.map((v) => {
              const coords = coordsOf(v);
              if (!coords) return null;
              const isFocus = v.id === focus.id;
              return (
                <CircleMarker
                  key={`o-${v.id}`}
                  center={coords}
                  radius={isFocus ? 11 : 8}
                  pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#c1f100', fillOpacity: 1 }}
                >
                  <Popup className="venue-popup" minWidth={224} maxWidth={224}>
                    <button
                      type="button"
                      className="venue-popup-card"
                      onClick={() => onNavigate('owner-venue', { id: v.slug || v.id })}
                    >
                      <div
                        className="venue-popup-img"
                        style={venueImage(v) ? { backgroundImage: `url(${venueImage(v)})` } : undefined}
                      >
                        {!venueImage(v) && <Icon name="paddle" size={28} />}
                      </div>
                      <div className="venue-popup-body">
                        <div className="venue-popup-title">{v.displayName} <span className="text-[var(--lime-ink)]">· Yours</span></div>
                        <div className="venue-popup-meta">
                          <span className="truncate min-w-0">{locationLine(v) || '—'}</span>
                        </div>
                        <div className="venue-popup-foot">
                          <span className="venue-popup-price">{priceLabel(v) ?? 'Courts'}</span>
                          <span className="venue-popup-cta">Manage <Icon name="chevron" size={12} /></span>
                        </div>
                      </div>
                    </button>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Radius presets */}
        <div className="flex items-center gap-2">
          <span className="t-eyebrow">Within</span>
          {RADII.map((r) => (
            <button
              key={r.mi}
              className={`chip ${radiusKm === r.km ? 'active' : 'bg-[var(--surface-2)]!'}`}
              aria-pressed={radiusKm === r.km}
              onClick={() => setRadiusKm(r.km)}
            >
              {r.mi} mi
            </button>
          ))}
        </div>

        {/* Market summary — four headline metrics for the focus venue */}
        {summary && (
          <section className="space-y-3">
            <div className="hd-2">{focus.displayName}</div>
            <div className="grid grid-cols-2 gap-3">
              <MetricTile metric="price" icon="payments" label="Your rate / hr" stat={summary.price} fmt={(n) => peso(n)} />
              <MetricTile metric="rating" icon="star" label="Your rating" stat={summary.rating} fmt={(n) => n.toFixed(1)} />
              <MetricTile
                metric="courts"
                icon="paddle"
                label="Your courts"
                stat={summary.courts}
                fmt={(n) => String(Math.round(n))}
              />
              <div className="card p-3.5 flex flex-col gap-2">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-[var(--primary-tint)] text-[var(--primary)]">
                  <Icon name="storefront" size={16} />
                </span>
                <div>
                  <div className="font-heading font-semibold text-[20px] leading-none text-[var(--ink)] tabular-nums">{summary.density}</div>
                  <div className="t-eyebrow mt-1">Nearby courts</div>
                </div>
                <div className="t-sm">{summary.courts.areaTotal} courts in the area</div>
              </div>
            </div>
          </section>
        )}

        {/* Competitor list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="hd-2">Nearby competitors</div>
            <span className="t-sm">{competitors.length} court{competitors.length === 1 ? '' : 's'}</span>
          </div>

          {widened && (
            <div className="t-sm px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)]">
              No courts within {RADII.find((r) => r.km === radiusKm)?.mi ?? ''} mi — showing the nearest instead.
            </div>
          )}

          {competitors.length === 0 ? (
            <div className="t-sm px-3 py-6 text-center">No other courts found nearby.</div>
          ) : (
            <div className="space-y-2.5">
              {competitors.map((c) => {
                const v = c.venue;
                const unverified = v.state === 'unclaimed' || !v.isVerified;
                return (
                  <button
                    key={v.id}
                    onClick={() => onNavigate('court-details', { id: v.slug || v.id })}
                    className="w-full text-left bg-[var(--surface)] rounded-[18px] p-3.5 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">
                          {v.displayName}
                          {unverified && <span className="t-sm font-normal"> · Unverified</span>}
                        </div>
                        <div className="t-sm truncate">
                          <span className="font-extrabold text-[var(--primary)]">{formatDistance(c.distanceKm)}</span>
                          {' · '}{locationLine(v) || '—'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums">{priceLabel(v) ?? '—'}</div>
                        <div className="t-sm flex items-center gap-1 justify-end">
                          {v.googleRating != null && (<><Icon name="star" size={11} className="text-[#c89000]" /> {v.googleRating}</>)}
                          {v.courtCount != null && <span>· {v.courtCount} court{v.courtCount === 1 ? '' : 's'}</span>}
                        </div>
                      </div>
                    </div>
                    <CompareTags competitor={v} focus={focus} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
