import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { BarChart, ChartLegend, type BarDatum } from '../../shared/components/ui/Chart';
import { listPayments, getBooking, type ApiPayment, type ApiBooking } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface PaymentHistoryScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€', GBP: '£' };

// Local money formatter — the profile slice must not import the bookings slice's
// `bookingDisplay`, so a small copy lives here (same style as `money` there).
function money(amount: number | null | undefined, currency = 'PHP'): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? '';
  const n = typeof amount === 'number' ? amount : 0;
  const formatted = n % 1 === 0
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${formatted}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A payment "counts" as money out once it's settled. Checkout writes 'completed';
// older/seeded rows use 'paid' — treat both as paid spend. Pending is shown apart.
const isPaid = (p: ApiPayment) => p.status === 'completed' || p.status === 'paid';
const isPending = (p: ApiPayment) => (p.status ?? 'pending') === 'pending';
const isRefunded = (p: ApiPayment) => p.status === 'refunded';

/** Status → chip styling, matching the booking status chips' tone language. */
function statusChip(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case 'completed':
    case 'paid':      return { label: 'Paid', className: 'bg-[var(--lime-soft,#eef6cc)] text-[#5b7400]' };
    case 'pending':   return { label: 'Pending', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
    case 'refunded':  return { label: 'Refunded', className: 'bg-[var(--surface-3)] text-[var(--ink-2)]' };
    case 'failed':    return { label: 'Failed', className: 'bg-[#fbe2dc] text-[var(--coral)]' };
    default:          return { label: status || '—', className: 'bg-[var(--surface-3)] text-[var(--muted)]' };
  }
}

function prettyDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Jun 24, 2026 · 3:45 PM" — the fuller stamp shown on a receipt. */
function receiptDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** "6:00 PM" from a "18:00" 24-hour time (local copy — profile must not import the bookings slice). */
function to12hReceipt(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

/** "Jun 24, 2026" from a YYYY-MM-DD play date. */
function playDateLabel(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Human label for a payment method code ('test_card' → 'Test card', 'gcash' → 'Gcash'). */
function methodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  if (method === 'test_card') return 'Test card';
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Ink colour for the rubber-stamp on the receipt (border + text), keyed off status. */
function stampColor(status: string | null | undefined): string {
  switch (status) {
    case 'completed':
    case 'paid':      return '#5b7400';
    case 'refunded':  return 'var(--ink-2)';
    case 'failed':    return 'var(--coral)';
    default:          return 'var(--muted)';
  }
}

interface MonthBucket { key: string; label: string; completed: number; pending: number }

/** Build the trailing-`count`-months spend buckets (oldest → newest). */
function buildMonthly(payments: ApiPayment[], count: number): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  const index = new Map<string, MonthBucket>();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const b: MonthBucket = { key, label: MONTHS[d.getMonth()], completed: 0, pending: 0 };
    buckets.push(b);
    index.set(key, b);
  }
  for (const p of payments) {
    if (!p.createdAt) continue;
    const d = new Date(p.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const b = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!b) continue;
    if (isPaid(p)) b.completed += p.amount || 0;
    else if (isPending(p)) b.pending += p.amount || 0;
  }
  return buckets;
}

