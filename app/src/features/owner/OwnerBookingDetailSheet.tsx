import { useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Avatar } from '../../shared/components/ui/Avatar';
import { updateBookingStatus, type ApiBooking, type BookingStatus } from '../../shared/lib/api';
import { money, prettyDate, to12h, hoursBetween, bookingDuration, statusChip } from '../bookings/bookingDisplay';

// Read-friendly label for a payment method code ("gcash" → "GCash", etc.).
function paymentLabel(method?: string | null): string {
  if (!method) return '';
  const map: Record<string, string> = { card: 'Card', gcash: 'GCash', cash: 'Cash', paymaya: 'Maya', maya: 'Maya' };
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
    <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b-[0.5px] border-[var(--hairline)]">
      <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] shrink-0 pt-0.5">{label}</div>
      <div className="text-right min-w-0">
        <div className="font-heading font-semibold text-[14px] text-[var(--ink)] break-words">{value}</div>
        {sub && <div className="text-[11px] font-semibold text-[var(--muted)]">{sub}</div>}
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
      title="Booking details"
      subtitle={courtLabel ? `${b?.venueName ?? ''}${b?.venueName && courtLabel ? ' · ' : ''}${courtLabel}` : (b?.venueName ?? undefined)}
      footer={b && canManage && st !== 'cancelled' ? (
        <div className="flex items-center gap-2">
          {st === 'pending_approval' && (
            <button type="button" disabled={busy} onClick={() => act('confirmed')}
              className="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[var(--primary)] text-white disabled:opacity-60">
              Confirm
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => act('cancelled')}
            className={`${st === 'pending_approval' ? '' : 'flex-1 '}h-12 px-4 rounded-2xl font-bold text-[15px] bg-[var(--surface-2)] text-[var(--ink-2)] disabled:opacity-60`}>
            {st === 'pending_approval' ? 'Decline' : 'Cancel booking'}
          </button>
        </div>
      ) : undefined}
    >
      {b && (
        <div className="space-y-4 pb-2">
          {/* Player */}
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3.5">
            <Avatar src={b.userAvatarUrl} name={b.userName || 'Player'} size={48} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Player</div>
              <div className="font-heading font-semibold text-[17px] text-[var(--ink)] truncate">{b.userName || 'Player'}</div>
              {typeof b.playerCount === 'number' && b.playerCount > 0 && (
                <div className="t-sm">{b.playerCount} {b.playerCount === 1 ? 'player' : 'players'}</div>
              )}
            </div>
            {chip && (
              <span className={`ml-auto shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${chip.className}`}>{chip.label}</span>
            )}
          </div>

          {/* Summary — mirrors the checkout review the player confirmed */}
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden">
            <Row label="Court" value={courtLabel || b.venueName || '—'} sub={courtLabel && b.venueName ? b.venueName : undefined} />
            <Row label="Date" value={prettyDate(b.date) || '—'} />
            {timeLabel && <Row label="Time" value={timeLabel} sub={bookingDuration(b) || undefined} />}
            {rate != null && <Row label="Rate" value={`${money(rate)}/hr`} sub={hours > 0 ? `${bookingDuration(b)}` : undefined} />}
            {b.paymentMethod && <Row label="Payment" value={paymentLabel(b.paymentMethod)} />}
            {booked && <Row label="Booked on" value={booked} />}
            {b.status === 'cancelled' && b.cancellationReason && <Row label="Cancelled" value={b.cancellationReason} />}
            <div className="flex items-center justify-between px-4 py-4 bg-[var(--ink)] text-white">
              <div className="font-heading font-semibold text-[15px]">Total</div>
              <div className="font-heading font-bold text-[22px] tabular-nums">{money(b.amount)}</div>
            </div>
          </div>

          {error && <div className="t-sm text-[var(--coral)] font-bold px-1">{error}</div>}
        </div>
      )}
    </BottomSheet>
  );
}
