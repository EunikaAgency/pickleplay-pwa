import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { BarChart, ChartLegend, type BarDatum } from '../../shared/components/ui/Chart';
import { listPayments, type ApiPayment } from '../../shared/lib/api';
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
                  <div key={p.id} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
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
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