export function PaymentHistoryScreen({ onNavigate, onBack }: PaymentHistoryScreenProps) {
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The receipt shown in the popup (by id), or null when closed.
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listPayments()
      .then((items) => { if (alive) setPayments(items); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your payments.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const currency = payments[0]?.currency || 'PHP';

  const { totalSpent, thisMonth, pendingTotal, completedCount } = useMemo(() => {
    const now = new Date();
    let totalSpent = 0, thisMonth = 0, pendingTotal = 0, completedCount = 0;
    for (const p of payments) {
      if (isPaid(p)) {
        totalSpent += p.amount || 0;
        completedCount += 1;
        const d = p.createdAt ? new Date(p.createdAt) : null;
        if (d && !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          thisMonth += p.amount || 0;
        }
      } else if (isPending(p)) {
        pendingTotal += p.amount || 0;
      }
    }
    return { totalSpent, thisMonth, pendingTotal, completedCount };
  }, [payments]);

  const monthly = useMemo(() => buildMonthly(payments, 6), [payments]);
  const chartData: BarDatum[] = monthly.map((m) => ({
    label: m.label,
    segments: [
      { value: m.completed, color: 'var(--primary)' },
      { value: m.pending, color: 'var(--surface-3)' },
    ],
  }));
  const hasChartData = monthly.some((m) => m.completed > 0 || m.pending > 0);

  const receipt = receiptId ? payments.find((p) => p.id === receiptId) ?? null : null;

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Payment history" eyebrow="Your spend report" />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon="payments"
            title="No payments yet"
            description="When you pay for a court booking or host a game, your receipts and spend report show up here."
            action={{ label: 'Find a court', onPress: () => onNavigate('nearby') }}
          />
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Total spent</div>
                <div className="font-heading font-extrabold text-[22px] text-[var(--ink)] mt-1">{money(totalSpent, currency)}</div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">{completedCount} paid {completedCount === 1 ? 'payment' : 'payments'}</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">This month</div>
                <div className="font-heading font-extrabold text-[22px] text-[var(--ink)] mt-1">{money(thisMonth, currency)}</div>
                {pendingTotal > 0 && (
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">{money(pendingTotal, currency)} pending</div>
                )}
              </div>
            </div>

            {/* Spend graph */}
            <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mt-3">
              <div className="flex items-center justify-between">
                <div className="font-heading font-bold text-[15px] text-[var(--ink)]">Spend over time</div>
                <div className="text-[11px] font-semibold text-[var(--muted)]">Last 6 months</div>
              </div>
              <div className="mt-4">
                <BarChart
                  data={chartData}
                  height={150}
                  maxLabels={6}
                  formatValue={(n) => money(n, currency)}
                  emptyLabel="No spend in this period"
                />
              </div>
              {hasChartData && pendingTotal > 0 && (
                <ChartLegend items={[
                  { label: 'Paid', color: 'var(--primary)' },
                  { label: 'Pending', color: 'var(--surface-3)' },
                ]} />
              )}
            </div>

            {/* Receipts */}
            <div className="font-heading font-bold text-[15px] text-[var(--ink)] mt-6 mb-2">Receipts</div>
            <div className="flex flex-col gap-3">
              {payments.map((p) => {
                const chip = statusChip(p.status);
                const refunded = isRefunded(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReceiptId(p.id)}
                    className="w-full text-left rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--primary)]">
                          <Icon name={p.bookingId ? 'calendar' : 'payments'} size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">
                            {p.bookingId ? 'Court booking' : 'Payment'}
                          </div>
                          <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5">
                            {prettyDateTime(p.createdAt)}
                            {p.method ? ` · ${p.method.replace(/_/g, ' ')}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`font-heading font-bold text-[15px] ${refunded ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>
                          {money(p.amount, p.currency || currency)}
                        </div>
                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.className}`}>
                          {chip.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t-[0.5px] border-[var(--hairline)] flex items-center justify-end">
                      <span className="text-[11.5px] font-bold text-[var(--primary)] flex items-center gap-0.5">
                        View receipt <Icon name="chevron" size={14} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Receipt popup — a paper-style slip for the tapped payment */}
      <BottomSheet
        open={receipt !== null}
        onClose={() => setReceiptId(null)}
        flushFooter
        footer={
          <button
            type="button"
            onClick={() => setReceiptId(null)}
            className="w-full h-11 rounded-xl bg-[#ccff33] text-[var(--ink)] font-heading font-bold text-[15px]"
          >
            Close
          </button>
        }
      >
        {receipt && <ReceiptCard payment={receipt} fallbackCurrency={currency} />}
      </BottomSheet>
    </div>
  );
}

/** The scalloped "paper" receipt rendered inside the popup. */
function ReceiptCard({ payment, fallbackCurrency }: { payment: ApiPayment; fallbackCurrency: string }) {
  const chip = statusChip(payment.status);
  const refunded = isRefunded(payment);
  const ink = stampColor(payment.status);
  const amount = money(payment.amount, payment.currency || fallbackCurrency);

  // Pull in the linked booking so the receipt shows where it was for (venue,
  // court, session). `undefined` = still loading, `null` = none/failed.
  const [booking, setBooking] = useState<ApiBooking | null | undefined>(
    payment.bookingId ? undefined : null,
  );
  useEffect(() => {
    const id = payment.bookingId;
    if (!id) return;
    let alive = true;
    getBooking(id)
      .then((b) => { if (alive) setBooking(b); })
      .catch(() => { if (alive) setBooking(null); });
    return () => { alive = false; };
  }, [payment.bookingId]);

  const courtLabel = booking ? (booking.courtName || (booking.courtNumber ? `Court ${booking.courtNumber}` : '')) : '';
  const sessionWhen = booking
    ? [
        playDateLabel(booking.date),
        [to12hReceipt(booking.startTime), booking.endTime ? to12hReceipt(booking.endTime) : '']
          .filter(Boolean)
          .join('–'),
      ].filter(Boolean).join(' · ')
    : '';
  const venueSub = [courtLabel, sessionWhen].filter(Boolean).join(' · ');

  return (
    <div className="px-4">
      <div className="relative mx-auto w-full">
        {/* torn top edge */}
        <div
          aria-hidden
          style={{
            height: 10,
            background: 'radial-gradient(circle at 5px 0, var(--bg) 0 5px, var(--surface) 5px)',
            backgroundSize: '10px 10px',
            backgroundRepeat: 'repeat-x',
          }}
        />

        <div className="relative bg-[var(--surface)] px-5 pb-5">
          {/* rubber stamp */}
          <span
            className="absolute right-2.5 top-3 rotate-[-9deg] rounded-md border-[2.5px] px-2.5 py-1 font-heading font-extrabold text-[13px] uppercase tracking-wider"
            style={{ color: ink, borderColor: ink, opacity: 0.85 }}
          >
            {chip.label}
          </span>

          {/* brand */}
          <div className="text-center pt-3">
            <span className="inline-flex w-11 h-11 rounded-full bg-[var(--lime)] items-center justify-center text-[var(--lime-ink)]">
              <Icon name="paddle" size={24} />
            </span>
            <div className="font-heading font-extrabold text-[18px] text-[var(--ink)] mt-2">PickleBallers</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] mt-0.5">Payment receipt</div>
          </div>

          <div className="border-t border-dashed border-[var(--hairline)] my-4" />

          {/* venue (the place this payment was for) */}
          {payment.bookingId && (
            <div className="text-center mb-4">
              {booking === undefined ? (
                <div className="h-[18px] w-40 mx-auto rounded bg-[var(--surface-2)] animate-pulse" />
              ) : booking?.venueName ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-[var(--muted)]">
                    <Icon name="map_pin" size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Venue</span>
                  </div>
                  <div className="font-heading font-bold text-[16px] text-[var(--ink)] mt-1">{booking.venueName}</div>
                  {venueSub && <div className="text-[12px] font-semibold text-[var(--muted)] mt-0.5">{venueSub}</div>}
                </>
              ) : null}
            </div>
          )}

          {/* headline amount */}
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              {refunded ? 'Amount refunded' : 'Amount paid'}
            </div>
            <div className={`font-heading font-extrabold text-[34px] leading-none mt-1.5 ${refunded ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>
              {amount}
            </div>
          </div>

          <div className="border-t border-dashed border-[var(--hairline)] my-4" />

          {/* line items */}
          <div className="flex flex-col gap-2.5">
            <ReceiptRow label="Description" value={payment.bookingId ? 'Court booking' : 'Payment'} />
            <ReceiptRow label="Date" value={receiptDateTime(payment.createdAt)} />
            <ReceiptRow label="Method" value={methodLabel(payment.method)} />
            {payment.provider && <ReceiptRow label="Provider" value={methodLabel(payment.provider)} />}
            <ReceiptRow label="Status" value={chip.label} />
            {payment.bookingId && <ReceiptRow label="Booking ref" value={`#${payment.bookingId.slice(-6).toUpperCase()}`} />}
            {payment.notes && <ReceiptRow label="Note" value={payment.notes} />}
            <ReceiptRow label="Payment ref" value={`#${payment.id.slice(-8).toUpperCase()}`} />
          </div>

          <div className="border-t border-dashed border-[var(--hairline)] my-4" />

          {/* total */}
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-[15px] text-[var(--ink)]">{refunded ? 'Total refunded' : 'Total paid'}</span>
            <span className="font-heading font-extrabold text-[19px] text-[var(--ink)]">{amount}</span>
          </div>

          {/* footer */}
          <div className="text-center mt-5">
            <div className="text-[12px] font-semibold text-[var(--muted)]">Thank you for playing! 🎾</div>
            <Barcode seed={payment.id} />
            <div className="text-[10px] tracking-[0.22em] text-[var(--muted)] mt-1.5 font-mono">
              {payment.id.slice(-12).toUpperCase()}
            </div>
          </div>
        </div>

        {/* torn bottom edge */}
        <div
          aria-hidden
          style={{
            height: 10,
            background: 'radial-gradient(circle at 5px 10px, var(--bg) 0 5px, var(--surface) 5px)',
            backgroundSize: '10px 10px',
            backgroundRepeat: 'repeat-x',
          }}
        />
      </div>
    </div>
  );
}

/** One "label …… value" line on the receipt, with a dotted leader between. */
function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[12.5px] text-[var(--muted)] shrink-0">{label}</span>
      <span className="flex-1 self-end mb-[3px] border-b border-dotted border-[var(--hairline)]" />
      <span className="text-[12.5px] font-semibold text-[var(--ink)] shrink-0 text-right max-w-[62%] truncate">{value}</span>
    </div>
  );
}

/** A decorative barcode strip — bar widths derived deterministically from the id. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 52; i++) {
      const c = seed.charCodeAt(i % seed.length) + i * 7;
      out.push((c % 3) + 1);
    }
    return out;
  }, [seed]);
  return (
    <div className="flex items-stretch justify-center gap-[2px] h-9 mt-3" aria-hidden>
      {bars.map((w, i) => (
        <span key={i} className="bg-[var(--ink)]" style={{ width: w, opacity: i % 6 === 0 ? 0.9 : 0.7 }} />
      ))}
    </div>
  );
}
