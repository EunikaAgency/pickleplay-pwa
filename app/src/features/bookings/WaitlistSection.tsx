import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import {
  listMyWaitlist, leaveWaitlist, claimWaitlistSlot,
  type ApiWaitlistEntry,
} from '../../shared/lib/api';
import { prettyDate, to12h } from './bookingDisplay';

/** Status chip for a waitlist entry. */
function waitlistChip(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case 'waiting':
      return { label: 'Waiting', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'promoted':
      return { label: 'Claim now', className: 'bg-[var(--lime)] text-[var(--ink)]' };
    case 'claimed':
      return { label: 'Claimed', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' };
    case 'expired':
      return { label: 'Expired', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    default:
      return { label: status || 'Unknown', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  }
}

/** How long until the claim window expires, in a human-readable form. */
function claimWindowLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '';
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.max(0, Math.round((d.getTime() - Date.now()) / 60_000));
  if (mins === 0) return 'Expiring now';
  if (mins < 60) return `${mins} min to claim`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m to claim` : `${hrs}h to claim`;
}

export function WaitlistSection() {
  const [entries, setEntries] = useState<ApiWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listMyWaitlist()
      .then((items) => { if (alive) setEntries(items); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load waitlist.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const active = entries.filter((e) => e.status === 'waiting' || e.status === 'promoted');
  const hasEntries = entries.length > 0;

  // Always show the section header with a count badge when there are active entries.
  if (!expanded && !loading && !error && active.length === 0) {
    return (
      <div className="px-5 mt-6">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between py-3"
        >
          <span className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide">
            Waitlist
            {active.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--coral)] text-white text-[11px] font-bold">
                {active.length}
              </span>
            )}
          </span>
          <Icon name="chevron" size={16} className="text-[var(--muted)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 mt-6">
      {/* Section header — collapsible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between py-3"
      >
        <span className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide">
          Waitlist
          {active.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--coral)] text-white text-[11px] font-bold">
              {active.length}
            </span>
          )}
        </span>
        <Icon name="chevron" size={16} className={`text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {!expanded ? null : loading ? (
        <LoadingSkeleton variant="card" count={2} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !hasEntries ? (
        <EmptyState
          icon="queue"
          title="Not on any waitlists"
          description="When a court is fully booked, you can join the waitlist to be notified if a spot opens up."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => {
            const chip = waitlistChip(e.status);
            const when = [prettyDate(e.date), e.startTime ? to12h(e.startTime) : null].filter(Boolean).join(' · ');
            const isPromoted = e.status === 'promoted';
            const isWaiting = e.status === 'waiting';

            return (
              <div
                key={e.id}
                className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[15px] text-[var(--ink)] truncate">
                      {e.venueName || 'Court'}
                    </div>
                    <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5">
                      {when || '—'}
                    </div>
                    {e.playerCount && e.playerCount > 1 && (
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        {e.playerCount} players
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                    {chip.label}
                  </span>
                </div>

                {/* Promoted: claim countdown + button */}
                {isPromoted && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)]">
                    {e.claimExpiresAt && (
                      <div className="text-[12px] font-semibold text-[var(--coral)] mb-2">
                        <Icon name="timer" size={14} className="inline mr-1" />
                        {claimWindowLabel(e.claimExpiresAt)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setClaiming(e.id);
                        try {
                          await claimWaitlistSlot(e.id);
                          setReloadKey((k) => k + 1);
                        } catch {
                          // Error claiming — refetch to get latest state.
                          setReloadKey((k) => k + 1);
                        } finally {
                          setClaiming(null);
                        }
                      }}
                      disabled={claiming === e.id}
                      className="w-full h-10 rounded-xl bg-[var(--lime)] text-[var(--ink)] font-heading font-bold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {claiming === e.id
                        ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> Claiming…</>
                        : <><Icon name="check" size={14} /> Claim this slot</>}
                    </button>
                  </div>
                )}

                {/* Waiting: leave button */}
                {isWaiting && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)] flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        setLeaving(e.id);
                        try {
                          await leaveWaitlist(e.id);
                          setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: 'cancelled' } : x)));
                        } catch {
                          setReloadKey((k) => k + 1);
                        } finally {
                          setLeaving(null);
                        }
                      }}
                      disabled={leaving === e.id}
                      className="text-[12px] font-semibold text-[var(--coral)] disabled:opacity-50"
                    >
                      {leaving === e.id ? 'Removing…' : 'Leave waitlist'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
