import { useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Avatar } from '../../shared/components/ui/Avatar';
import { updateBookingStatus, type ApiBooking, type BookingStatus } from '../../shared/lib/api';
import { money, prettyDate, to12h, hoursBetween, bookingDuration, statusChip, paymentOptionLabel, bookingSourceLabel } from '../bookings/bookingDisplay';

// Read-friendly label for a payment method code ("gcash" → "GCash", etc.).
function paymentLabel(method?: string | null): string {
  if (!method) return '';
  const map: Record<string, string> = { card: 'Card', gcash: 'GCash', cash: 'Cash', paymaya: 'Maya', maya: 'Maya', pay_at_venue: 'Pay at venue', test_card: 'Test card', transfer: 'Bank transfer' };
  return map[method.toLowerCase()] ?? method.charAt(0).toUpperCase() + method.slice(1);
}

// "Booked on" date from the Mongo ObjectId's leading timestamp (seeded rows'
// createdAt is unreliable; the id always carries the real creation time).
function bookedOn(b: ApiBooking): string {
  if (b.createdAt) {
    const t = Date.parse(b.createdAt);
    if (!Number.isNaN(t)) return new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  const id = b.id || '';
  if (id.length >= 8) {
    const secs = parseInt(id.slice(0, 8), 16);
    if (!Number.isNaN(secs)) return new Date(secs * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return '';
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="obook-row">
      <div className="obook-row-label">{label}</div>
      <div className="text-right min-w-0">
        <div className="obook-row-val">{value}</div>
        {sub && <div className="obook-row-sub">{sub}</div>}
      </div>
    </div>
  );
}

// Full read-only detail of a single booking — the same Summary-style breakdown
// the player saw at checkout (Court / Date / Time / Rate / Total) plus the
// player who booked, payment + status, and the confirm/decline/cancel actions.
// Reuses the already-loaded ApiBooking (player + court fields come populated
// from the owner bookings endpoint), so there's no extra fetch.
export function OwnerBookingDetailSheet({ booking, canManage, onClose, onChanged }: {
  booking: ApiBooking | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: (b: ApiBooking) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (status: BookingStatus) => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const cancellationReason = status === 'cancelled' ? 'Declined by venue' : undefined;
      const updated = await updateBookingStatus(booking.venueId || '', booking.id, { status, cancellationReason });
      onChanged({ ...booking, ...updated });
      onClose();
    } catch (e) {
      setError(e instanceof Error && /409|cancel/i.test(e.message) ? "Already cancelled — can't change." : "Couldn't update. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const b = booking;
  const chip = b ? statusChip(b.status) : null;
  // Owner-entered bookings: a 'manual' off-platform reservation carries an
  // off-platform customer (not a platform user); a 'blocked' slot has no customer.
  const isManual = b?.bookingType === 'manual';
  const isBlocked = b?.bookingType === 'blocked';
  const personName = isBlocked ? 'Blocked slot' : (isManual ? (b?.customerName || 'Walk-in') : (b?.userName || 'Player'));
  const courtLabel = b ? (b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : null)) : null;
  const hours = b ? hoursBetween(b.startTime || '', b.endTime || '') : 0;
  const rate = b && hours > 0 && typeof b.amount === 'number' ? Math.round(b.amount / hours) : null;
  const timeLabel = b && b.startTime
    ? `${to12h(b.startTime)}${b.endTime ? ` – ${to12h(b.endTime)}` : ''}`
    : '';
  const st = b?.status;
  const booked = b ? bookedOn(b) : '';

  return (
    <BottomSheet
      open={!!b}
      onClose={onClose}
      // The sheet's backdrop covers the tab bar, so the 96px tab-bar clearance
      // under the footer is unnecessary — it just steals height and pushes the
      // Total below the fold. Flush keeps the whole breakdown (incl. Total) in view.
      flushFooter
      // Size the body to its content (only scroll when it actually overflows the
      // sheet's max-height) instead of the default flex-fill scroll container.
      sheetClassName="obook-sheet"
      title="Booking details"
      subtitle={courtLabel ? `${b?.venueName ?? ''}${b?.venueName && courtLabel ? ' · ' : ''}${courtLabel}` : (b?.venueName ?? undefined)}
      footer={b && canManage && st !== 'cancelled' ? (
        <div className="obook-actions">
          {st === 'pending_approval' && (
            <button type="button" disabled={busy} onClick={() => act('awaiting_payment')} className="obook-btn obook-btn-confirm">
              Approve
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => act('cancelled')}
            className={`obook-btn obook-btn-cancel${st === 'pending_approval' ? '' : ' full'}`}>
            {st === 'pending_approval' ? 'Decline' : 'Cancel booking'}
          </button>
        </div>
      ) : undefined}
    >
      {b && (
        <div className="obook">
          {/* Player / customer / block */}
          <div className="obook-card obook-player">
            <Avatar src={isManual || isBlocked ? undefined : b.userAvatarUrl} name={personName} size={48} className="shrink-0" />
            <div className="min-w-0">
              <div className="obook-eyebrow">{isBlocked ? 'Unavailable' : isManual ? 'Customer' : 'Player'}</div>
              <div className="obook-name truncate">{personName}</div>
              {isManual && b.customerPhone && <div className="obook-sub">{b.customerPhone}</div>}
              {isManual && b.bookingSource && <div className="obook-sub">via {bookingSourceLabel(b.bookingSource)}</div>}
              {isBlocked && b.blockReason && <div className="obook-sub">{b.blockReason}</div>}
              {!isManual && !isBlocked && typeof b.playerCount === 'number' && b.playerCount > 0 && (
                <div className="obook-sub">{b.playerCount} {b.playerCount === 1 ? 'player' : 'players'}</div>
              )}
            </div>
            {chip && (
              <span className={`obook-chip ${chip.className}`}>{isManual ? 'Manual' : isBlocked ? 'Blocked' : chip.label}</span>
            )}
          </div>

          {/* Summary — mirrors the checkout review the player confirmed */}
          <div className="obook-card obook-summary">
            <Row label="Court" value={courtLabel || b.venueName || '—'} sub={courtLabel && b.venueName ? b.venueName : undefined} />
            <Row label="Date" value={prettyDate(b.date) || '—'} />
            {timeLabel && <Row label="Time" value={timeLabel} sub={bookingDuration(b) || undefined} />}
            {!isBlocked && rate != null && <Row label="Rate" value={`${money(rate)}/hr`} sub={hours > 0 ? `${bookingDuration(b)}` : undefined} />}
            {!isBlocked && b.serviceFeeAmount != null && b.serviceFeeAmount > 0 && (
              <>
                <Row label="Subtotal" value={money(b.amount)} />
                <Row label="Service fee" value={money(b.serviceFeeAmount)} />
              </>
            )}
            {!isBlocked && b.paymentOption && <Row label="Payment plan" value={paymentOptionLabel(b.paymentOption)} />}
            {!isBlocked && b.balanceDue != null && b.balanceDue > 0 && <Row label="Due at venue" value={money(b.balanceDue)} />}
            {b.paymentMethod && <Row label="Payment" value={paymentLabel(b.paymentMethod)} />}
            {booked && <Row label="Booked on" value={booked} />}
            {b.status === 'cancelled' && b.cancellationReason && <Row label="Cancelled" value={b.cancellationReason} />}
            <div className="obook-total">
              <div className="obook-total-label">{isBlocked ? 'Charge' : 'Total'}</div>
              <div className="obook-total-val tabular-nums">{isBlocked ? 'No charge' : money((b.amount ?? 0) + (b.serviceFeeAmount ?? 0))}</div>
            </div>
          </div>

          {error && <div className="obook-error">{error}</div>}
        </div>
      )}
    </BottomSheet>
  );
}
