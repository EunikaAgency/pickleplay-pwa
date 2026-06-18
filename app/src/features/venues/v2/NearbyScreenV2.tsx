import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { listAllVenues, type ApiVenue } from '../../../shared/lib/api';
import { venueImage, priceLabel, locationLine, indoorLabel, venueCoords } from '../../../shared/lib/venueDisplay';
import { haversineKm, formatDistance, getCurrentLocation, type LatLng } from '../../../shared/lib/geo';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';

type SortKey = 'distance' | 'rating' | 'courts' | 'reviews' | 'name';

// Keep the rendered list bounded (each card loads an image); "nearby" only needs
// the closest handful, and the other sorts are a browse aid, not the full directory.
const VISIBLE = 30;

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

export function NearbyScreenV2(chrome: V2ScreenChrome) {
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

  // Load the full venue set once (distance ranking needs every venue, not one page).
  useEffect(() => {
    let alive = true;
    listAllVenues()
      .then((items) => { if (alive) setAll(items); })
      .catch(() => { if (alive) setAll([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Best-effort: ask for the user's location on mount so "Distance" (the default)
  // can rank by proximity. Denial just falls back to the rating order. (Used by
  // the retry button — synchronous setState is fine in a click handler.)
  const locate = () => {
    if (!canLocate) return;
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
  const open = (v: ApiVenue) => onNavigate('court-details', { id: v.slug || v.id });

  const distLabel = (v: ApiVenue) => {
    const d = distOf(v);
    return d != null ? formatDistance(d) : null;
  };

  const subtitle = loading
    ? 'Loading…'
    : locStatus === 'locating'
      ? 'Finding courts near you…'
      : sort === 'distance' && userLoc
        ? `${sorted.length} court${sorted.length === 1 ? '' : 's'} near you`
        : `${sorted.length} court${sorted.length === 1 ? '' : 's'}`;

  return (
    <V2Shell screen="v2-nearby" chrome={chrome}>
      {/* Search */}
      <div className="search-section">
        <div className="search-row" style={{ position: 'relative' }}>
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input className="search-input" type="text" placeholder="Find a court…" aria-label="Search courts" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Courts / Games toggle */}
      <div className="tab-toggle">
        <div className="toggle-track" role="tablist">
          <button className="toggle-btn active" role="tab" aria-selected="true">Courts</button>
          <button className="toggle-btn" role="tab" aria-selected="false" onClick={() => onNavigate('games')}>Games</button>
        </div>
      </div>

      <div className="scroll-body">
        <div className="section-head">
          <div>
            <div className="section-title">Nearby courts</div>
            <div className="section-sub">{subtitle}</div>
          </div>
          <div className="sort-row">
            <span className="sort-label">Sort:</span>
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort courts">
              {canLocate && <option value="distance">Distance</option>}
              <option value="rating">Rating</option>
              <option value="courts">Most Courts</option>
              <option value="reviews">Most Reviews</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Location off / denied → let the user retry, so Distance can rank by proximity. */}
        {canLocate && locStatus === 'denied' && sort === 'distance' && (
          <button
            onClick={locate}
            style={{ alignSelf: 'flex-start', background: 'none', border: '1.5px solid var(--blue)', borderRadius: 'var(--r-pill)', color: 'var(--blue)', fontSize: 13, fontWeight: 600, padding: '7px 14px', cursor: 'pointer' }}
          >
            📍 Turn on location for nearest courts
          </button>
        )}

        {loading ? (
          <p className="feat-meta">Loading courts…</p>
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
    </V2Shell>
  );
}
