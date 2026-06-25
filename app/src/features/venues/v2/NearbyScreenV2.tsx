import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { listAllVenues, type ApiVenue } from '../../../shared/lib/api';
import { venueImage, priceLabel, locationLine, indoorLabel, venueCoords } from '../../../shared/lib/venueDisplay';
import { haversineKm, formatDistance, getCurrentLocation, type LatLng } from '../../../shared/lib/geo';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';

type SortKey = 'distance' | 'rating' | 'courts' | 'reviews' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  distance: 'Distance',
  rating: 'Rating',
  courts: 'Most Courts',
  reviews: 'Most Reviews',
  name: 'Name (A–Z)',
};

// Keep the rendered list bounded (each card loads an image); "nearby" only needs
// the closest handful, and the other sorts are a browse aid, not the full directory.
const VISIBLE = 30;

// Metro Manila — most seeded venues are here; used when none carry coords.
const MAP_FALLBACK_CENTER: [number, number] = [14.5995, 120.9842];

// Leaflet's default pin (served from unpkg, matching the v1 Nearby map).
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
const FEAT_GRADIENT = 'linear-gradient(160deg,#1a3a8f,#2a7fd4)';
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
function FrameMap({ userLoc, points, focusNonce, nearestId, markerRefs, collapsed, sheetRef }: {
  userLoc: LatLng | null;
  points: [number, number][];
  focusNonce: number;
  nearestId: string | null;
  markerRefs: { current: Record<string, L.Marker> };
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

  const frame = useCallback(() => {
    const covered = coveredPx();
    if (userLoc) {
      const nearest = points
        .map((p) => [p, haversineKm(userLoc, p)] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 4)
        .map(([p]) => p);
      // Start tight (~1.2km box) so a close cluster zooms right in; grow only to
      // include the nearest courts.
      let latSpan = 1.2 / 111;
      let lngSpan = 1.2 / (111 * Math.cos((userLoc[0] * Math.PI) / 180));
      for (const [lat, lng] of nearest) {
        latSpan = Math.max(latSpan, Math.abs(lat - userLoc[0]));
        lngSpan = Math.max(lngSpan, Math.abs(lng - userLoc[1]));
      }
      map.fitBounds(
        [
          [userLoc[0] - latSpan, userLoc[1] - lngSpan],
          [userLoc[0] + latSpan, userLoc[1] + lngSpan],
        ],
        { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + covered], maxZoom: 16 },
      );
      // Surface the closest court only when the map is the focus (list collapsed),
      // so an open list isn't covered by a popup in the thin visible strip.
      if (collapsed && nearestId) markerRefs.current[nearestId]?.openPopup();
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { paddingTopLeft: [48, 48], paddingBottomRight: [48, 48 + covered], maxZoom: 14 });
  }, [map, userLoc, points, nearestId, collapsed, coveredPx, markerRefs]);

  // Re-frame when the data changes (location arrives, "Near me" re-centre). The
  // sheet isn't animating in these cases, so the visible strip is already settled.
  // Held in a ref so this effect doesn't re-fire merely because `collapsed` (and
  // thus `frame`) changed — sheet toggles are handled by the transition listener.
  const frameRef = useRef(frame);
  useEffect(() => { frameRef.current = frame; });
  useEffect(() => { frameRef.current(); }, [userLoc, points, focusNonce, nearestId]);

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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(canLocate ? 'distance' : 'rating');
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'on' | 'denied'>(canLocate ? 'locating' : 'idle');
  // The list is the primary surface (open expanded, over the map) — the user
  // collapses the sheet to reveal the full map. Mirrors the v1 Nearby list-first UX.
  const [sheet, setSheet] = useState<SheetState>('expanded');
  // Bumped when the user taps "Near me" while already located, to re-centre the map.
  const [focusNonce, setFocusNonce] = useState(0);
  // Live Leaflet markers, keyed by venue id, so FrameMap can pop the nearest one.
  const markerRefs = useRef<Record<string, L.Marker>>({});
  // The list sheet element — FrameMap measures how much of the map it covers so
  // it can keep the user's location in the visible strip above it.
  const sheetRef = useRef<HTMLDivElement>(null);
  // Custom sort dropdown (replaces a native <select>, whose popup rendered
  // outside the device-preview frame). Anchored to its trigger; closes on
  // outside-click / Escape.
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Load the full venue set once (distance ranking needs every venue, not one page).
  useEffect(() => {
    let alive = true;
    listAllVenues()
      .then((items) => { if (alive) setAll(items); })
      .catch(() => { if (alive) setAll([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

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
      .then((loc) => { setUserLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  };
  // Auto-locate once on mount. locStatus already starts 'locating' (above), so the
  // effect body has no synchronous setState — only the async callbacks set state.
  useEffect(() => {
    if (!canLocate) return;
    getCurrentLocation()
      .then((loc) => { setUserLoc(loc); setLocStatus('on'); })
      .catch(() => setLocStatus('denied'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const distOf = (v: ApiVenue): number | null => {
    if (!userLoc) return null;
    const c = venueCoords(v);
    return c ? haversineKm(userLoc, c) : null;
  };

  // Distance sort needs a location; until we have one, fall back to rating order
  // so the list isn't arbitrary while the permission prompt is pending/denied.
  const effectiveSort: SortKey = sort === 'distance' && !userLoc ? 'rating' : sort;

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? all.filter((v) => v.displayName.toLowerCase().includes(q) || locationLine(v).toLowerCase().includes(q)) : all;
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
  }, [all, query, effectiveSort, userLoc]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = sorted.slice(0, VISIBLE);
  const featured = visible[0] ?? null;
  const rest = visible.slice(1);
  // In lobby mode, carry the intent into the court detail so the booking flow can
  // hand back to create-game once a court is reserved.
  const open = (v: ApiVenue) => onNavigate('court-details', { id: v.slug || v.id, intent });

  const distLabel = (v: ApiVenue) => {
    const d = distOf(v);
    return d != null ? formatDistance(d) : null;
  };

  // Map pins: every search-matched venue that resolves to coordinates (the map
  // shows them all; the radius/sort only narrows the *list*). Tagged with their
  // distance from the user when located, so popups can show it.
  const pins = useMemo<MapPin[]>(() => {
    const q = query.trim().toLowerCase();
    const base = q ? all.filter((v) => v.displayName.toLowerCase().includes(q) || locationLine(v).toLowerCase().includes(q)) : all;
    return base.flatMap((v) => {
      const c = venueCoords(v);
      return c ? [{ v, lat: c[0], lng: c[1], distanceKm: userLoc ? haversineKm(userLoc, c) : null }] : [];
    });
  }, [all, query, userLoc]);

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
    : locStatus === 'locating'
      ? 'Finding courts near you…'
      : sort === 'distance' && userLoc
        ? `${sorted.length} court${sorted.length === 1 ? '' : 's'} near you`
        : `${sorted.length} court${sorted.length === 1 ? '' : 's'}`;

  const collapsed = sheet === 'collapsed';
  const located = locStatus === 'on' && !!userLoc;
  // Distance is offered only to users who can locate (mirrors the list's fallback).
  const sortOptions: SortKey[] = canLocate
    ? ['distance', 'rating', 'courts', 'reviews', 'name']
    : ['rating', 'courts', 'reviews', 'name'];

  return (
    <V2Shell screen="v2-nearby" chrome={chrome}>
      <div className="nearby-map-screen">
        {/* Map — sits behind the list sheet; the user collapses the sheet to see it. */}
        <div className="nearby-map-layer">
          <MapContainer center={mapCenter} zoom={12} className="nearby-leaflet" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FrameMap userLoc={userLoc} points={mapPoints} focusNonce={focusNonce} nearestId={nearestId} markerRefs={markerRefs} collapsed={collapsed} sheetRef={sheetRef} />
            <CollapseOnMapClick onCollapse={() => setSheet('collapsed')} />
            {userLoc && (
              <CircleMarker
                center={userLoc}
                radius={8}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3355FF', fillOpacity: 1 }}
              />
            )}
            {pins.map((p) => (
              <Marker
                key={p.v.id}
                position={[p.lat, p.lng]}
                icon={markerIcon}
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
        </div>

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
            <span className="sheet-handle-label">{collapsed ? 'Show list' : 'Show map'}</span>
          </button>

          {/* Lobby mode: the user came to book a court so they can host a lobby. */}
          {intent === 'lobby' && (
            <div className="nearby-lobby-banner" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>Select a court to book — you’ll set up your lobby right after.</span>
            </div>
          )}


          <div className="section-head">
            <div>
              <div className="section-title">Nearby courts</div>
              <div className="section-sub">{subtitle}</div>
            </div>
            <div className="sort-row" ref={sortRef}>
              <span className="sort-label">Sort:</span>
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

          <div className="sheet-list">
            {/* Location off / denied → let the user retry, so Distance can rank by proximity. */}
            {canLocate && locStatus === 'denied' && sort === 'distance' && (
              <button onClick={locate} className="locate-retry">
                📍 Turn on location for nearest courts
              </button>
            )}

            {loading ? (
              <V2Skeleton variant="court-list" count={5} />
            ) : visible.length === 0 ? (
              <p className="feat-meta">No courts found{query ? ` for “${query}”` : ''}.</p>
            ) : (
              <>
                {/* Featured (top pick) */}
                {featured && (
                  <div className="featured-card" role="button" onClick={() => open(featured)}>
                    <div className="feat-photo-wrap">
                      <div style={{ width: '100%', height: 160, ...thumbStyle(featured, FEAT_GRADIENT) }} />
                      <div className="feat-badge-row">
                        <span className="feat-badge featured">⭐ Top Pick</span>
                        {featured.courtCount ? <span className="feat-badge courts">{featured.courtCount} Courts</span> : null}
                      </div>
                    </div>
                    <div className="feat-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="feat-name">{featured.displayName}</div>
                        {featured.googleRating != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{featured.googleRating.toFixed(1)}</span>
                            {featured.googleReviewCount ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>({featured.googleReviewCount})</span> : null}
                          </div>
                        )}
                      </div>
                      <div className="feat-meta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {distLabel(featured) ? <><strong style={{ color: 'var(--blue)' }}>{distLabel(featured)}</strong><span className="dot-sep">•</span></> : null}
                        {locationLine(featured)}
                        {indoorLabel(featured) ? <><span className="dot-sep">•</span><span style={{ color: '#166534', fontWeight: 600 }}>{indoorLabel(featured)}</span></> : null}
                      </div>
                    </div>
                  </div>
                )}

                {rest.length > 0 && <div className="divider-label"><span>More nearby</span></div>}

                {rest.map((v) => (
                  <div key={v.id} className="court-card" role="button" onClick={() => open(v)}>
                    <div className="card-inner">
                      <div className="card-thumb">
                        <div style={{ position: 'absolute', inset: 0, ...thumbStyle(v, CARD_GRADIENT) }} />
                        {priceLabel(v) ? <span className="thumb-badge fee">{priceLabel(v)}</span> : null}
                      </div>
                      <div className="card-body">
                        <div className="card-top">
                          <div className="court-name">{v.displayName}</div>
                          <div className="court-meta">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            {distLabel(v) ? <><strong style={{ color: 'var(--blue)' }}>{distLabel(v)}</strong> <span className="dot-sep">•</span> </> : null}
                            {locationLine(v)}
                          </div>
                          {v.googleRating != null && (
                            <div className="rating-row">
                              <svg className="star-icon" width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                              <span className="rating-num">{v.googleRating.toFixed(1)}</span>
                              {v.googleReviewCount ? <span className="rating-count">({v.googleReviewCount})</span> : null}
                            </div>
                          )}
                        </div>
                        <div className="attr-row">
                          {v.courtCount ? <span className="courts-badge">{v.courtCount} Court{v.courtCount === 1 ? '' : 's'}</span> : null}
                          {indoorLabel(v) ? <span className="attr-pill">{indoorLabel(v)}</span> : null}
                          {v.surfaceType ? <span className="attr-pill">{v.surfaceType}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {sorted.length > VISIBLE && (
                  <p className="feat-meta" style={{ textAlign: 'center', opacity: 0.7 }}>
                    Showing {sort === 'distance' && userLoc ? 'nearest' : 'top'} {VISIBLE} of {sorted.length}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
