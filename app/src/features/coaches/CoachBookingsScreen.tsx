import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import {
  acceptCoachBooking, apiImageUrl, cancelCoachBooking, declineCoachBooking, listCoachInbox,
  type ApiCoachBooking,
} from '../../shared/lib/api';
import { getInitials } from '../../shared/lib/initials';
import { coachBookingChip, money, sessionWhen } from './coachDisplay';

interface CoachBookingsScreenProps {
  onBack: () => void;
}

export function CoachBookingsScreen({ onBack }: CoachBookingsScreenProps) {
  const [rows, setRows] = useState<ApiCoachBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    listCoachInbox()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoading(true); setFailed(false); setReloadKey((k) => k + 1);
  }, []);

  /** Run a mutation, then swap the returned row in place (no full refetch). */
  const act = async (id: string, fn: () => Promise<ApiCoachBooking>) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError('That action failed. Pull to refresh and try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="scroll pb-[100px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Session requests" />
      </div>

      <div className="px-5 pt-4">
        {loading && <LoadingSkeleton variant="list-row" count={3} />}

        {!loading && failed && (
          <ErrorState title="Couldn't load your requests" message="Please try again." onRetry={retry} />
        )}

        {!loading && !failed && rows.length === 0 && (
          <EmptyState
            icon="event_available"
            title="No session requests yet"
            description="When a player books you, their request lands here for you to accept or decline."
          />
        )}

        {error && (
          <div role="alert" className="mb-3 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]">
            {error}
          </div>
        )}

        {!loading && !failed && rows.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {rows.map((b) => {
              const chip = coachBookingChip(b.status);
              const photo = apiImageUrl(b.player?.avatarUrl ?? null);
              const busy = busyId === b.id;
              return (
                <li key={b.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="avatar flex-none h-11 w-11 overflow-hidden rounded-full">
                      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span>{getInitials(b.player?.name)}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-heading text-[15px] font-extrabold">{b.player?.name ?? 'Player'}</div>
                      <div className="text-[12.5px] text-[var(--muted)]">{sessionWhen(b.date, b.startTime)}</div>
                    </div>
                    <span
                      className="flex-none rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ color: chip.color, background: 'var(--surface-2)' }}
                    >
                      {chip.label}
                    </span>
                  </div>

                  {b.notes && (
                    <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[13px] leading-snug">
                      &ldquo;{b.notes}&rdquo;
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[13px] text-[var(--muted)]">
                      <Icon name="payments" size={15} />
                      {money(b.amount, b.currency)}
                    </span>

                    {b.status === 'pending' && (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(b.id, () => declineCoachBooking(b.id))}
                          className="rounded-xl border border-[var(--hairline)] px-3.5 py-2 text-[13px] font-bold disabled:opacity-50"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(b.id, () => acceptCoachBooking(b.id))}
                          className="rounded-xl bg-[var(--lime)] px-3.5 py-2 text-[13px] font-bold text-[var(--lime-ink)] disabled:opacity-50"
                        >
                          {busy ? '…' : 'Accept'}
                        </button>
                      </span>
                    )}

                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(b.id, () => cancelCoachBooking(b.id))}
                        className="rounded-xl border border-[var(--hairline)] px-3.5 py-2 text-[13px] font-bold text-[var(--coral)] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
