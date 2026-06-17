import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { listBookings, cancelBooking, type ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { isCancellable, money, prettyDate, bookingStatusChip, to12h } from './bookingDisplay';

interface MyBookingsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function MyBookingsScreen({ onNavigate, onBack }: MyBookingsScreenProps) {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);
  // Two-step cancel: tapping Cancel asks for confirmation before releasing the court.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listBookings()
      .then((items) => { if (alive) setBookings(items); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your bookings.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: updated.status ?? 'cancelled' } : b)));
      setConfirmingId(null);
    } catch {
      // Surface a soft inline failure by reloading the truth from the server.
      setReloadKey((k) => k + 1);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="My bookings" eyebrow="Court reservations" />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No bookings yet"
            description="Reserve a court and your bookings will show up here."
            action={{ label: 'Find a court', onPress: () => onNavigate('nearby') }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {bookings.map((b) => {
              const chip = bookingStatusChip(b);
              const when = [prettyDate(b.date), b.startTime ? to12h(b.startTime) : null].filter(Boolean).join(' · ');
              const confirming = confirmingId === b.id;
              return (
                <div key={b.id} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-[15px] text-[var(--ink)] truncate">
                        {b.venueName || 'Court booking'}
                      </div>
                      <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5">{when || '—'}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                      {chip.label}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)]">
                    <div className="flex items-center justify-between">
                      <div className="font-heading font-bold text-[16px] text-[var(--ink)]">{money(b.amount)}</div>
                      {isCancellable(b) && !confirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(b.id)}
                          className="text-[13px] font-bold text-[var(--coral)] flex items-center gap-1"
                        >
                          <Icon name="close" size={14} /> Cancel
                        </button>
                      )}
                    </div>
                    {confirming && (
                      <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
                        <div className="text-[13px] font-bold text-[var(--ink)]">Cancel this booking?</div>
                        <div className="text-[12px] text-[var(--muted)] mt-0.5">
                          Your court reservation will be released and the time freed up. This can’t be undone.
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            disabled={cancelling === b.id}
                            className="flex-1 h-9 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
                          >
                            Keep booking
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(b.id)}
                            disabled={cancelling === b.id}
                            className="flex-1 h-9 rounded-lg bg-[var(--coral)] text-white font-heading font-semibold text-[13px] flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {cancelling === b.id
                              ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> Cancelling…</>
                              : 'Yes, cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
