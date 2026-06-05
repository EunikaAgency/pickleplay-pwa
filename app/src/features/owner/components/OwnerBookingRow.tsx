import { useState } from 'react';
import { updateBookingStatus, type ApiBooking, type BookingStatus } from '../../../shared/lib/api';
import { money, prettyDate, to12h, statusChip } from '../../bookings/bookingDisplay';

function ActionButton({ label, tone, onClick, busy }: { label: string; tone: 'primary' | 'lime' | 'ghost'; onClick: () => void; busy: boolean }) {
  const cls = tone === 'primary'
    ? 'bg-[var(--primary)] text-white'
    : tone === 'lime'
      ? 'bg-[var(--lime)] text-[var(--ink)]'
      : 'bg-[var(--surface-2)] text-[var(--ink-2)]';
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`h-9 px-3.5 rounded-2xl font-bold text-[13px] disabled:opacity-60 ${cls}`}>
      {label}
    </button>
  );
}

// One booking row with status-aware Confirm / Mark-paid / Cancel actions.
// `showVenue` tags the row with its venue name (the cross-venue inbox uses it).
// Shared by BookingsInboxTab (per-venue) and OwnerBookingsScreen (all venues).
export function OwnerBookingRow({ booking, canManage, showVenue, onChanged }: {
  booking: ApiBooking;
  canManage: boolean;
  showVenue?: boolean;
  onChanged: (b: ApiBooking) => void;
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
  return (
    <div className="rounded-xl border-[0.5px] border-[var(--hairline)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[15px] text-[var(--ink)] truncate">{booking.userName || 'Player'}</div>
          {showVenue && booking.venueName && <div className="text-[12px] font-bold text-[var(--primary)] truncate">{booking.venueName}</div>}
          <div className="t-sm">
            {prettyDate(booking.date)}
            {booking.startTime ? ` · ${to12h(booking.startTime)}${booking.endTime ? `–${to12h(booking.endTime)}` : ''}` : ''}
            {booking.playerCount ? ` · ${booking.playerCount}p` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-[15px] text-[var(--ink)] tabular-nums">{money(booking.amount)}</div>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.className}`}>{chip.label}</span>
        </div>
      </div>

      {canManage && st !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {st === 'pending_approval' && <ActionButton label="Confirm" tone="primary" busy={busy} onClick={() => act('confirmed')} />}
          {(st === 'confirmed' || st === 'pending_approval') && <ActionButton label="Mark paid" tone="lime" busy={busy} onClick={() => act('paid')} />}
          <div className="flex-1" />
          <ActionButton label={st === 'pending_approval' ? 'Decline' : 'Cancel'} tone="ghost" busy={busy} onClick={() => act('cancelled')} />
        </div>
      )}
      {error && <div className="t-sm text-[var(--coral)] font-bold mt-2">{error}</div>}
    </div>
  );
}
