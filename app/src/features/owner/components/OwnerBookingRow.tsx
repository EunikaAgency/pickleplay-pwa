import { useState } from 'react';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { updateBookingStatus, type ApiBooking, type BookingStatus } from '../../../shared/lib/api';
import { money, prettyDate, to12h, statusChip } from '../../bookings/bookingDisplay';

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
export function OwnerBookingRow({ booking, canManage, showVenue, onChanged, onOpen }: {
  booking: ApiBooking;
  canManage: boolean;
  showVenue?: boolean;
  onChanged: (b: ApiBooking) => void;
  /** Tap the row body to open the full booking detail (omitted = not tappable). */
  onOpen?: (b: ApiBooking) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chip = statusChip(booking.status);

  const act = async (status: BookingStatus) => {
    setBusy(true);
    setError(null);
    try {
      const cancellationReason = status === 'cancelled' ? 'Declined by venue' : undefined;
      const updated = await updateBookingStatus(booking.venueId || '', booking.id, { status, cancellationReason });
      onChanged({ ...booking, ...updated });
    } catch (e) {
      setError(e instanceof Error && /409|cancel/i.test(e.message) ? "Already cancelled — can't change." : "Couldn't update. Try again.");
      setBusy(false);
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
      className={`rounded-xl border-[0.5px] border-[var(--hairline)] p-3 ${openable ? 'cursor-pointer active:bg-[var(--surface-2)] transition-colors' : ''}`}
      onClick={openable ? () => onOpen!(booking) : undefined}
      onKeyDown={openable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen!(booking); } } : undefined}
      role={openable ? 'button' : undefined}
      tabIndex={openable ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-3">
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
        <div className="text-right shrink-0">
          <div className="font-semibold text-[15px] text-[var(--ink)] tabular-nums">{isBlocked ? '—' : money(booking.amount)}</div>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.className}`}>{chip.label}</span>
        </div>
      </div>

      {canManage && st !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {st === 'pending_approval' && <ActionButton label="Approve" tone="primary" busy={busy} onClick={() => act('awaiting_payment')} />}
          <div className="flex-1" />
          <ActionButton label={st === 'pending_approval' ? 'Decline' : 'Cancel'} tone="ghost" busy={busy} onClick={() => act('cancelled')} />
        </div>
      )}
      {error && <div className="t-sm text-[var(--coral)] font-bold mt-2">{error}</div>}
    </div>
  );
}
