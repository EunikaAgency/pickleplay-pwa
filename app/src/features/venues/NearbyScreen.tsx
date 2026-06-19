import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { NearbyFilterSheet } from './NearbyFilterSheet';
import { makeDefaultFilters, matchesFilters, countActiveFilters, type VenueFilters } from './venueFilters';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { listVenues, listAllVenues, type ApiVenue } from '../../shared/lib/api';
import { priceLabel, indoorLabel, locationLine, venueTags, venueCoords, venueImage } from '../../shared/lib/venueDisplay';
import { haversineKm, formatDistance, getCurrentLocation, type LatLng } from '../../shared/lib/geo';

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
  /** Distance from the user in km, or null (no user location / no coords). */
  distanceKm: number | null;
}

// A venue resolved to a map point. Coords come from the venue's lat/lng or,
// failing that, from its Google Maps URL (see venueCoords).
interface MapMarker {
  id: string;
  name: string;
  image: string | null;
  rating: number | null;
  location: string;
  label: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
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

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Shared mapping of an API venue → list-card fields (distance is layered on by
// the caller, which knows whether a user location is set).
function toVenueCard(v: ApiVenue): Omit<VenueCard, 'distanceKm'> {
  return {
    id: v.slug || v.id,
    name: v.displayName,
    image: venueImage(v),
    rating: v.googleRating ?? null,
    location: locationLine(v) || '—',
    label: priceLabel(v) ?? indoorLabel(v) ?? 'Courts',
    tags: venueTags(v),
  };
}

// Client-side name/area match — used over the full venue set when filtering or
// distance-sorting (the server's paged, name-sorted `search` no longer applies).
function matchesQuery(v: ApiVenue, q: string): boolean {
  if (!q) return true;
  return `${v.displayName} ${locationLine(v)}`.toLowerCase().includes(q);
}

function toMapMarker(v: ApiVenue, coords: [number, number], distanceKm: number | null): MapMarker {
  return {
    id: v.slug || v.id,
    name: v.displayName,
    image: venueImage(v),
    rating: v.googleRating ?? null,
    location: locationLine(v) || '—',
    label: priceLabel(v) ?? indoorLabel(v) ?? 'Courts',
    lat: coords[0],
    lng: coords[1],
    distanceKm,
  };
}

// A locatable venue kept for the "near me" view, with its coords + distance.
interface NearbyRow {
  v: ApiVenue;
  coords: [number, number];
  distanceKm: number;
}

// When the radius excludes every court (e.g. the user is far from all of them),
// fall back to this many nearest courts so "Near me" never shows a blank list.
const NEAREST_FALLBACK = 20;

// Build the "near me" list: keep *locatable* venues passing the attribute filters
// + search, rank nearest-first, then keep only those within the chosen radius
// (the actual "show courts near me" step the user asked for). Coordless venues
// can't be placed, so they're left out. Falls back to the nearest few if the
// radius is empty so the list never goes blank.
function resolveNearby(source: ApiVenue[], userLoc: LatLng, filters: VenueFilters, search: string): NearbyRow[] {
  const q = search.toLowerCase();
  const rows: NearbyRow[] = source.flatMap((v) => {
    if (!matchesQuery(v, q) || !matchesFilters(v, filters)) return [];
    const coords = venueCoords(v);
    if (!coords) return [];
    return [{ v, coords, distanceKm: haversineKm(userLoc, coords) }];
  });
  rows.sort((a, b) => a.distanceKm - b.distanceKm);
  const capKm = filters.maxDistanceKm;
  const within = rows.filter((r) => r.distanceKm <= capKm);
  return within.length ? within : rows.slice(0, NEAREST_FALLBACK);
}

// Frame the map. Once the user shares their location we keep *them* centered by
// fitting a box that is symmetric about the user — so the user dot stays
// dead-center rather than drifting toward the courts' centroid. The box spans to
// the farthest nearby court (so the nearby cluster is in view, never a blank
// radius), but at least the chosen radius. Other courts stay rendered on the map
// beyond the frame — the user zooms out to see them. Without a location there's
// no user to center on, so we fall back to framing the court pins.
function FrameMap({ userLoc, radiusKm, nearbyPoints, allPoints }: {
  userLoc: LatLng | null;
  radiusKm: number;
  nearbyPoints: [number, number][];
  allPoints: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (userLoc) {
      // Start from the chosen radius (in degrees), then grow the box to include
      // every nearby court — keeping it symmetric so the user stays centered.
      let latSpan = radiusKm / 111;
      let lngSpan = radiusKm / (111 * Math.cos((userLoc[0] * Math.PI) / 180));
      for (const [lat, lng] of nearbyPoints) {
        latSpan = Math.max(latSpan, Math.abs(lat - userLoc[0]));
        lngSpan = Math.max(lngSpan, Math.abs(lng - userLoc[1]));
      }
      map.fitBounds(
        [
          [userLoc[0] - latSpan, userLoc[1] - lngSpan],
          [userLoc[0] + latSpan, userLoc[1] + lngSpan],
        ],
        { padding: [40, 40], maxZoom: 15 },
      );
      return;
    }
    if (allPoints.length === 0) return;
    if (allPoints.length === 1) {
      map.setView(allPoints[0], 14);
      return;
    }
    map.fitBounds(allPoints, { padding: [56, 56], maxZoom: 15 });
  }, [map, userLoc, radiusKm, nearbyPoints, allPoints]);
  return null;
}

type SheetState = 'collapsed' | 'expanded';

export function NearbyScreen({ onNavigate }: NearbyScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  // Distance search is a browse aid — guests use it freely (like the rest of
  // the tab). For signed-in users it's still governed by the permission, so an
  // admin can revoke it per role (mirrors `!isLoggedIn || canX` in App.tsx).
  const canLocate = !isLoggedIn || userHasPermission(currentUser, 'player.venues.locate');
  const [active, setActive] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  // Open on the list/search view (sheet expanded) rather than the bare map, so
  // the court list is front-and-centre when the tab opens (client request).
  const [sheet, setSheet] = useState<SheetState>('expanded');
  const [query, setQuery] = useState('');
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  // True while re-fetching for a changed search query (a lightweight indicator
  // that, unlike `status`, doesn't tear the whole screen down to a skeleton).
  const [searching, setSearching] = useState(false);
  // All venues, for the map's markers — independent of the list's paging so the
  // map shows every locatable court at once, not just the first list page. Also
  // the source the distance sort ranks (the server can't sort by proximity).
  const [mapVenues, setMapVenues] = useState<ApiVenue[]>([]);
  // The user's coordinates once they share them; null = distance sort is off.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  // Applied Courts filters (the chip row + the filter sheet both edit these).
  // Seed the distance cap from the user's saved search-radius preference so
  // "Near me" defaults to the radius they chose in Settings (falls back to the
  // shared default for guests / unset accounts).
  const [filters, setFilters] = useState<VenueFilters>(() => {
    const base = makeDefaultFilters();
    const saved = currentUser?.preferences?.searchRadiusKm;
    return saved ? { ...base, maxDistanceKm: saved } : base;
  });

  const search = query.trim();
  const activeFilterCount = countActiveFilters(filters);
  const filtering = activeFilterCount > 0;
  // Filters and distance sort both need the full venue set, not the server's
  // name-sorted page (client-side filtering a single page would hide matches on
  // pages we haven't fetched). Outside both, the paged directory is unchanged.
  const fullSetMode = userLoc != null || filtering;
  const didMount = useRef(false);

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

  // Re-run the search when the (debounced) query changes — but not on the
  // initial mount, which the effect above already covers. Uses `searching`, not
  // `status`, so the map + search bar stay on screen while results refresh.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName', search: search || undefined })
        .then((page) => {
          if (cancelled) return;
          setVenues(page.items);
          setCursor(page.cursor);
          setStatus('ready');
        })
        .catch(() => {
          /* keep the prior results visible rather than blanking the screen */
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // Load every venue for the map markers (all pages). Independent of the list
  // fetch above; a failure here just means fewer pins, not a screen error.
  useEffect(() => {
    let cancelled = false;
    listAllVenues({ sortBy: 'displayName' })
      .then((items) => {
        if (!cancelled) setMapVenues(items);
      })
      .catch(() => {
        /* leave the map empty; the list still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setStatus('loading');
    listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName', search: search || undefined })
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
    listVenues({ pageSize: PAGE_SIZE, sortBy: 'displayName', search: search || undefined, cursor })
      .then((page) => {
        setVenues((prev) => [...prev, ...page.items]);
        setCursor(page.cursor);
      })
      .catch(() => {
        /* keep what we have; the button stays available to retry */
      })
      .finally(() => setLoadingMore(false));
  };

  // Ask for the user's location, then sort courts by distance. Open to guests;
  // a signed-in user whose role lacks the permission just no-ops. Tapping again
  // recenters the map.
  const handleLocate = () => {
    if (locating) return;
    if (!canLocate) return;
    setLocating(true);
    setLocError(null);
    getCurrentLocation()
      .then((loc) => setUserLoc(loc))
      .catch((err: Error) => setLocError(err.message))
      .finally(() => setLocating(false));
  };

  // Turn distance sort back off and return to the A–Z directory.
  const clearLocation = () => {
    setUserLoc(null);
    setLocError(null);
  };

  // Auto-centre on the user when the tab opens, so the map focuses on their
  // location without tapping the locate button (client request). Runs once; the
  // browser still gates the geolocation permission prompt, and a denial just
  // surfaces `locError` as before. Re-fires only if `canLocate` flips true later
  // (e.g. after the session restores).
  const didAutoLocate = useRef(false);
  useEffect(() => {
    if (didAutoLocate.current || !canLocate || userLoc) return;
    didAutoLocate.current = true;
    handleLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLocate]);

  // Quick-chip toggles — each flips one corner of the same filter state the
  // sheet edits, so chips and sheet stay in sync.
  const toggleCourtType = (t: 'Indoor' | 'Outdoor') =>
    setFilters((f) => ({ ...f, courtType: f.courtType === t ? 'All' : t }));
  const toggleFree = () => setFilters((f) => ({ ...f, price: f.price === 'Free' ? 'Any' : 'Free' }));
  const toggleOpenPlay = () => setFilters((f) => ({ ...f, openPlay: !f.openPlay }));
  const toggleAmenity = (key: string) =>
    setFilters((f) => {
      const amenities = new Set(f.amenities);
      if (amenities.has(key)) amenities.delete(key);
      else amenities.add(key);
      return { ...f, amenities };
    });

  // The resolved "near me" list once located: attribute-filtered, search-matched,
  // ranked nearest-first, and limited to the chosen radius (with a nearest-few
  // fallback). Shared by the list and the map so both show the same courts.
  const nearby = useMemo<NearbyRow[] | null>(
    () => (userLoc ? resolveNearby(mapVenues.length ? mapVenues : venues, userLoc, filters, search) : null),
    [userLoc, mapVenues, venues, filters, search],
  );

  const cards = useMemo<VenueCard[]>(() => {
    // Located: show the courts near the user (already filtered + ranked + capped).
    if (nearby) return nearby.map((r) => ({ ...toVenueCard(r.v), distanceKm: r.distanceKm }));
    // Filtering without a location: narrow the full set (the paged list could
    // hide matches on pages we haven't fetched), keeping the name order.
    if (filtering) {
      const q = search.toLowerCase();
      const source = mapVenues.length ? mapVenues : venues;
      return source.flatMap((v) =>
        matchesQuery(v, q) && matchesFilters(v, filters) ? [{ ...toVenueCard(v), distanceKm: null }] : [],
      );
    }
    // Default: the server-paged directory, unchanged.
    return venues.map((v) => ({ ...toVenueCard(v), distanceKm: null }));
  }, [nearby, filtering, search, venues, mapVenues, filters]);

  // Map pins. Located → *every* locatable court (filter/search-matched), each
  // tagged with its distance from the user — the radius narrows the list, not the
  // map, so courts beyond it stay on the map (the user just zooms out to see
  // them). Filtering → the filtered full set. Otherwise → an active search's
  // paged matches, else every locatable court.
  const mapCards = useMemo<MapMarker[]>(() => {
    const q = search.toLowerCase();
    if (userLoc) {
      const source = mapVenues.length ? mapVenues : venues;
      return source.flatMap((v) => {
        if (!matchesQuery(v, q) || !matchesFilters(v, filters)) return [];
        const coords = venueCoords(v);
        return coords ? [toMapMarker(v, coords, haversineKm(userLoc, coords))] : [];
      });
    }
    if (filtering) {
      const source = mapVenues.length ? mapVenues : venues;
      return source.flatMap((v) => {
        if (!matchesQuery(v, q) || !matchesFilters(v, filters)) return [];
        const coords = venueCoords(v);
        return coords ? [toMapMarker(v, coords, null)] : [];
      });
    }
    const source = search ? venues : mapVenues;
    return source.flatMap((v) => {
      const coords = venueCoords(v);
      return coords ? [toMapMarker(v, coords, null)] : [];
    });
  }, [userLoc, filtering, search, venues, mapVenues, filters]);

  const mapPoints = useMemo<[number, number][]>(() => mapCards.map((c) => [c.lat, c.lng]), [mapCards]);
  // Just the nearby (radius / nearest-fallback) coords — used to frame the map
  // around the user so the nearby cluster is in view without losing the rest.
  const nearbyPoints = useMemo<[number, number][]>(
    () => (nearby ? nearby.map((r) => r.coords) : []),
    [nearby],
  );
  const mapCenter: [number, number] = userLoc ?? (mapCards[0] ? [mapCards[0].lat, mapCards[0].lng] : MAP_FALLBACK_CENTER);

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
      ) : cards.length === 0 && !search && !filtering ? (
        emptyUI
      ) : (
        <div className="map-screen">
          <div className="absolute inset-0">
            <MapContainer center={mapCenter} zoom={12} className="w-full h-full" zoomControl={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FrameMap userLoc={userLoc} radiusKm={filters.maxDistanceKm} nearbyPoints={nearbyPoints} allPoints={mapPoints} />
              {userLoc && (
                <CircleMarker
                  center={userLoc}
                  radius={8}
                  pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0040e0', fillOpacity: 1 }}
                />
              )}
              {mapCards.map((c) => (
                <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon}>
                  <Popup className="venue-popup" minWidth={224} maxWidth={224}>
                    <button
                      type="button"
                      className="venue-popup-card"
                      onClick={() => onNavigate('court-details', { id: c.id })}
                    >
                      <div
                        className="venue-popup-img"
                        style={c.image ? { backgroundImage: `url(${c.image})` } : undefined}
                      >
                        {!c.image && <Icon name="paddle" size={28} />}
                      </div>
                      <div className="venue-popup-body">
                        <div className="venue-popup-title">{c.name}</div>
                        <div className="venue-popup-meta">
                          {c.distanceKm != null && (
                            <>
                              <span className="font-extrabold text-[var(--primary)]">{formatDistance(c.distanceKm)}</span>
                              <span className="opacity-40">·</span>
                            </>
                          )}
                          {c.rating != null && (
                            <>
                              <Icon name="star" size={12} className="text-[#c89000]" /> {c.rating}
                              <span className="opacity-40">·</span>
                            </>
                          )}
                          <span className="truncate min-w-0">{c.location}</span>
                        </div>
                        <div className="venue-popup-foot">
                          <span className="venue-popup-price">{c.label}</span>
                          <span className="venue-popup-cta">
                            View <Icon name="chevron" size={12} />
                          </span>
                        </div>
                      </div>
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Search — live court search; filters the list + map markers */}
          <div className="map-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              className="map-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSheet('expanded')}
              placeholder="Find courts near you"
              aria-label="Search courts by name or area"
            />
            {query ? (
              <button
                type="button"
                className="map-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <Icon name="close" size={14} />
              </button>
            ) : (
              <Avatar src={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'Guest'} size={32} />
            )}
          </div>

          {/* Chip row — "Near me" toggles distance sort; the rest are filters */}
          <div className="map-chip-row">
            <button
              className={`chip ${userLoc ? 'active' : ''}`}
              onClick={userLoc ? clearLocation : handleLocate}
              disabled={locating}
              aria-pressed={!!userLoc}
            >
              <Icon name={locating ? 'spinner' : 'navigate'} size={12} className={locating ? 'animate-spin' : ''} />
              {locating ? 'Locating…' : 'Near me'}
            </button>
            <button className="chip lime">
              <Icon name="paddle" size={12} /> Courts
            </button>
            <button
              className={`chip ${filters.openPlay ? 'active' : ''}`}
              aria-pressed={filters.openPlay}
              onClick={toggleOpenPlay}
            >
              Games here
            </button>
            <button
              className={`chip ${filters.courtType === 'Indoor' ? 'active' : ''}`}
              aria-pressed={filters.courtType === 'Indoor'}
              onClick={() => toggleCourtType('Indoor')}
            >
              Indoor
            </button>
            <button
              className={`chip ${filters.price === 'Free' ? 'active' : ''}`}
              aria-pressed={filters.price === 'Free'}
              onClick={toggleFree}
            >
              Free
            </button>
            <button
              className={`chip ${filters.amenities.has('hasLighting') ? 'active' : ''}`}
              aria-pressed={filters.amenities.has('hasLighting')}
              onClick={() => toggleAmenity('hasLighting')}
            >
              Lighted
            </button>
          </div>

          {/* Floating control stack — always visible above the sheet */}
          <div
            className="absolute right-4 flex flex-col gap-2 z-[1100] transition-[bottom] duration-300 [transition-timing-function:cubic-bezier(0.4,0.0,0.2,1)]"
            style={{ bottom: sheetHeight + 12 }}
          >
            <button
              aria-label={userLoc ? 'Recenter on my location' : 'Use my location to sort courts'}
              aria-pressed={!!userLoc}
              onClick={handleLocate}
              disabled={locating}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center border-[0.5px] shadow-[var(--shadow-card)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] disabled:opacity-70 ${
                userLoc
                  ? 'bg-[var(--lime)] text-[var(--lime-ink)] border-transparent'
                  : 'bg-white/95 text-[var(--primary)] border-[var(--hairline)]'
              }`}
            >
              {/* Radar ping — draws the eye to the locate control until a
                  location is set; stops once active or while locating. */}
              {!userLoc && !locating && (
                <span className="absolute inset-0 rounded-xl bg-[var(--primary)]/40 animate-ping pointer-events-none motion-reduce:hidden" aria-hidden="true" />
              )}
              <Icon name={locating ? 'spinner' : 'navigate'} size={18} className={`relative ${locating ? 'animate-spin' : ''}`} />
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
                <div className="t-eyebrow">
                  {searching
                    ? 'Searching…'
                    : userLoc
                      ? `${cards.length} court${cards.length === 1 ? '' : 's'} near you`
                      : search
                        ? `${cards.length} result${cards.length === 1 ? '' : 's'}`
                        : filtering
                          ? `Filtered · ${cards.length} court${cards.length === 1 ? '' : 's'}`
                          : `Nearby · ${cards.length} courts`}
                </div>
                <div className="hd-2 mt-0.5">
                  {search
                    ? `“${query.trim()}”`
                    : userLoc
                      ? 'Courts near you'
                      : filtering
                        ? 'Filtered courts'
                        : 'Courts directory'}
                </div>
              </div>
              <button
                className={`chip ${activeFilterCount ? 'active' : 'bg-[var(--surface-2)]!'}`}
                onClick={() => setFilterOpen(true)}
              >
                <Icon name="sliders" size={12} /> Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}
              </button>
            </div>

            {locError && (
              <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-[var(--coral-soft)] text-[var(--coral)] text-[12px] font-semibold flex items-center gap-2">
                <Icon name="location" size={14} />
                <span className="flex-1">{locError}</span>
                <button type="button" onClick={() => setLocError(null)} aria-label="Dismiss">
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}

            <div className="list">
              {cards.length === 0 ? (
                <div className="py-8 px-3 text-center text-[var(--muted)] text-[13px] leading-relaxed">
                  {search
                    ? `No courts match “${query.trim()}”${filtering ? ' with those filters' : ''}.`
                    : 'No courts match those filters.'}
                  <br />
                  Try widening your search or filters.
                </div>
              ) : (
                cards.map((c, i) => (
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
                      {c.distanceKm != null && (
                        <>
                          <span className="font-extrabold text-[var(--primary)]">{formatDistance(c.distanceKm)}</span>
                          <span className="opacity-50">·</span>
                        </>
                      )}
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
                ))
              )}

              {!fullSetMode && cursor && (
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

          <NearbyFilterSheet
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            resultCount={cards.length}
            located={userLoc != null}
          />
        </div>
      )}
    </DemoBranch>
  );
}
