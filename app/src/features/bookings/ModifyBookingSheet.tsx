import { useState, useMemo } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { modifyBooking, type ApiBooking, type ModifyBookingPayload } from '../../shared/lib/api';
import { prettyDate, to12h, timeRange, bookingDuration, money, todayYMD } from './bookingDisplay';

interface ModifyBookingSheetProps {
  booking: ApiBooking | null;
  onClose: () => void;
  onModified: () => void;        // refetch the booking list
}

/** "HH:MM" → an <input type="date">-safe "YYYY-MM-DD" (today as fallback). */
function toDateValue(ymd: string | null | undefined): string {
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return todayYMD();
}

export function ModifyBookingSheet({ booking, onClose, onModified }: ModifyBookingSheetProps) {
  // Component is keyed by booking.id, so state is always fresh from this prop.
  const [date, setDate] = useState(() => toDateValue(booking?.date));
  const [startTime, setStartTime] = useState(() => booking?.startTime || '');
  const [endTime, setEndTime] = useState(() => booking?.endTime || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Which fields actually changed vs the current booking.
  const changes = useMemo(() => {
    if (!booking) return {} as Record<string, [string, string]>;
    const c: Record<string, [string, string]> = {};
    if (date !== toDateValue(booking.date)) c.date = [booking.date || '', date];
    if (startTime !== (booking.startTime || '')) c.startTime = [booking.startTime || '', startTime];
    if (endTime !== (booking.endTime || '')) c.endTime = [booking.endTime || '', endTime];
    return c;
  }, [booking, date, startTime, endTime]);

  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async () => {
    if (!booking || !hasChanges) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: ModifyBookingPayload = {};
      if (changes.date) payload.date = date;
      if (changes.startTime) payload.startTime = startTime;
      if (changes.endTime) payload.endTime = endTime;
      // We don't expose court change in this simple sheet — date/time reschedule only.
      const result = await modifyBooking(booking.id, payload);
      setSuccess(
        `Booking updated! (${result.modificationCount}/3 modifications used)${
          result.modificationCount >= 3 ? ' — no more changes allowed.' : ''
        }`,
      );
      onModified();
      // Auto-close after a short delay so the user sees the success message.
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not modify booking.';
      if (/already started/i.test(msg)) setError("This booking has already started and can't be changed.");
      else if (/maximum|max|3/.test(msg)) setError('You\'ve reached the 3-modification limit for this booking.');
      else if (/conflict|unavailable|overlap/i.test(msg)) setError('The new time conflicts with another booking. Try a different slot.');
      else if (/no changes/i.test(msg)) setError('No changes detected — pick a different date or time.');
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Only upcoming (not cancelled, not past) confirmed bookings can be modified.
  const canModify = booking
    && booking.status !== 'cancelled'
    && booking.status !== 'pending_approval'
    && booking.status !== 'awaiting_payment';

  return (
    <BottomSheet
      open={booking !== null}
      onClose={onClose}
      title="Modify booking"
      subtitle={booking?.venueName || undefined}
      footer={
        !canModify ? (
          <div className="text-[13px] text-[var(--muted)] text-center py-2">
            Only confirmed upcoming bookings can be rescheduled.
          </div>
        ) : success ? (
          <div className="text-[13px] font-semibold text-[var(--lime-ink)] text-center py-2">{success}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {error && (
              <div className="text-[12px] text-[var(--coral)] font-semibold text-center">{error}</div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !hasChanges}
              className="w-full h-11 rounded-xl bg-[var(--lime)] text-[var(--ink)] font-heading font-bold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting
                ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</>
                : <><Icon name="check" size={16} /> Save changes</>}
            </button>
          </div>
        )
      }
    >
      {booking && (
        <div className="px-5">
          {/* Current booking summary */}
          <div className="rounded-xl bg-[var(--surface-2)] p-3 mb-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Current booking</div>
            <div className="text-[13px] font-semibold text-[var(--ink)]">{booking.venueName || 'Court booking'}</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">
              {prettyDate(booking.date)} · {timeRange(booking) || (booking.startTime ? to12h(booking.startTime) : '—')}
              {bookingDuration(booking) && ` · ${bookingDuration(booking)}`}
            </div>
            <div className="text-[12px] font-semibold text-[var(--ink)] mt-1">{money(booking.amount)}</div>
          </div>

          {!canModify ? (
            <div className="text-[13px] text-[var(--muted)] text-center py-4">
              {booking.status === 'cancelled'
                ? 'Cancelled bookings cannot be modified.'
                : booking.status === 'pending_approval'
                  ? 'Wait for the owner to approve your request before modifying.'
                  : booking.status === 'awaiting_payment'
                    ? 'Pay for this booking first, then you can reschedule it.'
                    : 'This booking cannot be modified.'}
            </div>
          ) : (
            <>
              {/* Modification count warning */}
              <div className="text-[12px] text-[var(--muted)] mb-4">
                You can reschedule a booking up to 3 times. Changes are re-checked for availability.
              </div>

              {/* Date */}
              <label className="block mb-3">
                <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Date</span>
                <input
                  type="date"
                  value={date}
                  min={todayYMD()}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                />
              </label>

              {/* Start time */}
              <label className="block mb-3">
                <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Start time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                />
              </label>

              {/* End time */}
              <label className="block mb-3">
                <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">End time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                />
              </label>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
