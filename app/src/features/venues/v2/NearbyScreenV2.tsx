/// <reference types="leaflet.markercluster" />

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { NearbyFilterRow } from './NearbyFilterRow';
import { RecentVenuesSection } from './RecentVenuesSection';
import { VenueGridCard } from './VenueGridCard';
import { openSlotCount, venueArea, localToday, deriveRecentVenues } from './nearbyDisplay';
import { listAllVenues, batchVenueAvailability, listBookings, type ApiBooking, type ApiVenue } from '../../../shared/lib/api';
import { venueImage, priceLabel, locationLine, indoorLabel, venueCoords } from '../../../shared/lib/venueDisplay';
import { haversineKm, formatDistance, getCurrentLocation, homeCoords, type LatLng } from '../../../shared/lib/geo';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';

type SortKey = 'distance' | 'rating' | 'courts' | 'reviews' | 'name';

// Phrased as the ordering the player gets, not the field we sort on — the
// control doubles as the list's "Nearest first" caption.
const SORT_LABELS: Record<SortKey, string> = {
  distance: 'Nearest first',
  rating: 'Top rated',
  courts: 'Most courts',
  reviews: 'Most reviewed',
  name: 'A–Z',
};

// Keep the rendered list bounded (each card loads an image); "nearby" only needs
// the closest handful, and the other sorts are a browse aid, not the full directory.
const VISIBLE = 30;

// Metro Manila — most seeded venues are here; used when none carry coords.
const MAP_FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

