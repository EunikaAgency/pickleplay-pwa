import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { NearbyFilterSheet } from './NearbyFilterSheet';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { listVenues, type ApiVenue } from '../../shared/lib/api';
import { priceLabel, indoorLabel, locationLine, venueTags } from '../../shared/lib/venueDisplay';

interface NearbyScreenProps {
  onNavigate: Navigate;
}

interface VenueCard {
  id: string; // slug (or _id) used for navigation
  name: string;
  image: string | null;
  rating: number | null;
  location: string;
  label: string;
  tags: string[];
  lat: number | null;
  lng: number | null;
}

// Venues fetched per page. Small enough to keep the backend query light; the
// list grows via "Load more" using the cursor the API returns.
const PAGE_SIZE = 20;

// Metro Manila — most seeded venues are here; used when none carry coords.
const MAP_FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

const ROW_GRADIENTS = [
  'linear-gradient(135deg, #c1f100, #a5d100)',
  'linear-gradient(135deg, #0040e0, #6c83ff)',
  'linear-gradient(135deg, #cf3000, #ff7355)',
  'linear-gradient(135deg, #abd600, #5b7400)',
  'linear-gradient(135deg, #404756, #1a1d24)',
];

// Fixed decorative positions for the stylized (non-Leaflet) map pins.
const PIN_POSITIONS = [
  { left: '22%', top: '38%' },
  { left: '42%', top: '52%' },
  { left: '55%', top: '40%' },
  { left: '32%', top: '70%' },
  { left: '70%', top: '62%' },
];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FlyToUser() {
  const map = useMap();
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 14 });
  }, [map]);
  return null;
}

type SheetState = 'collapsed' | 'expanded';

