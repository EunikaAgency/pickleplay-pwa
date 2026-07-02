import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { useOwnerDashboard, venueKey, type Glance } from './hooks/useOwnerDashboard';
import { venueCoords, locationLine, venueImage } from '../../shared/lib/venueDisplay';
import { money } from '../bookings/bookingDisplay';
import type { LatLng } from '../../shared/lib/geo';
import type { ApiVenue } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerNearbyScreenProps {
  onNavigate: Navigate;
}

// Metro Manila — fallback center when no venue resolves to coordinates.
const MAP_FALLBACK_CENTER: LatLng = [14.5995, 120.9842];

// Operational status of a venue *today*, derived from its glance numbers.
type OpsStatus = 'pending' | 'active' | 'quiet' | 'unknown';

const STATUS_META: Record<OpsStatus, { color: string; label: string }> = {
  pending: { color: '#e8a100', label: 'Needs approval' }, // amber — action waiting
  active: { color: '#2bb673', label: 'Active today' }, // green — bookings today
  quiet: { color: '#8a93a6', label: 'Quiet today' }, // slate — nothing today
  unknown: { color: '#0040e0', label: 'Your venue' }, // blue — no analytics access
};

function statusOf(glance: Glance | null): OpsStatus {
  if (!glance) return 'unknown';
  if (glance.pendingCount > 0) return 'pending';
  if (glance.todayCount > 0) return 'active';
  return 'quiet';
}

// The label inside a map pin — never "0".
// pending → pending count, active → today's bookings, quiet/unknown → empty (just a dot).
function pinLabel(status: OpsStatus, g: Glance | null): string {
  if (!g) return '';
  if (status === 'pending' && g.pendingCount > 0) return String(g.pendingCount);
  if (status === 'active' && g.todayCount > 0) return String(g.todayCount);
  return '';
}

// A colored map pin — number when there's activity, otherwise a clean coloured dot.
function pinIcon(status: OpsStatus, label: string): L.DivIcon {
  const { color } = STATUS_META[status];
  const hasLabel = label.length > 0;
  return L.divIcon({
    className: 'owner-ops-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${hasLabel ? '32' : '18'}px;height:${hasLabel ? '32' : '18'}px;border-radius:50%;background:${color};color:#fff;font-weight:800;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 7px rgba(0,64,224,.28)">${label}</div>`,
    iconSize: hasLabel ? [32, 32] : [18, 18],
    iconAnchor: hasLabel ? [16, 16] : [9, 9],
    popupAnchor: [0, -16],
  });
}

// Frame the map to all the owner's venue pins. Refits when the set changes.
function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [56, 56], maxZoom: 14 });
  }, [map, points]);
  return null;
}

// A venue resolved for the ops view: its pin point + today's glance + status.
interface VenueRow {
  venue: ApiVenue;
  coords: LatLng | null;
  glance: Glance | null;
  occupancyPct: number | null;
  status: OpsStatus;
}

// Sort by what needs attention: pending first, then most active, then quiet.
const STATUS_ORDER: Record<OpsStatus, number> = { pending: 0, active: 1, unknown: 2, quiet: 3 };
function byAttention(a: VenueRow, b: VenueRow): number {
  if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  return (b.glance?.todayRevenue ?? 0) - (a.glance?.todayRevenue ?? 0);
}

