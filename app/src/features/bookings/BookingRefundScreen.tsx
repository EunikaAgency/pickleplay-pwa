import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { getBooking, cancelBooking, ApiError, type ApiBooking } from '../../shared/lib/api';
import { money, prettyDate, timeRange } from './bookingDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface BookingRefundScreenProps {
  bookingId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * Refund & cancellation for a single court booking — reached after a host deletes
 * a game lobby (the court reservation survives) and from anywhere else that needs
 * to cancel a booking. Refunds aren't automated yet, so cancelling here releases
 * the court and flags the booking for the team to process any eligible refund.
 */
export function BookingRefundScreen({ bookingId, onNavigate, onBack }: BookingRefundScreenProps) {
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    getBooking(bookingId)
      .then((b) => { if (alive) { setBooking(b); setStatus('ready'); } })
      .catch((e) => {
        if (!alive) return;
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [bookingId, reloadKey]);

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelBooking(bookingId, 'Lobby deleted — refund requested');
      setConfirmOpen(false);
      setDone(true);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel this booking. Try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} title="Refund & cancel" eyebrow="Court reservation" />
        <div className="px-5 mt-2"><LoadingSkeleton variant="card" count={2} /></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} title="Refund & cancel" eyebrow="Court reservation" />
        <ErrorState
          title="Couldn't load this booking"
          message="We couldn't reach your booking. Try again in a moment."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (status === 'notfound' || !booking) {
    return (
      <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={onBack} title="Refund & cancel" eyebrow="Court reservation" />
        <EmptyState
          icon="calendar"
          title="Booking not found"
          description="This reservation may have already been cancelled or removed."
          action={{ label: 'Go to my bookings', onPress: () => onNavigate('my-bookings') }}
        />
      </div>
    );
  }

  const alreadyCancelled = booking.status === 'cancelled';
  const when = [prettyDate(booking.date), timeRange(booking)].filter(Boolean).join(' · ');

  // Post-cancel success — the request is in, no more actions needed.
  if (done) {
    return (
      <div className="scroll safe-bottom pt-[calc(20px+env(safe-area-inset-top))] px-5 flex flex-col items-center justify-center text-center min-h-[78vh]">
        <div className="w-16 h-16 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center mb-4">
          <Icon name="check" size={30} />
        </div>
        <h2 className="font-heading font-bold text-[20px] text-[var(--ink)]">Cancellation requested</h2>
        <p className="text-[14px] text-[var(--ink-2)] font-semibold mt-2 max-w-[300px]">
          Your court at {booking.venueName || 'the venue'} has been released. Any eligible refund of{' '}
          {money(booking.amount)} will be reviewed and returned to your original payment method — you'll
          get a confirmation once it's processed.
        </p>
        <div className="w-full max-w-[320px] mt-6 flex flex-col gap-2.5">
          <Button fullWidth onClick={() => onNavigate('my-bookings', undefined, { replace: true })}>
            Go to my bookings
          </Button>
          <Button fullWidth variant="outline" onClick={() => onNavigate('games', undefined, { replace: true })}>
            Back to games
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll pb-[120px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Refund & cancel" eyebrow="Court reservation" />

      <div className="px-5 mt-1">
        {/* Booking summary */}
        <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading font-semibold text-[16px] text-[var(--ink)] truncate">
                {booking.venueName || 'Your court'}
              </div>
              <div className="text-[12.5px] font-semibold text-[var(--muted)] mt-0.5">{when || 'Date to be set'}</div>
            </div>
            {alreadyCancelled && (
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--coral-soft)] text-[var(--coral)]">
                Cancelled
              </span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)] flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Paid</span>
            <span className="font-heading font-bold text-[17px] text-[var(--ink)]">{money(booking.amount)}</span>
          </div>
        </div>

        {alreadyCancelled ? (
          <div className="mt-5 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] px-4 py-4 text-[13px] font-semibold text-[var(--ink-2)]">
            This booking is already cancelled. Any eligible refund will be processed to your original
            payment method — no further action is needed.
          </div>
        ) : (
          <>
            {/* Refund policy — honest about the current (manual) process. */}
            <div className="mt-5 rounded-2xl bg-[var(--primary-tint)] border-[0.5px] border-[var(--primary)]/20 px-4 py-3.5 flex items-start gap-3">
              <Icon name="help" size={18} className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <div className="text-[13px] font-semibold text-[var(--ink-2)] leading-snug">
                <span className="font-bold text-[var(--ink)]">How refunds work.</span> Automatic refunds
                aren't available yet. Cancelling below releases your court immediately and flags the
                booking for our team — any eligible refund is returned to your original payment method,
                and we'll confirm once it's done.
              </div>
            </div>

            <div className="mt-5">
              <Button fullWidth variant="destructive" onClick={() => { setCancelError(null); setConfirmOpen(true); }}>
                <Icon name="logout" size={16} /> Cancel booking & request refund
              </Button>
              <button
                className="w-full mt-2.5 h-11 text-[14px] font-bold text-[var(--muted)]"
                onClick={() => onNavigate('my-bookings', undefined, { replace: true })}
              >
                Keep the booking
              </button>
            </div>
          </>
        )}

        {cancelError && (
          <div className="mt-3 text-[13px] text-[var(--coral)] font-semibold text-center">{cancelError}</div>
        )}
      </div>

      {/* Cancel confirmation */}
      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Cancel this booking?">
        <div className="px-1 pb-1">
          <div className="rounded-2xl bg-[var(--coral-soft)] border-[0.5px] border-[var(--coral)]/30 px-4 py-3.5 flex items-start gap-3">
            <Icon name="logout" size={20} className="mt-0.5 shrink-0 text-[var(--coral)]" />
            <p className="text-[13px] font-semibold text-[var(--coral)] leading-snug">
              Your court at {booking.venueName || 'the venue'} on {when || 'the booked date'} will be
              released and a refund of {money(booking.amount)} requested. This can't be undone.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={cancelling}>Keep it</Button>
            <Button variant="destructive" onClick={doCancel} disabled={cancelling}>
              {cancelling ? (
                <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Cancelling…</>
              ) : (
                'Cancel booking'
              )}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