export function NearbyScreen({ onNavigate }: NearbyScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [active, setActive] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [useRealMap, setUseRealMap] = useState(false);
  const [sheet, setSheet] = useState<SheetState>('collapsed');
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  // First page on mount; state is only committed in the async callbacks (never
  // synchronously in the effect) and skipped if the screen unmounted mid-flight.
  useEffect(() => {
    let cancelled = false;
    listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName' })
      .then((page) => {
        if (cancelled) return;
        setVenues(page.items);
        setCursor(page.cursor);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setStatus('loading');
    listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName' })
      .then((page) => {
        setVenues(page.items);
        setCursor(page.cursor);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  // Append the next page; the cursor drives whether there's more to fetch.
  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName', cursor })
      .then((page) => {
        setVenues((prev) => [...prev, ...page.items]);
        setCursor(page.cursor);
      })
      .catch(() => {
        /* keep what we have; the button stays available to retry */
      })
      .finally(() => setLoadingMore(false));
  };

  const cards = useMemo<VenueCard[]>(
    () =>
      venues.map((v) => ({
        id: v.slug || v.id,
        name: v.displayName,
        image: v.image || null,
        rating: v.googleRating ?? null,
        location: locationLine(v) || '—',
        label: priceLabel(v) ?? indoorLabel(v) ?? 'Courts',
        tags: venueTags(v),
        lat: v.lat ?? null,
        lng: v.lng ?? null,
      })),
    [venues],
  );

  const mapCards = useMemo(
    () => cards.filter((c): c is VenueCard & { lat: number; lng: number } => c.lat != null && c.lng != null),
    [cards],
  );
  const mapCenter: [number, number] = mapCards[0] ? [mapCards[0].lat, mapCards[0].lng] : MAP_FALLBACK_CENTER;

  const isCollapsed = sheet === 'collapsed';
  // Sheet sits at bottom:0 with 92px padding-bottom for the floating tab bar.
  // The numbers here describe TOTAL sheet height (visible content + tab bar clearance).
  const TAB_CLEARANCE = 92;
  const sheetHeight = isCollapsed
    ? 170 + TAB_CLEARANCE
    : Math.round(window.innerHeight * 0.55) + TAB_CLEARANCE;

  const loadingUI = (
    <div className="scroll safe-top safe-bottom px-4">
      <LoadingSkeleton variant="card" count={4} />
    </div>
  );
  const errorUI = (
    <div className="scroll safe-top safe-bottom">
      <ErrorState
        title="Couldn't load courts"
        message="We couldn't reach the courts directory. Tap to retry."
        onRetry={retry}
      />
    </div>
  );
  const emptyUI = (
    <div className="scroll safe-top safe-bottom">
      <EmptyState
        icon="location"
        title="No courts found"
        description="There are no courts in the directory yet. Check back soon."
      />
    </div>
  );

  return (
    <DemoBranch loading={loadingUI} error={errorUI} empty={emptyUI}>
      {status === 'loading' ? (
        loadingUI
      ) : status === 'error' ? (
        errorUI
      ) : cards.length === 0 ? (
        emptyUI
      ) : (
        <div className="map-screen">
          {useRealMap ? (
            <div className="absolute inset-0">
              <MapContainer center={mapCenter} zoom={12} className="w-full h-full" zoomControl={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyToUser />
                {mapCards.map((c) => (
                  <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon}>
                    <Popup>
                      <div
                        className="min-w-[180px] cursor-pointer"
                        onClick={() => onNavigate('court-details', { id: c.id })}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon name="location" size={14} />
                          <strong>{c.name}</strong>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] text-[#666]">
                          {c.rating != null && <><Icon name="star" size={12} /> {c.rating} · </>}
                          {c.location}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className="map-canvas">
              <div className="road" style={{ left: 0, top: '30%', width: '100%', height: 6 }} />
              <div className="road" style={{ left: 0, top: '60%', width: '100%', height: 4 }} />
              <div className="road" style={{ left: 0, top: '85%', width: '100%', height: 5 }} />
              <div className="road" style={{ left: '30%', top: 0, width: 4, height: '100%' }} />
              <div className="road" style={{ left: '65%', top: 0, width: 5, height: '100%' }} />
              <div className="park" style={{ left: '8%', top: '50%', width: 100, height: 80 }} />
              <div className="park" style={{ left: '70%', top: '20%', width: 90, height: 70 }} />
              <div className="water" style={{ left: '-10%', top: '20%', width: 160, height: 90 }} />
              <div className="water" style={{ left: '60%', top: '78%', width: 200, height: 80 }} />

              {cards.slice(0, PIN_POSITIONS.length).map((c, i) => (
                <button
                  key={c.id}
                  className={`map-pin ${i === active ? 'active' : ''}`}
                  style={{ ...PIN_POSITIONS[i], position: 'absolute' }}
                  onClick={() => setActive(i)}
                >
                  <span className="pinwrap">
                    <Icon name="paddle" size={12} />
                    {c.label}
                  </span>
                </button>
              ))}

              {/* You-are-here marker */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-[#3b82f6] border-[3px] border-white shadow-[0_0_0_4px_rgba(59,130,246,0.25),0_2px_8px_rgba(0,0,0,0.2)]" />
            </div>
          )}

          {/* Search — clickable, opens SearchScreen */}
          <button type="button" className="map-search" onClick={() => onNavigate('search')}>
            <Icon name="search" size={16} />
            <span className="text">Find courts near you</span>
            <Avatar src={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'Guest'} size={32} />
          </button>

          {/* Chip row */}
          <div className="map-chip-row">
            <button className="chip lime">
              <Icon name="paddle" size={12} /> Courts
            </button>
            <button className="chip">Games here</button>
            <button className="chip">Indoor</button>
            <button className="chip">Free</button>
            <button className="chip">Lighted</button>
          </div>

          {/* Floating control stack — always visible above the sheet */}
          <div
            className="absolute right-4 flex flex-col gap-2 z-[1100] transition-[bottom] duration-300 [transition-timing-function:cubic-bezier(0.4,0.0,0.2,1)]"
            style={{ bottom: sheetHeight + 12 }}
          >
            <button
              aria-label={useRealMap ? 'Show stylized map' : 'Show real map'}
              onClick={() => setUseRealMap((v) => !v)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] ${
                useRealMap
                  ? 'bg-[var(--lime)] text-[var(--lime-ink)]'
                  : 'bg-white/95 text-[var(--primary)]'
              }`}
            >
              <Icon name="layers" size={18} />
            </button>
            <button
              aria-label="Locate me"
              className="w-11 h-11 rounded-xl bg-white/95 text-[var(--primary)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
            >
              <Icon name="navigate" size={18} />
            </button>
          </div>

          {/* Bottom sheet — collapsible. Tap the chevron to toggle. */}
          <div
            className="map-sheet transition-[height] duration-300 [transition-timing-function:cubic-bezier(0.4,0.0,0.2,1)]"
            style={{ height: sheetHeight }}
          >
            <button
              type="button"
              onClick={() => setSheet((s) => (s === 'collapsed' ? 'expanded' : 'collapsed'))}
              aria-label={isCollapsed ? 'Expand court list' : 'Collapse court list'}
              aria-expanded={!isCollapsed}
              className="w-full pt-2.5 pb-1.5 flex items-center justify-center gap-1.5 bg-transparent text-[var(--muted)] text-[11px] font-extrabold tracking-[0.06em] uppercase"
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] transition-transform duration-[250ms] ease-out ${
                  isCollapsed ? 'rotate-0' : 'rotate-180'
                }`}
              >
                <Icon name="chevron" size={14} className="-rotate-90" />
              </span>
              {isCollapsed ? 'Show list' : 'Hide list'}
            </button>
            <div className="head">
              <div>
                <div className="t-eyebrow">Nearby · {cards.length} courts</div>
                <div className="hd-2 mt-0.5">Courts directory</div>
              </div>
              <button className="chip bg-[var(--surface-2)]!" onClick={() => setFilterOpen(true)}>
                <Icon name="sliders" size={12} /> Filter
              </button>
            </div>
            <div className="list">
              {cards.map((c, i) => (
                <button
                  key={c.id}
                  className={`court-row ${
                    i === active
                      ? 'bg-[var(--lime-soft)] border-[0.5px] border-[rgba(193,241,0,0.5)]'
                      : 'bg-[var(--surface-2)] border-[0.5px] border-transparent'
                  }`}
                  onClick={() => {
                    setActive(i);
                    onNavigate('court-details', { id: c.id });
                  }}
                >
                  <div
                    className="img flex items-center justify-center text-white overflow-hidden"
                    style={
                      c.image
                        ? { backgroundImage: `url(${c.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: ROW_GRADIENTS[i % ROW_GRADIENTS.length] }
                    }
                  >
                    {!c.image && <Icon name="paddle" size={24} />}
                  </div>
                  <div className="body">
                    <div className="title">{c.name}</div>
                    <div className="row1">
                      {c.rating != null && (
                        <>
                          <Icon name="star" size={11} className="text-[#c89000]" /> {c.rating}
                          <span className="opacity-50">·</span>
                        </>
                      )}
                      {c.location}
                      <span className="opacity-50">·</span>
                      {c.label}
                    </div>
                    <div className="tags">
                      {c.tags.map((t) => (
                        <span key={t} className="t">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--primary)]">
                    <Icon name="directions" size={14} />
                  </div>
                </button>
              ))}

              {cursor && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-1 w-full py-3 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] text-[13px] font-bold disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more courts'}
                </button>
              )}
            </div>
          </div>

          <NearbyFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
        </div>
      )}
    </DemoBranch>
  );
}
