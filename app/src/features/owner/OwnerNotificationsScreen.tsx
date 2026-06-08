import { useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { Toast } from '../../shared/components/ui/Toast';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { useOwnerDashboard, type OwnerBookingRow } from './hooks/useOwnerDashboard';
import { deriveOwnerNotifications, type OwnerNotif, type OwnerNotifKind } from './utils/ownerNotifications';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { updateBookingStatus } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerNotificationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type Filter = 'all' | OwnerNotifKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'booking', label: 'Bookings' },
  { id: 'game', label: 'Games' },
  { id: 'review', label: 'Reviews' },
];

const SEEN_KEY = 'pb-owner-notifs-seen';
const readSeen = (): number => {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v ? Date.parse(v) || 0 : 0;
  } catch {
    return 0;
  }
};

// Inline Confirm / Decline for a pending-approval booking notification.
// Mirrors PendingRow in OwnerHomeScreen (same updateBookingStatus + removeBooking).
function PendingActions({ booking, onDone, notify }: { booking: OwnerBookingRow; onDone: (id: string) => void; notify: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (status: 'confirmed' | 'cancelled') => {
    setBusy(true);
    try {
      await updateBookingStatus(booking.venueId || '', booking.id, {
        status,
        cancellationReason: status === 'cancelled' ? 'Declined by venue' : undefined,
      });
      onDone(booking.id);
      notify();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 mt-2.5">
      <button type="button" disabled={busy} onClick={() => act('confirmed')} className="h-9 px-4 rounded-2xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">Confirm</button>
      <button type="button" disabled={busy} onClick={() => act('cancelled')} className="h-9 px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--ink-2)] font-bold text-[13px] disabled:opacity-60">Decline</button>
    </div>
  );
}

// Unread indicator is the coral dot on the icon (`.notif.unread .ic::after`).
function NotifBody({ n }: { n: OwnerNotif }) {
  return (
    <>
      <div className={`ic ${n.tone}`}>
        <Icon name={n.icon} size={18} />
      </div>
      <div className="body">
        <div className="head font-semibold">{n.title}</div>
        {n.detail && <div className="text-[13px] text-[var(--muted)] mt-0.5 truncate">{n.detail}</div>}
        {n.timeLabel && <div className="time">{n.timeLabel}</div>}
      </div>
    </>
  );
}

// Owner-only notifications feed. Derived client-side from the owner dashboard
// data (bookings + games + reviews) — there is no notifications backend yet.
// Players never reach this (gated by owner.notifications.view; the owner home
// bell routes here instead of the player NotificationsScreen).
export function OwnerNotificationsScreen({ onNavigate, onBack }: OwnerNotificationsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canBookings = userHasPermission(user, 'owner.bookings.manage');
  const { status, retry, bookings, games, reviews, removeBooking } = useOwnerDashboard({
    withBookings: canBookings,
    withGames: true,
    withReviews: true,
    withAnalytics: false,
  });

  const [filter, setFilter] = useState<Filter>('all');
  const [seenAt, setSeenAt] = useState<number>(readSeen);
  const [toast, setToast] = useState(false);
  const notify = () => { setToast(true); setTimeout(() => setToast(false), 1800); };

  const notifs = useMemo(() => deriveOwnerNotifications({ bookings, games, reviews }), [bookings, games, reviews]);
  const isUnread = (n: OwnerNotif) => !!n.timestamp && n.timestamp.getTime() > seenAt;
  const unreadCount = useMemo(
    () => notifs.filter((n) => !!n.timestamp && n.timestamp.getTime() > seenAt).length,
    [notifs, seenAt],
  );
  const shown = filter === 'all' ? notifs : notifs.filter((n) => n.kind === filter);

  const markRead = () => {
    const now = new Date();
    try { localStorage.setItem(SEEN_KEY, now.toISOString()); } catch { /* ignore */ }
    setSeenAt(now.getTime());
  };

  const open = (n: OwnerNotif) => {
    const t = n.target;
    if (!t) return;
    if ('params' in t) onNavigate(t.id, t.params);
    else onNavigate(t.id);
  };

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Venue activity'}
        className="pb-3!"
        action={unreadCount > 0 ? <button onClick={markRead} className="more">Mark read</button> : undefined}
      />

      <div className="scroll-x px-5 pt-1 pb-2 flex gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
        ))}
      </div>

      {status === 'loading' ? (
        <div className="px-5"><LoadingSkeleton variant="list-row" count={5} /></div>
      ) : status === 'error' ? (
        <ErrorState title="Couldn't load notifications" message="We couldn't reach your venues. Tap to retry." onRetry={retry} />
      ) : shown.length === 0 ? (
        <EmptyState icon="bell" title="You're all caught up" description="No new venue activity. We'll surface bookings, games, and reviews here as they come in." />
      ) : (
        shown.map((n) =>
          n.booking ? (
            <div key={n.id} className={`notif ${isUnread(n) ? 'unread' : ''}`}>
              <div className={`ic ${n.tone}`}><Icon name={n.icon} size={18} /></div>
              <div className="body">
                <div className="head font-semibold">{n.title}</div>
                {n.detail && <div className="text-[13px] text-[var(--muted)] mt-0.5 truncate">{n.detail}</div>}
                {n.timeLabel && <div className="time">{n.timeLabel}</div>}
                <PendingActions booking={n.booking} onDone={removeBooking} notify={notify} />
              </div>
            </div>
          ) : (
            <button
              key={n.id}
              className={`notif w-full text-left bg-transparent ${n.target ? 'cursor-pointer' : 'cursor-default'} ${isUnread(n) ? 'unread' : ''}`}
              onClick={() => open(n)}
            >
              <NotifBody n={n} />
            </button>
          ),
        )
      )}

      <Toast message="Booking updated" show={toast} />
    </div>
  );
}
