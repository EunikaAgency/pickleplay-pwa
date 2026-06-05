import { useState } from 'react';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { Toast } from '../../shared/components/ui/Toast';
import { Sparkline } from '../../shared/components/ui/Chart';
import { OwnerStat } from './components/OwnerStat';
import { VenueCard } from './components/VenueCard';
import { useOwnerDashboard, type OwnerBookingRow } from './hooks/useOwnerDashboard';
import { useAuthStore } from '../../shared/lib/authStore';
import { firstNameOf, userHasPermission } from '../../shared/lib/permissions';
import { updateBookingStatus } from '../../shared/lib/api';
import { money, prettyDate, to12h } from '../bookings/bookingDisplay';
import { pctChange } from './utils/ownerMetrics';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerHomeScreenProps {
  onNavigate: Navigate;
}

const HERO_GRADIENT = 'linear-gradient(135deg, #2455f4 0%, #5F7CFF 90%)';

// Inline pending-booking row with Confirm / Decline (owner home only).
function PendingRow({ row, onDone, notify }: { row: OwnerBookingRow; onDone: (id: string) => void; notify: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (status: 'confirmed' | 'cancelled') => {
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
    <div className="bg-[var(--surface)] rounded-[18px] p-3.5 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{row.userName || 'Player'}</div>
          <div className="t-sm truncate">{row.venueName} · {prettyDate(row.date)}{row.startTime ? ` · ${to12h(row.startTime)}` : ''}</div>
        </div>
        <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums shrink-0">{money(row.amount)}</div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button type="button" disabled={busy} onClick={() => act('confirmed')} className="h-9 px-4 rounded-2xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">Confirm</button>
        <button type="button" disabled={busy} onClick={() => act('cancelled')} className="h-9 px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--ink-2)] font-bold text-[13px] disabled:opacity-60">Decline</button>
      </div>
    </div>
  );
}

// Owner's Home tab — the owner dashboard rendered in the homepage design.
// Players/guests never see this (HomeScreenSwitch branches on owner.access).
export function OwnerHomeScreen({ onNavigate }: OwnerHomeScreenProps) {
  const user = useAuthStore((s) => s.user);
  const firstName = firstNameOf(user);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  const {
    canAnalytics, venues, status, retry, combined, combinedRevenueDaily,
    statsReady, glanceFor, pending, upcoming, removeBooking,
  } = useOwnerDashboard({ withBookings: canBookings });
  const [toast, setToast] = useState(false);

  const notify = () => { setToast(true); setTimeout(() => setToast(false), 1800); };
  const mom = pctChange(combined.month, combined.prevMonth);
  const pendingCount = canBookings ? pending.length : combined.pending;

  const quick: { icon: string; label: string; onPress: () => void }[] = [
    { icon: 'storefront', label: 'My venues', onPress: () => onNavigate('owner-venues') },
    ...(canBookings ? [{ icon: 'calendar', label: 'Bookings', onPress: () => onNavigate('owner-bookings') }] : []),
    ...(canAnalytics ? [{ icon: 'bar_chart', label: 'Insights', onPress: () => onNavigate('owner-insights') }] : []),
    ...(userHasPermission(user, 'owner.venues.create') ? [{ icon: 'plus', label: 'New venue', onPress: () => onNavigate('owner-new-venue') }] : []),
  ];

  const header = (
    <div className="app-header">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('profile')} aria-label="Open profile">
          <Avatar src={user?.avatarUrl} name={user?.displayName ?? 'Owner'} size={40} />
        </button>
        <div>
          <div className="font-heading font-extrabold text-[20px] tracking-[-0.01em] leading-tight text-[var(--primary)]">
            {firstName ? `Hey ${firstName} 👋` : 'Hey there 👋'}
          </div>
          <div className="text-[13px] text-[var(--muted)] mt-0.5">Here's how your venues are doing</div>
        </div>
      </div>
      <button
        onClick={() => onNavigate('notifications')}
        aria-label="Notifications"
        className="w-10 h-10 rounded-full bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] active:scale-95 transition-transform"
      >
        <Icon name="bell" size={18} />
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
          <ErrorState title="Couldn't load your dashboard" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom home-refined">
      {header}

      <div className="px-5 lg:px-0 mt-4 space-y-6 lg:space-y-8">
        {venues.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-[22px] p-6 text-center shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)]">
            <div className="hd-2">No venues yet</div>
            <div className="t-sm mt-1 mb-4">List your venue to start taking bookings and tracking revenue.</div>
            <button onClick={() => onNavigate('owner-new-venue')} className="h-12 px-6 rounded-full bg-[var(--primary)] text-white font-heading font-semibold text-[15px]">Create a venue</button>
          </div>
        ) : (
          <>
            {/* Revenue hero */}
            {canAnalytics && (
              <button
                onClick={() => onNavigate('owner-venues')}
                className="relative overflow-hidden rounded-[28px] p-5 lg:p-7 min-h-[190px] w-full flex flex-col justify-between text-left text-white shadow-[var(--shadow-pop)] active:scale-[0.99] transition-transform"
                style={{ background: HERO_GRADIENT }}
              >
                <div className="relative z-[2]">
                  <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase opacity-90">Revenue • This month</div>
                  <div className="mt-2 flex items-end gap-2.5">
                    <span className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.01em]">{statsReady ? money(combined.month) : '—'}</span>
                    {statsReady && (
                      <span className="inline-flex items-center gap-0.5 text-[13px] font-extrabold pb-0.5 opacity-95">
                        <Icon name={mom >= 0 ? 'trending_up' : 'trending_down'} size={15} />{mom >= 0 ? '+' : ''}{mom}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative z-[2] mt-5">
                  {combinedRevenueDaily.length > 1 && <Sparkline points={combinedRevenueDaily} color="rgba(255,255,255,0.92)" />}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[12px] opacity-90">{venues.length} venue{venues.length === 1 ? '' : 's'} · {statsReady ? money(combined.week) : '₱0'} this week</span>
                    <span className="h-10 px-5 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-extrabold text-[14px] inline-flex items-center">Manage venues</span>
                  </div>
                </div>
              </button>
            )}

            {/* Quick actions */}
            <div className="flex justify-start gap-3 lg:gap-5 overflow-x-auto scrollbar-none pb-1">
              {quick.map((q) => (
                <button key={q.label} onClick={q.onPress} className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-[var(--shadow-card)] active:scale-90 transition-transform bg-[var(--surface)] text-[var(--primary)] border-[0.5px] border-[var(--hairline)]">
                    <Icon name={q.icon} size={26} />
                  </div>
                  <span className="w-16 text-center text-[10px] font-extrabold tracking-[0.06em] uppercase leading-tight text-[var(--ink-2)]">{q.label}</span>
                </button>
              ))}
            </div>

            {/* Combined KPIs */}
            {canAnalytics && (
              <div className="grid grid-cols-2 gap-3">
                <OwnerStat label="Revenue this month" value={statsReady ? money(combined.month) : '—'} icon="payments" tone="primary" />
                <OwnerStat label="Revenue this week" value={statsReady ? money(combined.week) : '—'} icon="trending_up" tone="lime" />
                <OwnerStat label="Bookings today" value={statsReady ? combined.todayBookings : '—'} icon="calendar" tone="neutral" />
                <OwnerStat label="Awaiting approval" value={statsReady ? pendingCount : '—'} icon="bell" tone="coral" />
              </div>
            )}

            {/* Awaiting approval */}
            {canBookings && pending.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="hd-2">Awaiting approval</div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[var(--coral)]/15 text-[var(--coral)]">{pending.length}</span>
                </div>
                <div className="space-y-2.5">
                  {pending.slice(0, 5).map((b) => (
                    <PendingRow key={b.id} row={b} onDone={removeBooking} notify={notify} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming bookings */}
            {canBookings && upcoming.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="hd-2">Upcoming bookings</div>
                  <button className="text-[var(--primary)] font-bold text-[13px]" onClick={() => onNavigate('owner-bookings')}>View all</button>
                </div>
                <div className="space-y-2.5">
                  {upcoming.slice(0, 4).map((b) => (
                    <div key={b.id} className="bg-[var(--surface)] rounded-[18px] p-3.5 shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{b.userName || 'Player'}</div>
                        <div className="t-sm truncate">{b.venueName} · {prettyDate(b.date)}{b.startTime ? ` · ${to12h(b.startTime)}` : ''}</div>
                      </div>
                      <div className="font-semibold text-[14px] text-[var(--ink)] tabular-nums shrink-0">{money(b.amount)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Your venues */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="hd-2">Your venues</div>
                {venues.length > 4 && <button className="text-[var(--primary)] font-bold text-[13px]" onClick={() => onNavigate('owner-venues')}>View all</button>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {venues.slice(0, 4).map((v) => (
                  <VenueCard key={v.id || v.slug} venue={v} glance={glanceFor(v)} onOpen={() => onNavigate('owner-venue', { id: v.slug || v.id })} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
