import { useState } from 'react';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { startConversation, updateBookingStatus, type ApiBooking, type BookingStatus } from '../../../shared/lib/api';
import { countdownLabel, deadlineUrgency, money, prettyDate, to12h, statusChip } from '../../bookings/bookingDisplay';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { StatusChip } from '../../../shared/components/ui/StatusChip';
import { Icon } from '../../../shared/components/ui/Icon';
import type { Navigate } from '../../../shared/lib/navigation';

function ActionButton({ label, tone, onClick, busy }: { label: string; tone: 'primary' | 'lime' | 'ghost'; onClick: () => void; busy: boolean }) {
  const cls = tone === 'primary'
    ? 'bg-[var(--primary)] text-white'
    : tone === 'lime'
      ? 'bg-[var(--lime)] text-[var(--ink)]'
      : 'bg-[var(--surface-2)] text-[var(--ink-2)]';
  // Stop the click from bubbling to the row's open-detail handler.
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={busy} className={`h-9 px-3.5 rounded-2xl font-bold text-[13px] disabled:opacity-60 ${cls}`}>
      {label}
    </button>
  );
}

// One booking row with status-aware Confirm / Cancel actions. Bookings arrive
// already paid, so there's no "mark paid" step — the owner can only cancel.
// `showVenue` tags the row with its venue name (the cross-venue inbox uses it).
// Shared by BookingsInboxTab (per-venue) and OwnerBookingsScreen (all venues).
export function OwnerBookingRow({ booking, canManage, showVenue, onChanged, onOpen, onNavigate }: {
  booking: ApiBooking;
  canManage: boolean;
  showVenue?: boolean;
  onChanged: (b: ApiBooking) => void;
  /** Tap the row body to open the full booking detail (omitted = not tappable). */
  onOpen?: (b: ApiBooking) => void;
  onNavigate?: Navigate;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const chip = statusChip(booking.status);
  const now = useCountdown(booking.approvalDeadline);
  const urgency = deadlineUrgency(booking.createdAt, booking.approvalDeadline, now);

  const act = async (status: BookingStatus) => {
    setBusy(true);
    setError(null);
    try {
      const cancellationReason = status === 'cancelled' ? 'Declined by venue' : undefined;
      const updated = await updateBookingStatus(booking.venueId || '', booking.id, { status, cancellationReason });
      onChanged({ ...booking, ...updated });
    } catch (e) {
      // A request can lapse, or another player can take the slot, between this
      // row rendering and the owner tapping Approve. Both come back as 409 with
      // a message worth showing verbatim rather than flattening to "try again".
      const msg = e instanceof Error ? e.message : '';
      setError(
        /expired|no longer free|REQUEST_EXPIRED|SLOT_CONFLICT/i.test(msg) ? msg
          : /409|cancel/i.test(msg) ? "Already cancelled — can't change."
            : "Couldn't update. Try again.",
      );
      setBusy(false);
    }
  };

  const messagePlayer = async () => {
    if (!booking.userId || messaging || !onNavigate) return;
    setMessaging(true);
    try {
      const conv = await startConversation(booking.userId, { contextType: 'booking', contextId: booking.id });
      onNavigate('chat', { id: conv.id, name: conv.otherParticipant?.displayName ?? personName });
    } catch {
      /* silent */
    } finally {
      setMessaging(false);
    }
  };

  const st = booking.status;
  const courtLabel = booking.courtName || (booking.courtNumber ? `Court ${booking.courtNumber}` : null);
  // Owner-entered bookings: a manual reservation shows its off-platform customer
  // (not the staff `userName`); a blocked slot has no customer.
  const isManual = booking.bookingType === 'manual';
  const isBlocked = booking.bookingType === 'blocked';
  const personName = isBlocked ? 'Blocked slot' : isManual ? (booking.customerName || 'Walk-in') : (booking.userName || 'Player');
  const openable = !!onOpen;
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${openable ? 'cursor-pointer active:bg-[var(--surface-2)] transition-colors' : ''}`}
      onClick={openable ? () => onOpen!(booking) : undefined}
      onKeyDown={openable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen!(booking); } } : undefined}
      role={openable ? 'button' : undefined}
      tabIndex={openable ? 0 : undefined}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <Avatar src={isManual || isBlocked ? undefined : booking.userAvatarUrl} name={personName} size={38} className="shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-[15px] text-[var(--ink)] truncate">
              {personName}
              {(isManual || isBlocked) && (
                <span className="ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                  {isBlocked ? 'BLOCKED' : 'MANUAL'}
                </span>
              )}
            </div>
            {showVenue && booking.venueName && (
              <div className="text-[12px] font-bold text-[var(--primary)] truncate">
                {booking.venueName}{courtLabel ? ` · ${courtLabel}` : ''}
              </div>
            )}
            <div className="t-sm">
              {/* Court leads the meta line only when it isn't already shown beside the venue. */}
              {(!showVenue || !booking.venueName) && courtLabel ? `${courtLabel} · ` : ''}
              {prettyDate(booking.date)}
              {booking.startTime ? ` · ${to12h(booking.startTime)}${booking.endTime ? `–${to12h(booking.endTime)}` : ''}` : ''}
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col sm:items-end justify-between items-center gap-2 sm:gap-1 shrink-0">
          <div className="font-semibold text-[15px] text-[var(--ink)] tabular-nums">{isBlocked ? '—' : money(booking.amount)}</div>
          <StatusChip chip={chip} />
          {/* How long is left to answer, colour-shifting as it runs down. An
              unanswered request auto-cancels at the deadline and the slot goes
              back on sale, so this is the row's most actionable fact. */}
          {st === 'pending_approval' && booking.approvalDeadline && (
            <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              urgency === 'urgent' ? 'bg-[var(--coral)]/15 text-[var(--coral)]'
                : urgency === 'soon' ? 'bg-amber-100 text-amber-700'
                  : 'bg-[var(--surface-2)] text-[var(--muted)]'
            }`}>
              <Icon name="timer" size={13} />
              {countdownLabel(booking.approvalDeadline, 'to respond', now)}
            </span>
          )}
        </div>
      </div>

      {canManage && st !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {st === 'pending_approval' && <ActionButton label="Approve" tone="primary" busy={busy} onClick={() => act('awaiting_payment')} />}
          {!isManual && !isBlocked && booking.userId && (
            <ActionButton label="Message" tone="lime" busy={messaging} onClick={messagePlayer} />
          )}
          <ActionButton label={st === 'pending_approval' ? 'Decline' : 'Cancel'} tone="ghost" busy={busy} onClick={() => act('cancelled')} />
        </div>
      )}
      {error && <div className="t-sm text-[var(--coral)] font-bold mt-2">{error}</div>}
    </div>
  );
}
