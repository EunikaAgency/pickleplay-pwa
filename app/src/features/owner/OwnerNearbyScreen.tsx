import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { useOwnerDashboard, venueKey, type Glance } from './hooks/useOwnerDashboard';
import { venueCoords, locationLine } from '../../shared/lib/venueDisplay';
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

// A colored map pin showing today's booking count (blank when no analytics).
function pinIcon(status: OpsStatus, count: string): L.DivIcon {
  const { color } = STATUS_META[status];
  return L.divIcon({
    className: 'owner-ops-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${color};color:#fff;font-weight:800;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 7px rgba(0,64,224,.28)">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
          <ErrorState title="Couldn't load your venues" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
        </div>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="scroll safe-top safe-bottom home-refined">
        {header}
        <div className="px-5 lg:px-0 mt-6">
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

      <div className="px-5 lg:px-0 mt-4 space-y-5">
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
                  icon={pinIcon(r.status, r.glance ? String(r.glance.todayCount) : '')}
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
                              onClick={() => onNavigate('owner-bookings')}
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--coral-soft)] text-[var(--coral)] text-[12px] font-semibold">
            <Icon name="location" size={14} />
            <span className="flex-1">
              {missingCount} of {rows.length} venue{rows.length === 1 ? '' : 's'} {missingCount === 1 ? "isn't" : "aren't"} on the map yet — add a location below.
            </span>
          </div>
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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="hd-2">All venues</div>
            <span className="t-sm">{venues.length} venue{venues.length === 1 ? '' : 's'}</span>
          </div>

          {!canAnalytics && (
            <div className="t-sm px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)]">
              Live booking and occupancy stats need the analytics permission.
            </div>
          )}

          <div className="space-y-2.5">
            {rows.map((r) => {
              const g = r.glance;
              return (
                <button
                  key={r.venue.id}
                  onClick={() => openVenue(r)}
                  className="w-full text-left bg-[var(--surface)] rounded-[18px] p-3.5 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: STATUS_META[r.status].color }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{r.venue.displayName}</div>
                        <div className="t-sm truncate">{locationLine(r.venue) || '—'}</div>
                        {r.coords == null && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--coral-soft)] text-[var(--coral)]">
                            <Icon name="location" size={11} /> Not on map · add location
                          </span>
                        )}
                      </div>
                    </div>
                    {g && (
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums">{money(g.todayRevenue)}</div>
                        <div className="t-sm">
                          {g.todayCount} today{g.pendingCount > 0 ? ` · ${g.pendingCount} pending` : ''}
                          {r.occupancyPct != null ? ` · ${Math.round(r.occupancyPct)}%` : ''}
                        </div>
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