// ---- Custom map pins (small dot + label) + cluster icon factory ----

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const venueIconCache = new Map<string, L.DivIcon>();
function venueIcon(name: string): L.DivIcon {
  let ic = venueIconCache.get(name);
  if (!ic) {
    ic = L.divIcon({
      className: 'venue-pin',
      html: `<span class="vp-dot"></span><span class="vp-label">${escapeHtml(name)}</span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10],
    });
    venueIconCache.set(name, ic);
  }
  return ic;
}

function createClusterIcon(cluster: { getChildCount(): number }): L.DivIcon {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : n < 50 ? 42 : 50;
  return L.divIcon({
    html: `<span>${n}</span>`,
    className: 'venue-cluster',
    iconSize: L.point(size, size, true),
  });
}

// Always returns a `backgroundImage` (the photo, else a gradient). We must NOT
// mix this with the `background` shorthand in the same style object: React sets
// `style.background = ''` for an undefined shorthand, which wipes backgroundImage.
function thumbStyle(v: ApiVenue, fallback: string): CSSProperties {
  const img = venueImage(v);
  return {
    backgroundImage: img ? `url(${img})` : fallback,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
const CARD_GRADIENT = 'linear-gradient(135deg,#E1E8FF,#E9EDFF)';

// A venue resolved to a map point (coords + its distance from the user, if known).
interface MapPin {
  v: ApiVenue;
  lat: number;
  lng: number;
  distanceKm: number | null;
}

// Frame the map. Once the user shares their location we keep *them* centred — a
// box symmetric about the user, grown to include the nearest few courts so the
// closest cluster is in view without the user drifting off-centre (mirrors v1
// Nearby). It also pops the nearest court's marker so that venue is surfaced.
// `focusNonce` lets the "Near me" button re-centre on demand. Without a location
// we fall back to framing all the court pins.
//
// The list sheet overlaps the map's lower edge, so we reserve the covered height
// as bottom padding: the user lands in the *visible* strip above the list (so
// their location stays in view while the list is open) and re-centres into the
// larger visible area as the sheet collapses.
function FrameMap({ userLoc, points, focusNonce, recenterNonce, nearestId, markerRefs, clusterRef, collapsed, sheetRef }: {
  userLoc: LatLng | null;
  points: [number, number][];
  focusNonce: number;
  recenterNonce: number;
  nearestId: string | null;
  markerRefs: { current: Record<string, L.Marker> };
  clusterRef: { current: L.MarkerClusterGroup | null };
  collapsed: boolean;
  sheetRef: { current: HTMLDivElement | null };
}) {
  const map = useMap();

  // How many pixels of the map's bottom are hidden behind the list sheet right now.
  const coveredPx = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return 0;
    const mapBottom = map.getContainer().getBoundingClientRect().bottom;
    return Math.max(0, mapBottom - sheet.getBoundingClientRect().top);
  }, [map, sheetRef]);

  const frame = useCallback((opts?: { tight?: boolean }) => {
    const covered = coveredPx();
    if (userLoc) {
      const cos = Math.cos((userLoc[0] * Math.PI) / 180);
      // The dedicated re-center ("tight") frames a small fixed box on the user so
      // it always zooms right in on them; the default frame starts ~1.2km and
      // grows to include the nearest courts (keeps court context on first locate).
      let latSpan: number;
      let lngSpan: number;
      if (opts?.tight) {
        latSpan = 0.6 / 111;
        lngSpan = 0.6 / (111 * cos);
      } else {
        const nearest = points
          .map((p) => [p, haversineKm(userLoc, p)] as const)
          .sort((a, b) => a[1] - b[1])
          .slice(0, 4)
          .map(([p]) => p);
        latSpan = 1.2 / 111;
        lngSpan = 1.2 / (111 * cos);
        for (const [lat, lng] of nearest) {
          latSpan = Math.max(latSpan, Math.abs(lat - userLoc[0]));
          lngSpan = Math.max(lngSpan, Math.abs(lng - userLoc[1]));
        }
      }
      map.fitBounds(
        [
          [userLoc[0] - latSpan, userLoc[1] - lngSpan],
          [userLoc[0] + latSpan, userLoc[1] + lngSpan],
        ],
        { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + covered], maxZoom: opts?.tight ? 17 : 16 },
      );
      // Surface the closest court only when it's declustered (on the map) and the
      // list is collapsed so an open popup isn't hidden. Deferred: fitBounds may
      // still be animating.
      const openNearest = () => {
        if (!collapsed || !nearestId) return;
        const marker = markerRefs.current[nearestId];
        const cg = clusterRef.current;
        if (!marker || !cg) return;
        if (cg.getVisibleParent(marker) === marker) marker.openPopup();
      };
      openNearest();
      map.once('moveend', openNearest);
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { paddingTopLeft: [48, 48], paddingBottomRight: [48, 48 + covered], maxZoom: 14 });
  }, [map, userLoc, points, nearestId, collapsed, coveredPx, markerRefs, clusterRef]);

  // Re-frame when the data changes (location arrives, "Near me" re-centre). The
  // sheet isn't animating in these cases, so the visible strip is already settled.
  // Held in a ref so this effect doesn't re-fire merely because `collapsed` (and
  // thus `frame`) changed — sheet toggles are handled by the transition listener.
  const frameRef = useRef(frame);
  useEffect(() => { frameRef.current = frame; });
  useEffect(() => { frameRef.current(); }, [userLoc, points, focusNonce, nearestId]);

  // The dedicated re-center button frames a tighter box on the user (zooms in more)
  // than the default nearest-courts framing. Nonce starts at 0 so this no-ops on mount.
  useEffect(() => { if (recenterNonce) frameRef.current({ tight: true }); }, [recenterNonce]);

  // The sheet height animates (300ms) when it expands/collapses; re-frame once it
  // settles so the user ends up centred in the new visible area.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const onEnd = (e: TransitionEvent) => {
      if (e.target === sheet && e.propertyName === 'height') frameRef.current();
    };
    sheet.addEventListener('transitionend', onEnd);
    return () => sheet.removeEventListener('transitionend', onEnd);
  }, [sheetRef]);

  return null;
}

// Tapping the visible map dismisses the list (which then re-centres on the user).
// A no-op when the list is already collapsed, so the map can be panned freely.
function CollapseOnMapClick({ onCollapse }: { onCollapse: () => void }) {
  useMapEvents({ click: () => onCollapse() });
  return null;
}

type SheetState = 'collapsed' | 'expanded';

export function NearbyScreenV2({ intent, ...chrome }: V2ScreenChrome & { intent?: 'lobby' }) {
  const { onNavigate } = chrome;
  const currentUser = useAuthStore((s) => s.user);
  // Guests may locate; signed-in users need the locate permission (mirrors v1 Nearby).
  const canLocate = !currentUser || userHasPermission(currentUser, 'player.venues.locate');

  const [all, setAll] = useState<ApiVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(canLocate ? 'distance' : 'rating');
  // Where we sort from. A live device fix wins; otherwise the home coordinates
  // saved at onboarding, so the list opens sorted by distance instead of waiting
  // on — or being defeated by — a GPS read that's slow, refused, or unavailable.
  // Derived, so a cold load picks the account up as soon as the session lands.
  const [liveLoc, setLiveLoc] = useState<LatLng | null>(null);
  const userLoc = liveLoc ?? homeCoords(currentUser);
  // Tracks the live read only. The UI keys "we have nowhere to sort from" off
  // `userLoc`, not this — a failed read is not a dead end when a home is on file.
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'on' | 'denied'>(canLocate ? 'locating' : 'idle');
  // The list is the primary surface (open expanded, over the map) — the user
  // collapses the sheet to reveal the full map. Mirrors the v1 Nearby list-first UX.
  const [sheet, setSheet] = useState<SheetState>('expanded');
  // Bumped when the user taps "Near me" while already located, to re-centre the map.
  const [focusNonce, setFocusNonce] = useState(0);
  const [recenterNonce, setRecenterNonce] = useState(0);
  // Live Leaflet markers, keyed by venue id, so FrameMap can pop the nearest one.
  const markerRefs = useRef<Record<string, L.Marker>>({});
  // Marker cluster group ref — FrameMap checks whether the nearest marker is
  // inside a cluster before opening its popup.
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  // Fullscreen toggle for the map — hides the sheet + search, fills the frame.
  const [mapFullscreen, setMapFullscreen] = useState(false);
  // The list sheet element — FrameMap measures how much of the map it covers so
  // it can keep the user's location in the visible strip above it.
  const sheetRef = useRef<HTMLDivElement>(null);
  // Custom sort dropdown (replaces a native <select>, whose popup rendered
  // outside the device-preview frame). Anchored to its trigger; closes on
  // outside-click / Escape.
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Filters: which date's availability the cards report, plus area / court type.
  const today = localToday();
  const [filterDate, setFilterDate] = useState<string>(today);
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  // Per-venue free-court counts, powering each card's "N slots open" badge, kept
  // with the date + venue set they were fetched for (see `availKey` below). A
  // card hides the badge rather than claim a venue we never actually checked is
  // fully booked.
  const [avail, setAvail] = useState<{ key: string; map: Map<string, number[]> | null; error: boolean } | null>(null);

  // The signed-in player's bookings — rolled up into the "played at recently"
  // rail once the venue directory lands (guests never fetch them).
  const [bookings, setBookings] = useState<ApiBooking[]>([]);

  // Load the full venue set once (distance ranking needs every venue, not one page).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    listAllVenues()
      .then((items) => { if (alive) setAll(items); })
      .catch(() => { if (alive) { setAll([]); setLoadError(true); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // The player's own booking history feeds the "played at recently" rail. Guests
  // have none, and a failure just hides the rail — it's a shortcut, not the page.
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    listBookings()
      .then((items) => { if (alive) setBookings(items); })
      .catch(() => { if (alive) setBookings([]); });
    return () => { alive = false; };
  }, [currentUser]);

  // "Near me": drop the list to focus the map, then zoom/centre on the user and
  // surface the nearest court (the framing + popup happen in FrameMap, keyed off
  // userLoc/focusNonce). If already located, just re-centre. Open to guests; a
  // signed-in user whose role lacks the permission no-ops.
  const locate = () => {
    if (!canLocate) return;
    const wasCollapsed = sheet === 'collapsed';
    setSheet('collapsed');
    // Already located: re-centre on the user. If the sheet was open it'll
    // re-frame as it collapses; if already collapsed there's no transition, so
    // nudge the nonce to force a re-frame.
    if (userLoc) { if (wasCollapsed) setFocusNonce((n) => n + 1); return; }
    setLocStatus('locating');
    getCurrentLocation()
      .then((loc) => { setLiveLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  };
  // Dedicated re-center: bumps recenterNonce regardless of sheet state, so the map
  // re-frames on the user (a tighter, more zoomed-in box) even when the sheet is expanded.
  const recenter = () => {
    if (!canLocate) return;
    if (!userLoc) { locate(); return; }
    setRecenterNonce((n) => n + 1);
  };

  // Auto-locate once on mount. locStatus already starts 'locating' (above), so the
  // effect body has no synchronous setState — only the async callbacks set state.
  useEffect(() => {
    if (!canLocate) return;
    getCurrentLocation()
      .then((loc) => { setLiveLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  }, [canLocate]);

  // Close the sort menu on an outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  const distOf = useCallback((v: ApiVenue): number | null => {
    if (!userLoc) return null;
    const c = venueCoords(v);
    return c ? haversineKm(userLoc, c) : null;
  }, [userLoc]);

  // Distance sort needs a location; until we have one, fall back to rating order
  // so the list isn't arbitrary while the permission prompt is pending/denied.
  const effectiveSort: SortKey = sort === 'distance' && !userLoc ? 'rating' : sort;

  // Area + court-type filters from the filter row. Availability is *reported* on
  // each card rather than filtered on, so a venue never silently disappears
  // because we couldn't check its calendar.
  const matchesFilters = useCallback((v: ApiVenue): boolean => {
    if (areaFilter && venueArea(v) !== areaFilter) return false;
    if (typeFilter && (v.indoorOutdoor || '').toLowerCase() !== typeFilter) return false;
    return true;
  }, [areaFilter, typeFilter]);

  // Every area present in the directory, for the "All areas" picker.
  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const v of all) { const a = venueArea(v); if (a) set.add(a); }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [all]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (q
      ? all.filter((v) => v.displayName.toLowerCase().includes(q) || locationLine(v).toLowerCase().includes(q))
      : all
    ).filter(matchesFilters);
    const copy = [...base];
    switch (effectiveSort) {
      case 'distance':
        // Locatable venues nearest-first; ones without coords sink to the end (by rating).
        return copy.sort((a, b) => {
          const da = distOf(a); const db = distOf(b);
          if (da == null && db == null) return (b.googleRating ?? 0) - (a.googleRating ?? 0);
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        });
      case 'name': return copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
      case 'courts': return copy.sort((a, b) => (b.courtCount ?? 0) - (a.courtCount ?? 0));
      case 'reviews': return copy.sort((a, b) => (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0));
      case 'rating':
      default: return copy.sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));
    }
  }, [all, query, effectiveSort, distOf, matchesFilters]);

  const visible = sorted.slice(0, VISIBLE);

  // Availability for exactly the venues on screen, on the chosen date — that's
  // what the "N slots open" badges report. Refetched when the date or the
  // visible set changes; the id list is joined so the effect keys off contents.
  const visibleIdKey = visible.map((v) => v.id).join(',');
  const availKey = `${filterDate}|${visibleIdKey}`;
  useEffect(() => {
    // Nothing on screen to check — leave the last result alone; no card reads it.
    if (!visibleIdKey) return;
    let alive = true;
    batchVenueAvailability(visibleIdKey.split(','), filterDate)
      .then((result) => {
        if (!alive) return;
        const map = new Map<string, number[]>();
        for (const v of result.venues) map.set(v.venueId, v.freeByHour);
        setAvail({ key: availKey, map, error: false });
      })
      // Leave the badges off rather than reporting a slot count we don't have.
      .catch(() => { if (alive) setAvail({ key: availKey, map: null, error: true }); });
    return () => { alive = false; };
  }, [visibleIdKey, filterDate, availKey]);

  // Stamping the result with the key it was fetched for means a superseded
  // request can't paint yesterday's slot counts onto today's cards — and it
  // gives us "loading" for free, without setting state inside the effect.
  const availFresh = avail?.key === availKey ? avail : null;
  const availByVenue = availFresh?.map ?? null;
  const availError = !!availFresh?.error;
  const availLoading = !!visibleIdKey && !availFresh;

  // Venues the player has played at, resolved against the directory for photos
  // and current rates.
  const venuesById = useMemo(() => new Map(all.map((v) => [v.id, v])), [all]);
  // Guarded on the user as well as the data: bookings aren't cleared on logout,
  // so this is what stops a signed-out view showing the last player's venues.
  const recentVenues = useMemo(
    () => (currentUser && bookings.length ? deriveRecentVenues(bookings, venuesById) : []),
    [currentUser, bookings, venuesById],
  );

  // In lobby mode, carry the intent into the court detail so the booking flow can
  // hand back to create-game once a court is reserved.
  const open = (v: ApiVenue) => onNavigate('court-details', {
    id: v.slug || v.id,
    intent,
    filterDate,
  });

  const distLabel = (v: ApiVenue) => {
    const d = distOf(v);
    return d != null ? formatDistance(d) : null;
  };

  // Map pins: every search/filter-matched venue that resolves to coordinates.
  // Tagged with distance from the user when located, so popups can show it.
  const pins = useMemo<MapPin[]>(() => {
    const q = query.trim().toLowerCase();
    const base = q ? all.filter((v) => v.displayName.toLowerCase().includes(q) || locationLine(v).toLowerCase().includes(q)) : all;
    return base.filter(matchesFilters).flatMap((v) => {
      const c = venueCoords(v);
      return c ? [{ v, lat: c[0], lng: c[1], distanceKm: userLoc ? haversineKm(userLoc, c) : null }] : [];
    });
  }, [all, query, userLoc, matchesFilters]);

  const mapPoints = useMemo<[number, number][]>(() => pins.map((p) => [p.lat, p.lng]), [pins]);
  const mapCenter: [number, number] = userLoc ?? (pins[0] ? [pins[0].lat, pins[0].lng] : MAP_FALLBACK_CENTER);

  // The closest locatable court to the user — its marker is popped on "Near me".
  const nearestId = useMemo<string | null>(() => {
    if (!userLoc || pins.length === 0) return null;
    let best = pins[0];
    for (const p of pins) if ((p.distanceKm ?? Infinity) < (best.distanceKm ?? Infinity)) best = p;
    return best.v.id;
  }, [userLoc, pins]);

  const subtitle = loading
    ? 'Loading…'
    // Only "finding" when we'd otherwise have nothing — with a saved home the
    // list is already sorted, and the live read just refines it in the background.
    : locStatus === 'locating' && !userLoc
      ? 'Finding courts near you…'
      : sort === 'distance' && userLoc
        ? `${sorted.length} court${sorted.length === 1 ? '' : 's'} near you`
        : `${sorted.length} court${sorted.length === 1 ? '' : 's'}`;

  const collapsed = sheet === 'collapsed';
  // We have somewhere to sort from — live fix or the saved home, either counts.
  const located = !!userLoc;
  // Distance is offered only to users who can locate (mirrors the list's fallback).
  const sortOptions: SortKey[] = canLocate
    ? ['distance', 'rating', 'courts', 'reviews', 'name']
    : ['rating', 'courts', 'reviews', 'name'];

  return (
    <V2Shell screen="v2-nearby" chrome={chrome}>
      <div className={`nearby-map-screen${mapFullscreen ? ' fullscreen' : ''}`}>
        {/* Map — sits behind the list sheet; the user collapses the sheet to see it. */}
        <div className="nearby-map-layer">
          <MapContainer center={mapCenter} zoom={12} className="nearby-leaflet" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FrameMap userLoc={userLoc} points={mapPoints} focusNonce={focusNonce} recenterNonce={recenterNonce} nearestId={nearestId} markerRefs={markerRefs} clusterRef={clusterRef} collapsed={collapsed} sheetRef={sheetRef} />
            <CollapseOnMapClick onCollapse={() => setSheet('collapsed')} />
            {userLoc && (
              <CircleMarker
                center={userLoc}
                radius={8}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3355FF', fillOpacity: 1 }}
              />
            )}
            <MarkerClusterGroup
              ref={clusterRef}
              chunkedLoading
              showCoverageOnHover={false}
              maxClusterRadius={55}
              iconCreateFunction={createClusterIcon}
            >
            {pins.map((p) => (
              <Marker
                key={p.v.id}
                position={[p.lat, p.lng]}
                icon={venueIcon(p.v.displayName)}
                ref={(m) => { if (m) markerRefs.current[p.v.id] = m; }}
              >
                <Popup className="nearby-popup" minWidth={220} maxWidth={220}>
                  <button type="button" className="np-card" onClick={() => open(p.v)}>
                    <div className="np-img" style={thumbStyle(p.v, CARD_GRADIENT)} />
                    <div className="np-body">
                      <div className="np-title">{p.v.displayName}</div>
                      <div className="np-meta">
                        {p.distanceKm != null && (
                          <><strong className="np-dist">{formatDistance(p.distanceKm)}</strong><span className="np-sep">•</span></>
                        )}
                        {p.v.googleRating != null && (
                          <><span className="np-star">★</span> {p.v.googleRating.toFixed(1)}<span className="np-sep">•</span></>
                        )}
                        <span className="np-loc">{locationLine(p.v)}</span>
                      </div>
                      <div className="np-foot">
                        <span className="np-price">{priceLabel(p.v) ?? indoorLabel(p.v) ?? 'Courts'}</span>
                        <span className="np-cta">View →</span>
                      </div>
                    </div>
                  </button>
                </Popup>
              </Marker>
            ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        {/* Floating search + locate, over the map's top edge */}
        <div className="nearby-search-float">
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input className="search-input" type="text" placeholder="Find a court…" aria-label="Search courts" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {canLocate && (
            <button
              type="button"
              className={`map-btn${located ? ' active' : ''}`}
              onClick={locate}
              disabled={locStatus === 'locating'}
              aria-pressed={located}
              aria-label={located ? 'Re-centre on my location' : 'Use my location to sort courts'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={locStatus === 'locating' ? 'spin' : ''}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
              {locStatus === 'locating' ? 'Locating…' : 'Near me'}
            </button>
          )}
          {canLocate && (
            <button type="button" className="map-icon-btn" onClick={recenter} disabled={locStatus === 'locating'} aria-label="Re-center map">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" /></svg>
            </button>
          )}
          <button type="button" className="map-icon-btn" onClick={() => setMapFullscreen(true)} aria-label="Full screen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
          </button>
        </div>

        {/* Fullscreen exit — sits on top of the fixed map layer */}
        {mapFullscreen && (
          <button type="button" className="map-fullscreen-exit" onClick={() => setMapFullscreen(false)} aria-label="Exit full-screen map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}

        {/* Fullscreen-only re-center — search-float is hidden in fullscreen */}
        {mapFullscreen && canLocate && (
          <button type="button" className="map-recenter-fs" onClick={recenter} disabled={locStatus === 'locating'} aria-label="Re-center map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" /></svg>
          </button>
        )}

        {/* List sheet — the primary surface; collapse it to reveal the map */}
        <div ref={sheetRef} className={`nearby-sheet ${collapsed ? 'collapsed' : 'expanded'}`}>
          <button
            type="button"
            className="sheet-handle"
            onClick={() => setSheet((s) => (s === 'collapsed' ? 'expanded' : 'collapsed'))}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show court list' : 'Show map'}
          >
            <span className="sheet-grip" aria-hidden="true" />
            <span className="sheet-handle-label">{collapsed ? 'Pull up for courts' : 'Pull down for map'}</span>
          </button>

          {/* Lobby mode: the user came to book a court so they can host a lobby. */}
          {intent === 'lobby' && (
            <div className="nearby-lobby-banner" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>Select a court to book — you’ll set up your lobby right after.</span>
            </div>
          )}

          <NearbyFilterRow
            date={filterDate}
            onDateChange={setFilterDate}
            minDate={today}
            area={areaFilter}
            areas={areas}
            onAreaChange={setAreaFilter}
            type={typeFilter}
            onTypeChange={setTypeFilter}
            loading={availLoading}
          />

          <div className="sheet-list">
            {/* Nowhere to rank from → let the user retry. Gated on `userLoc`, not
                just the failed read: with a saved home the list already ranks by
                proximity, so this would be offering to fix a working screen. */}
            {canLocate && locStatus === 'denied' && !userLoc && sort === 'distance' && (
              <button onClick={locate} className="locate-retry">
                📍 Turn on location for nearest courts
              </button>
            )}

            {availError && (
              <div className="feat-meta" style={{ color: 'var(--coral)', fontWeight: 600, padding: '0 0 8px' }}>
                Couldn't check availability — open-slot counts are hidden.
              </div>
            )}
            {loading ? (
              <V2Skeleton variant="court-list" count={5} />
            ) : loadError && all.length === 0 ? (
              <div className="feat-meta" style={{ textAlign: 'center', padding: '16px 0' }}>
                Couldn't load courts.{' '}
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>Try again</button>
              </div>
            ) : (
              <>
                <RecentVenuesSection
                  items={recentVenues}
                  onOpen={(target) => onNavigate('court-details', { id: target, intent, filterDate })}
                />

                <section className="nv-section">
                  <div className="section-head nv-section-head">
                    <div>
                      <div className="section-title">Nearby courts</div>
                      <div className="section-sub">{subtitle}</div>
                    </div>
                    <div className="nv-sort" ref={sortRef}>
                      <button
                        type="button"
                        className="sort-btn"
                        aria-haspopup="listbox"
                        aria-expanded={sortOpen}
                        aria-label={`Sort courts: ${SORT_LABELS[sort]}`}
                        onClick={() => setSortOpen((o) => !o)}
                      >
                        {SORT_LABELS[sort]}
                        <svg className="sort-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <span className="nv-sort-hint">tap a venue for courts</span>
                      {sortOpen && (
                        <ul className="sort-menu" role="listbox" aria-label="Sort courts">
                          {sortOptions.map((key) => (
                            <li key={key} role="option" aria-selected={sort === key}>
                              <button
                                type="button"
                                className={`sort-menu-item${sort === key ? ' active' : ''}`}
                                onClick={() => { setSort(key); setSortOpen(false); }}
                              >
                                {SORT_LABELS[key]}
                                {sort === key && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {visible.length === 0 ? (
                    <p className="feat-meta">
                      No courts found{query ? ` for “${query}”` : ''}
                      {areaFilter || typeFilter ? ' with these filters' : ''}.
                    </p>
                  ) : (
                    <div className="nv-grid">
                      {visible.map((v) => (
                        <VenueGridCard
                          key={v.id}
                          v={v}
                          distance={distLabel(v)}
                          slots={openSlotCount(availByVenue?.get(v.id))}
                          onOpen={() => open(v)}
                        />
                      ))}
                    </div>
                  )}

                  {sorted.length > VISIBLE && (
                    <p className="feat-meta" style={{ textAlign: 'center', opacity: 0.7 }}>
                      Showing {sort === 'distance' && userLoc ? 'nearest' : 'top'} {VISIBLE} of {sorted.length}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
