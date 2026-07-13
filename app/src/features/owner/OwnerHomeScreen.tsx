import { useState, type ReactNode } from 'react';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { Toast } from '../../shared/components/ui/Toast';
import { Sparkline } from '../../shared/components/ui/Chart';
import { useOwnerDashboard, type OwnerBookingRow } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { useNotificationStore } from '../../shared/lib/notificationStore';
import { firstNameOf, userHasPermission } from '../../shared/lib/permissions';
import { updateBookingStatus } from '../../shared/lib/api';
import { OwnerBookingDetailSheet } from './OwnerBookingDetailSheet';
import { money, prettyDate, to12h } from '../bookings/bookingDisplay';
import { pctChange } from './utils/ownerMetrics';
import { getInitials } from '../../shared/lib/initials';
import { locationLine, venueImage } from '../../shared/lib/venueDisplay';
import type { Navigate } from '../../shared/lib/navigation';
import type { ApiVenue } from '../../shared/lib/api';
import type { Glance } from './hooks/useOwnerDashboard';

interface OwnerHomeScreenProps {
  onNavigate: Navigate;
}

// ── Inline stroke icons (Lucide-style, matching the v2.1 player design) ──
type IcoProps = { size?: number };
const Bell = ({ size = 22 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);
const Chevron = ({ size = 14 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);
const TrendUp = ({ size = 16 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
);
const Storefront = ({ size = 24 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h0M9 12h0M9 15h0" /></svg>
);
const CalendarIco = ({ size = 24 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);
const Plus = ({ size = 24 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const FrontDeskIco = ({ size = 24 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8" /><rect x="9" y="2" width="6" height="4" rx="1" /><rect x="4" y="6" width="16" height="16" rx="2" /><path d="M8 11h8M8 15h6" /></svg>
);
const CardIco = ({ size = 18 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
);
const PinIco = ({ size = 13 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
const CourtIco = ({ size = 14 }: IcoProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /></svg>
);

const QA_ICONS: Record<string, ReactNode> = { storefront: <Storefront />, calendar: <CalendarIco />, plus: <Plus />, frontdesk: <FrontDeskIco />, settlements: <CardIco /> };
const QA_TONES = ['ohome-qa-lime', 'ohome-qa-blue', 'ohome-qa-neutral', 'ohome-qa-neutral'];

// Inline pending-booking row with Confirm / Decline (owner home only).
// Tapping the card body opens the full detail sheet.
function PendingRow({ row, onDone, notify, onOpen }: { row: OwnerBookingRow; onDone: (id: string) => void; notify: () => void; onOpen: (b: OwnerBookingRow) => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (e: React.MouseEvent, status: 'confirmed' | 'cancelled') => {
    e.stopPropagation(); // don't open the detail sheet on button taps
    setBusy(true);
    try {
      await updateBookingStatus(row.venueId || '', row.id, { status, cancellationReason: status === 'cancelled' ? 'Declined by venue' : undefined });
      onDone(row.id);
      notify();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="ohome-row ohome-row-tappable" onClick={() => onOpen(row)}>
      <div className="ohome-row-top">
        <div className="min-w-0">
          <div className="ohome-row-name truncate">{row.userName || 'Player'}</div>
          <div className="ohome-row-sub truncate">{row.venueName} · {prettyDate(row.date)}{row.startTime ? ` · ${to12h(row.startTime)}` : ''}</div>
        </div>
        <div className="ohome-row-amount tabular-nums">{money(row.amount)}</div>
      </div>
      <div className="ohome-row-actions">
        <button type="button" disabled={busy} onClick={(e) => act(e, 'confirmed')} className="ohome-btn-confirm">Confirm</button>
        <button type="button" disabled={busy} onClick={(e) => act(e, 'cancelled')} className="ohome-btn-decline">Decline</button>
      </div>
    </div>
  );
}

// Inline v2.1 venue card (owner home only) — image/state badges, name/location,
// court count, plus the optional business glance. Keeps OwnerVenuesScreen's
// shared VenueCard untouched while the home dashboard wears the player design.
function VenueGlanceCard({ venue, glance, onOpen }: { venue: ApiVenue; glance: Glance | null; onOpen: () => void }) {
  const img = venueImage(venue);
  const state = venue.state || 'unclaimed';
  return (
    <button type="button" onClick={onOpen} className="ohome-venue">
      <div className="ohome-venue-media">
        {img ? (
          <img src={img} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <CourtIco size={40} />
        )}
        <div className="ohome-venue-badges">
          <span className="ohome-badge ohome-badge-state">{state}</span>
          {venue.isVerified && <span className="ohome-badge ohome-badge-verified">Verified</span>}
        </div>
      </div>
      <div className="ohome-venue-body">
        <div className="ohome-venue-name">{venue.displayName}</div>
        <div className="ohome-venue-loc"><PinIco /> {locationLine(venue) || '—'}</div>
        <div className="ohome-venue-foot">
          <span className="ohome-venue-courts"><CourtIco /> {venue.courtCount ?? 0} courts</span>
          {glance && (
            <>
              <span className="ohome-muted"><b className="tabular-nums">{glance.todayCount}</b> today</span>
              {glance.pendingCount > 0 && <span className="ohome-pending tabular-nums">{glance.pendingCount} pending</span>}
              <span className="ohome-muted"><b className="tabular-nums">{money(glance.todayRevenue)}</b> today</span>
            </>
          )}
          <span className="ohome-venue-manage">Manage <Chevron /></span>
        </div>
      </div>
    </button>
  );
}

// Owner's Home tab — the owner dashboard rendered in the player's v2.1 design.
// Content/logic is unchanged; only the visual language (fonts/colors/spacing/
// cards) was swapped to match the player home. Players/guests never see this
// (App.tsx branches the Home tab on owner.access).
export function OwnerHomeScreen({ onNavigate }: OwnerHomeScreenProps) {
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationStore((s) => s.unread);
  const firstName = firstNameOf(user);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  // The cross-venue report at /owner/reports is owner-only; staff work bookings
  // through the front desk, calendar, and per-venue inbox instead.
  const canReports = userHasPermission(user, 'owner.reports.view');
  const {
    venues, status, retry, combined, combinedRevenueDaily,
    monthBookings, structural, statsReady, glanceFor, pending, upcoming, removeBooking,
  } = useOwnerDashboard({ withBookings: canBookings });
  const [toast, setToast] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBookingRow | null>(null);

  const notify = () => { setToast(true); setTimeout(() => setToast(false), 1800); };
  const mom = pctChange(combined.month, combined.prevMonth);
  const pendingCount = canBookings ? pending.length : combined.pending;

  const quick: { icon: string; label: string; onPress: () => void }[] = [
    { icon: 'storefront', label: 'My venues', onPress: () => onNavigate('owner-venues') },
    ...(canBookings ? [{ icon: 'frontdesk', label: 'Front desk', onPress: () => onNavigate('owner-front-desk', {}) }] : []),
    ...(canReports ? [{ icon: 'calendar', label: 'Bookings', onPress: () => onNavigate('owner-bookings', {}) }] : []),
    // { icon: 'settlements', label: 'Settlements', onPress: () => onNavigate('owner-settlements') },
    // ...(userHasPermission(user, 'owner.venues.create') ? [{ icon: 'plus', label: 'New venue', onPress: () => onNavigate('owner-new-venue') }] : []),
  ];

  const topnav = (
    <header className="ohome-topnav">
      <div className="ohome-topnav-inner">
        <span style={{ width: 40 }} aria-hidden="true" />
        <button className="ohome-brand" onClick={() => onNavigate('owner-venues')} aria-label="My venues">Pickle<span>Ballers</span></button>
        <button
          onClick={() => onNavigate('notifications')}
          aria-label="Notifications"
          className="ohome-iconbtn"
        >
          <Bell />
          {unread > 0 && (
            <span className="v2c-notif-badge" aria-label={`${unread} unread notifications`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>
    </header>
  );

  const hero = (
    <section className="ohome-hero">
      <div className="ohome-hero-inner">
        <div className="ohome-hero-text">
          <h1>{firstName ? `Hey ${firstName} 👋` : 'Hey there 👋'}</h1>
          <p>Here's how your venues are doing.</p>
          {venues.length > 0 && (
            <div className="ohome-live-chip">
              <span className="ohome-live-dot" />
              {venues.length} venue{venues.length === 1 ? '' : 's'}
              {canBookings && statsReady ? ` · ${combined.todayBookings} booking${combined.todayBookings === 1 ? '' : 's'} today` : ''}
            </div>
          )}
        </div>
        <button className="ohome-mascot" onClick={() => onNavigate('profile')} aria-label="Open profile">
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover rounded-full" />
            : user ? getInitials(user.displayName) : '👋'}
        </button>
      </div>
    </section>
  );

  if (status === 'loading') {
    return (
      <div className="pb-v2 v2-owner-home">
        {topnav}
        {hero}
        <div className="ohome-container" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LoadingSkeleton variant="block" count={1} />
          <LoadingSkeleton variant="card" count={3} />
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="pb-v2 v2-owner-home">
        {topnav}
        {hero}
        <div className="ohome-container" style={{ marginTop: 16 }}>
          <ErrorState title="Couldn't load your dashboard" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-v2 v2-owner-home">
      {topnav}
      {hero}

      {venues.length === 0 ? (
        <div className="ohome-container">
          <div className="ohome-empty">
            <h2>No venues yet</h2>
            <p>List your venue to start taking bookings and tracking revenue.</p>
            <button className="ohome-empty-btn" onClick={() => onNavigate('owner-new-venue')}>Create a venue</button>
          </div>
        </div>
      ) : (
        <div className="ohome-container">
          {/* Revenue hero → v2.1 blue stats-banner. Gated on owner.reports.view,
              not owner.analytics.view: this is the business-wide revenue headline,
              which is the owner's business — staff hold analytics (they need the
              per-venue operational numbers) but not reports. */}
          {canReports && (
            <button className="ohome-revenue" onClick={() => onNavigate('owner-venues')}>
              <div className="ohome-rb-eyebrow">Revenue • This month</div>
              <div className="ohome-rb-amount-row">
                <span className="ohome-rb-amount">{statsReady ? money(combined.month) : '—'}</span>
                {statsReady && (
                  <span className="ohome-rb-delta">
                    <TrendUp size={14} />{mom >= 0 ? '+' : ''}{mom}%
                  </span>
                )}
              </div>
              {combinedRevenueDaily.length > 1 && (
                <div className="ohome-rb-spark"><Sparkline points={combinedRevenueDaily} color="rgba(255,255,255,0.92)" /></div>
              )}
              <div className="ohome-rb-foot">
                <div className="ohome-rb-meta">
                  <span><b>{statsReady ? monthBookings : 0} booking{monthBookings === 1 ? '' : 's'}</b> this month</span>
                  <span>{venues.length} venue{venues.length === 1 ? '' : 's'} · {structural.courts} court{structural.courts === 1 ? '' : 's'} · <b>{statsReady ? money(combined.week) : '₱0'}</b> this week</span>
                </div>
                <span className="ohome-rb-btn">Manage my venues</span>
              </div>
            </button>
          )}

          {/* Quick actions */}
          <section className="ohome-qa" aria-label="Quick actions">
            {quick.map((q, i) => (
              <button key={q.label} onClick={q.onPress} className={`ohome-qa-card ${QA_TONES[i] ?? 'ohome-qa-neutral'}`}>
                <span className="ohome-qa-icon">{QA_ICONS[q.icon]}</span>
                <span className="ohome-qa-label">{q.label}</span>
              </button>
            ))}
          </section>

          {/* My revenue (combined KPIs). Gated on owner.reports.view, not
              owner.analytics.view: these are the owner's business-wide takings, so
              staff don't get the section at all. They lose only the two counters —
              the live approval queue and the bookings list below are untouched, so
              the work itself is unaffected. */}
          {canReports && (
            <section className="ohome-section">
              <div className="ohome-section-head">
                <h2>My revenue</h2>
                <button className="ohome-pill-link" onClick={() => onNavigate('owner-insights')} aria-label="See insights">
                  Insights <Chevron />
                </button>
              </div>
              <div className="ohome-kpi-grid">
                <button className="ohome-kpi" onClick={() => onNavigate('owner-insights')}>
                  <span className="ohome-kpi-icon ohome-kpi-ic-primary"><CardIco /></span>
                  <span className="ohome-kpi-value">{statsReady ? money(combined.month) : '—'}</span>
                  <span className="ohome-kpi-label">Revenue this month</span>
                </button>
                <button className="ohome-kpi" onClick={() => onNavigate('owner-insights')}>
                  <span className="ohome-kpi-icon ohome-kpi-ic-lime"><TrendUp size={18} /></span>
                  <span className="ohome-kpi-value">{statsReady ? money(combined.week) : '—'}</span>
                  <span className="ohome-kpi-label">Revenue this week</span>
                </button>
                <button className="ohome-kpi" onClick={() => onNavigate('owner-bookings', {})}>
                  <span className="ohome-kpi-icon ohome-kpi-ic-neutral"><CalendarIco size={18} /></span>
                  <span className="ohome-kpi-value">{statsReady ? combined.todayBookings : '—'}</span>
                  <span className="ohome-kpi-label">Bookings today</span>
                </button>
                <button className="ohome-kpi" onClick={() => onNavigate('owner-bookings', { status: 'pending_approval' })}>
                  <span className="ohome-kpi-icon ohome-kpi-ic-coral"><Bell size={18} /></span>
                  <span className="ohome-kpi-value">{statsReady ? pendingCount : '—'}</span>
                  <span className="ohome-kpi-label">Awaiting approval</span>
                </button>
              </div>
            </section>
          )}

          {/* Awaiting approval */}
          {canBookings && pending.length > 0 && (
            <section className="ohome-section">
              <div className="ohome-section-head">
                <h2>Awaiting approval</h2>
                <span className="ohome-count-pill">{pending.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.slice(0, 5).map((b) => (
                  <PendingRow key={b.id} row={b} onDone={removeBooking} notify={notify} onOpen={setSelectedBooking} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming bookings */}
          {canBookings && upcoming.length > 0 && (
            <section className="ohome-section">
              <div className="ohome-section-head">
                <h2>Bookings</h2>
                {canReports && <button className="ohome-see-all" onClick={() => onNavigate('owner-bookings', {})}>View all</button>}
              </div>
              <div className="ohome-scrollbox">
                <div className="ohome-scrollbox-inner">
                  {upcoming.slice(0, 10).map((b) => (
                    <div key={b.id} className="ohome-row">
                      <div className="ohome-row-top">
                        <div className="min-w-0">
                          <div className="ohome-row-name truncate">{b.userName || 'Player'}</div>
                          <div className="ohome-row-sub truncate">{b.venueName} · {prettyDate(b.date)}{b.startTime ? ` · ${to12h(b.startTime)}` : ''}</div>
                        </div>
                        <div className="ohome-row-amount tabular-nums">{money(b.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {upcoming.length > 4 && <div className="ohome-scrollfade" />}
              </div>
            </section>
          )}

          {/* Your venues */}
          <section className="ohome-section">
            <div className="ohome-section-head">
              <h2>My venues</h2>
              {venues.length > 6 && <button className="ohome-see-all" onClick={() => onNavigate('owner-venues')}>View all</button>}
            </div>
            <div className="ohome-venue-grid">
              {venues.slice(0, 6).map((v) => (
                <VenueGlanceCard key={v.id || v.slug} venue={v} glance={glanceFor(v)} onOpen={() => onNavigate('owner-venue', { id: v.slug || v.id })} />
              ))}
            </div>
          </section>
        </div>
      )}

      <Toast message="Booking updated" show={toast} />
      <OwnerBookingDetailSheet
        booking={selectedBooking}
        canManage
        onClose={() => setSelectedBooking(null)}
        onChanged={(updated) => {
          if (updated.status === 'cancelled') {
            removeBooking(updated.id);
          } else {
            // Replace the booking in local state so the row reflects the new status
            setSelectedBooking(updated);
          }
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
}
