import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Dropdown } from '../../shared/components/ui/Dropdown';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { listBookings, cancelBooking, checkout, type ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import {
  isCancellable, money, prettyDate, bookingPhase, bookingPhaseChip,
  timeRange, bookingDuration, to12h, type BookingPhase,
} from './bookingDisplay';

/** "Mon, Jun 23, 6:00 PM" — the pay-by deadline for an approved request. */
function payByLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface MyBookingsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type FilterKey = 'all' | BookingPhase;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
];

// Two sort axes: the court's *play date* (when you're booked to play) and when
// the reservation was *made* (createdAt), each in both directions. Labels use
// "earliest/latest first" (calendar direction) rather than "soonest", which
// reads wrong for past bookings.
type SortKey = 'play-soon' | 'play-late' | 'booked-new' | 'booked-old';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'play-soon', label: 'Play date — earliest first' },
  { key: 'play-late', label: 'Play date — latest first' },
  { key: 'booked-new', label: 'Booked — latest first' },
  { key: 'booked-old', label: 'Booked — earliest first' },
];

/** Epoch ms of the court date+start time (when you play); 0 if unknown. */
function playTs(b: ApiBooking): number {
  if (!b.date) return 0;
  const t = b.startTime && /^\d{1,2}:\d{2}/.test(b.startTime) ? b.startTime : '00:00';
  const d = new Date(`${b.date}T${t}`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
/** Epoch ms of when the booking was made; 0 if unknown. */
function bookedTs(b: ApiBooking): number {
  const d = b.createdAt ? new Date(b.createdAt) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
}

function courtLabel(b: ApiBooking): string | null {
  return b.courtName || (b.courtNumber ? `Court ${b.courtNumber}` : null);
}
function bookedOn(b: ApiBooking): string | null {
  if (!b.createdAt) return null;
  return prettyDate(b.createdAt.slice(0, 10));
}

export function MyBookingsScreen({ onNavigate, onBack }: MyBookingsScreenProps) {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('play-soon');
  // The booking shown in the details sheet (by id), plus the two-step cancel state.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Pay-after-approval (request-to-book): charging an 'awaiting_payment' booking.
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

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

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: bookings.length, upcoming: 0, ongoing: 0, completed: 0 };
    for (const b of bookings) c[bookingPhase(b)]++;
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const base = filter === 'all' ? bookings : bookings.filter((b) => bookingPhase(b) === filter);
    return [...base].sort((a, b) => {
      switch (sort) {
        case 'play-late': return playTs(b) - playTs(a);
        case 'booked-new': return bookedTs(b) - bookedTs(a);
        case 'booked-old': return bookedTs(a) - bookedTs(b);
        case 'play-soon':
        default: return playTs(a) - playTs(b);
      }
    });
  }, [bookings, filter, sort]);

  // Group the (already date-sorted) list under date dividers — keyed off the same
  // axis we're sorting on, so headers stay in order: play date for the play-date
  // sorts, the date the booking was made for the booked sorts.
  const groups = useMemo(() => {
    const byBooked = sort === 'booked-new' || sort === 'booked-old';
    const out: { key: string; label: string; items: ApiBooking[] }[] = [];
    for (const b of visible) {
      const day = (byBooked ? b.createdAt?.slice(0, 10) : b.date) || '';
      const key = day || 'unknown';
      let cur = out[out.length - 1];
      if (!cur || cur.key !== key) {
        cur = { key, label: day ? (prettyDate(day) || day) : 'Date unknown', items: [] };
        out.push(cur);
      }
      cur.items.push(b);
    }
    return out;
  }, [visible, sort]);

  const detail = detailId ? bookings.find((b) => b.id === detailId) ?? null : null;
  const closeDetail = () => { setDetailId(null); setConfirming(false); setPayError(null); };

  // Pay an approved request to confirm it (card was saved at request time).
  const handlePay = async (b: ApiBooking) => {
    setPaying(b.id);
    setPayError(null);
    try {
      const res = await checkout({ bookingId: b.id, amount: b.amount ?? 0, currency: 'PHP', method: 'card' });
      const status = res.booking?.status ?? 'confirmed';
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status } : x)));
      closeDetail();
    } catch (e) {
      // 409 = approval not yet given / window expired (the API also cancels it);
      // refetch so the list reflects the new state.
      setPayError(e instanceof Error && /expired/i.test(e.message) ? 'The payment window expired — please book again.' : "Couldn't take payment. Try again.");
      setReloadKey((k) => k + 1);
    } finally {
      setPaying(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: updated.status ?? 'cancelled' } : b)));
      setConfirming(false);
    } catch {
      setReloadKey((k) => k + 1);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="My bookings" eyebrow="Court reservations" />

      <div className="px-5">
        {/* Status filter */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[var(--surface-2)]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`flex-1 h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
                  filter === f.key
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-card)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {f.label}
                {counts[f.key] > 0 && <span className="opacity-60"> {counts[f.key]}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Sort — the shared on-brand dropdown (pill variant). */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex items-center justify-end gap-2 mb-3">
            <span className="text-[12px] font-medium text-[var(--muted)]">Sort:</span>
            <Dropdown
              variant="pill"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              aria-label="Sort bookings"
            />
          </div>
        )}

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
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--muted)]">
            No {filter} bookings.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key}>
                {/* Date divider */}
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">{g.label}</span>
                  <span className="flex-1 h-px bg-[var(--hairline)]" />
                  <span className="text-[11px] font-semibold text-[var(--muted)] opacity-60">{g.items.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {g.items.map((b) => {
                    const chip = bookingPhaseChip(b);
                    const when = [prettyDate(b.date), b.startTime ? to12h(b.startTime) : null].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => { setDetailId(b.id); setConfirming(false); }}
                        className="w-full text-left rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 transition-transform active:scale-[0.99]"
                      >
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
                        <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)] flex items-center justify-between">
                          <div className="font-heading font-bold text-[16px] text-[var(--ink)]">{money(b.amount)}</div>
                          <span className="text-[12px] font-bold text-[var(--muted)] flex items-center gap-1">
                            Details <Icon name="chevron" size={14} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking details */}
      <BottomSheet
        open={detail !== null}
        onClose={closeDetail}
        title={detail?.venueName || 'Court booking'}
        subtitle={detail ? bookingPhaseChip(detail).label : undefined}
        footer={
          detail && detail.status === 'awaiting_payment' && !confirming ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handlePay(detail)}
                disabled={paying === detail.id}
                className="w-full h-11 rounded-xl bg-[var(--lime)] text-[var(--ink)] font-heading font-bold text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {paying === detail.id
                  ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Paying…</>
                  : <><Icon name="lock" size={16} /> Pay {money(detail.amount)}</>}
              </button>
              {payByLabel(detail.paymentDueAt) && (
                <div className="text-[12px] text-[var(--muted)] text-center">Pay by {payByLabel(detail.paymentDueAt)} to confirm your court.</div>
              )}
              {payError && <div className="text-[12px] text-[var(--coral)] font-semibold text-center">{payError}</div>}
              {isCancellable(detail) && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="w-full h-10 rounded-xl text-[var(--coral)] font-heading font-bold text-[13px]"
                >
                  Cancel request
                </button>
              )}
            </div>
          ) : detail && isCancellable(detail) ? (
            confirming ? (
              <div className="rounded-xl bg-[var(--surface-2)] p-3">
                <div className="text-[13px] font-bold text-[var(--ink)]">Cancel this booking?</div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  Your court reservation will be released and the time freed up. This can’t be undone.
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={cancelling === detail.id}
                    className="flex-1 h-10 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
                  >
                    Keep booking
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(detail.id)}
                    disabled={cancelling === detail.id}
                    className="flex-1 h-10 rounded-lg bg-[var(--coral)] text-white font-heading font-semibold text-[13px] flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {cancelling === detail.id
                      ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> Cancelling…</>
                      : 'Yes, cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="w-full h-11 rounded-xl bg-[var(--coral)]/12 text-[var(--coral)] font-heading font-bold text-[14px] flex items-center justify-center gap-1.5"
              >
                <Icon name="close" size={16} /> Cancel booking
              </button>
            )
          ) : undefined
        }
      >
        {detail && (
          <div className="px-5">
            <DetailRow label="Court" value={detail.venueName || 'Court booking'} />
            {courtLabel(detail) && <DetailRow label="Area" value={courtLabel(detail)!} />}
            <DetailRow label="Date" value={prettyDate(detail.date) || '—'} />
            <DetailRow label="Time" value={timeRange(detail) || (detail.startTime ? to12h(detail.startTime) : '—')} />
            {bookingDuration(detail) && <DetailRow label="Duration" value={bookingDuration(detail)} />}
            {detail.playerCount ? <DetailRow label="Players" value={`${detail.playerCount}`} /> : null}
            <DetailRow label="Amount" value={money(detail.amount)} />
            {detail.hasEquipmentRental && (
              <DetailRow label="Incl. equipment" value={money(detail.equipmentRentalAmount)} />
            )}
            <DetailRow label="Status" value={bookingPhaseChip(detail).label} />
            {detail.status === 'awaiting_payment' && payByLabel(detail.paymentDueAt) && (
              <DetailRow label="Pay by" value={payByLabel(detail.paymentDueAt)} />
            )}
            {detail.paymentMethod && <DetailRow label="Payment" value={detail.paymentMethod === 'test_card' ? 'Test card' : detail.paymentMethod} />}
            {bookedOn(detail) && <DetailRow label="Booked on" value={bookedOn(detail)!} />}
            <DetailRow label="Reference" value={`#${detail.id.slice(-6).toUpperCase()}`} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b-[0.5px] border-[var(--hairline)] last:border-0">
      <span className="text-[13px] text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--ink)] text-right min-w-0 truncate">{value}</span>
    </div>
  );
}