// Owner's Nearby tab — a "your venues" operations map. Players/guests get the
// player NearbyScreen; App.tsx branches on owner.market.view.
export function OwnerNearbyScreen({ onNavigate }: OwnerNearbyScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  const canCreate = userHasPermission(user, 'owner.venues.create');
  const canClaim = userHasPermission(user, 'owner.venues.claim');
  const { venues, status, retry, glanceFor, analyticsByVenue, canAnalytics } = useOwnerDashboard({
    withBookings: canBookings,
  });

  const rows = useMemo<VenueRow[]>(() => {
    const mapped = venues.map((venue) => {
      const glance = glanceFor(venue);
      const occ = analyticsByVenue[venueKey(venue)]?.kpis.occupancyPct.week ?? null;
      return { venue, coords: venueCoords(venue), glance, occupancyPct: occ, status: statusOf(glance) };
    });
    return mapped.sort(byAttention);
  }, [venues, glanceFor, analyticsByVenue]);

  const mappable = useMemo(() => rows.filter((r) => r.coords != null), [rows]);
  const points = useMemo<LatLng[]>(() => mappable.map((r) => r.coords as LatLng), [mappable]);
  const pendingTotal = useMemo(() => rows.reduce((n, r) => n + (r.glance?.pendingCount ?? 0), 0), [rows]);
  const missingCount = rows.length - mappable.length;
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToList = () => { listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Open a venue's console — jump straight to the Location editor when it has no
  // map pin yet, otherwise land on the overview.
  const openVenue = (r: VenueRow) =>
    onNavigate('owner-venue', r.coords ? { id: r.venue.slug || r.venue.id } : { id: r.venue.slug || r.venue.id, tab: 'location' });

  const header = (
    <div className="app-header">
      <div>
        <div className="font-heading font-extrabold text-[20px] tracking-[-0.01em] leading-tight text-[var(--primary)]">
          Your venues
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-0.5">
          {pendingTotal > 0 ? `${pendingTotal} booking${pendingTotal === 1 ? '' : 's'} awaiting approval` : 'Your courts at a glance'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canClaim && (
          <button
            onClick={() => onNavigate('claim-venue')}
            aria-label="Claim an existing venue"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--field-border)] bg-[var(--surface)] text-[var(--ink)] font-bold text-[13px] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
          >
            <Icon name="verified" size={15} /> Claim
          </button>
        )}
        {canCreate && (
          <button
            onClick={() => onNavigate('owner-new-venue')}
            aria-label="Create a venue"
            className="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-bold text-[13px] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
          >
            <Icon name="plus" size={16} /> Create
          </button>
        )}
      </div>
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 mt-4 space-y-3">
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
        <div className="px-5 mt-4">
          <ErrorState title="Couldn't load your venues" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
        </div>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 mt-6">
          <EmptyState
            icon="storefront"
            title="No venues yet"
            description="List a venue to see it on your map and track its bookings, approvals, and occupancy at a glance."
            action={{ label: 'Create a venue', onPress: () => onNavigate('owner-new-venue') }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom home-refined">
      {header}

      <div className="px-5 mt-4 space-y-5">
        <button
          type="button"
          onClick={() => onNavigate('owner-pricing')}
          className="sm:hidden w-full h-11 rounded-full bg-[#0d131b] text-white font-extrabold text-[13px] flex items-center justify-center gap-2 shadow-[var(--shadow-card)] active:scale-[0.98]"
        >
          <Icon name="bolt" size={16} /> Manage venues pricing
        </button>

        {/* Map of your venues — status pins, today's count inside each */}
        {mappable.length > 0 ? (
          <div className="rounded-[22px] overflow-hidden h-[42vh] min-h-[260px] shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)]">
            <MapContainer center={points[0] ?? MAP_FALLBACK_CENTER} zoom={12} className="w-full h-full" zoomControl={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitToPoints points={points} />
              {mappable.map((r) => (
                <Marker
                  key={r.venue.id}
                  position={r.coords as LatLng}
                  icon={pinIcon(r.status, pinLabel(r.status, r.glance))}
                >
                  <Popup className="venue-popup" minWidth={232} maxWidth={232}>
                    <div className="venue-popup-card !cursor-default">
                      <div className="venue-popup-body">
                        <div className="venue-popup-title">{r.venue.displayName}</div>
                        <div className="venue-popup-meta">
                          <span className="font-extrabold" style={{ color: STATUS_META[r.status].color }}>{STATUS_META[r.status].label}</span>
                        </div>
                        {r.glance && (
                          <div className="venue-popup-meta mt-1">
                            {r.glance.todayCount} today · {r.glance.pendingCount} pending
                            {r.occupancyPct != null ? ` · ${Math.round(r.occupancyPct)}% full` : ''}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => onNavigate('owner-venue', { id: r.venue.slug || r.venue.id })}
                            className="h-8 px-3 rounded-full bg-[var(--primary)] text-white font-bold text-[12px]"
                          >
                            Manage
                          </button>
                          {canBookings && (
                            <button
                              type="button"
                              onClick={() => onNavigate('owner-bookings', {})}
                              className="h-8 px-3 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] font-bold text-[12px]"
                            >
                              Bookings
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div className="card p-4 t-sm">
            Your venues don't have a map pin yet. Set a location in each venue's Location tab to see them here.
          </div>
        )}

        {/* Some venues have no map pin yet — nudge the owner to add one */}
        {missingCount > 0 && mappable.length > 0 && (
          <button
            type="button"
            onClick={scrollToList}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--coral-soft)] text-[var(--coral)] text-[12px] font-semibold w-full text-left active:scale-[0.99]"
          >
            <Icon name="location" size={14} />
            <span>
              {missingCount} {missingCount === 1 ? 'venue' : 'venues'} {missingCount === 1 ? "isn't" : "aren't"} on the map yet — tap to find {missingCount === 1 ? 'it' : 'them'}.
            </span>
          </button>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(['pending', 'active', 'quiet'] as OpsStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 t-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>

        {/* Venue list — attention-sorted; tap to open the console */}
        <section ref={listRef} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="hd-2">All venues</div>
            <span className="t-sm">{venues.length} venue{venues.length === 1 ? '' : 's'}</span>
          </div>

          {!canAnalytics && (
            <div className="t-sm px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)]">
              Live booking and occupancy stats need the analytics permission.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {rows.map((r) => {
              const g = r.glance;
              const img = venueImage(r.venue);
              return (
                <button
                  key={r.venue.id}
                  onClick={() => openVenue(r)}
                  className="flex flex-col text-left bg-[var(--surface)] rounded-[18px] overflow-hidden border border-[var(--field-border)] active:scale-[0.99] transition-transform"
                >
                  {/* Banner image — media-derived photo with a gradient + icon fallback (matches the home venue cards) */}
                  <div className="relative h-[92px]" style={{ background: 'linear-gradient(135deg,#0040e0,#6c83ff)' }}>
                    <span className="absolute inset-0 flex items-center justify-center text-white/40"><Icon name="storefront" size={32} /></span>
                    {img && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                    <span className="absolute right-2 top-2 rounded-full bg-white/92 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: STATUS_META[r.status].color }}>{STATUS_META[r.status].label}</span>
                  </div>
                  <div className="flex flex-col flex-1 p-3">
                    <div className="font-heading font-bold text-[15px] leading-tight text-[var(--ink)] truncate" style={{ fontFamily: "'Grandstander', cursive" }}>{r.venue.displayName}</div>
                    <div className="mt-0.5 flex items-center gap-1 t-sm min-w-0">
                      <Icon name="location" size={12} /> <span className="truncate">{locationLine(r.venue) || '—'}</span>
                    </div>
                    {r.coords == null && (
                      <span
                        className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--coral)] text-white self-start"
                        onClick={(e) => { e.stopPropagation(); onNavigate('owner-venue', { id: r.venue.slug || r.venue.id, tab: 'location' }); }}
                      >
                        <Icon name="location" size={12} /> Add location
                      </span>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-1 text-[12px]">
                      <span className="flex items-center gap-1 text-[var(--muted)] min-w-0 truncate">
                        <Icon name="storefront" size={13} /> {r.venue.courtCount ?? 0} court{r.venue.courtCount === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-0.5 font-extrabold text-[var(--primary)] flex-shrink-0">
                        Manage <Icon name="chevron" size={13} />
                      </span>
                    </div>
                    {g && (
                      <div className="mt-2 pt-2 border-t-[0.5px] border-[var(--hairline)] flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="text-[var(--muted)]"><span className="font-bold text-[var(--ink)] tabular-nums">{g.todayCount}</span> today</span>
                        {g.pendingCount > 0 && <span className="font-bold text-[var(--coral)] tabular-nums">{g.pendingCount} pending</span>}
                        {r.occupancyPct != null && <span className="text-[var(--muted)] tabular-nums">{Math.round(r.occupancyPct)}% full</span>}
                        <span className="w-full text-[var(--muted)]"><span className="font-bold text-[var(--ink)] tabular-nums">{money(g.todayRevenue)}</span> today</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
