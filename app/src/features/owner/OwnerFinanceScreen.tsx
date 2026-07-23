import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { getOwnerFinance, type ApiOwnerFinance, type ApiFinanceReceipt, type FinanceStatus } from '../../shared/lib/api';
import { money } from '../bookings/bookingDisplay';

interface OwnerFinanceScreenProps {
  onBack: () => void;
}

const STATUS_FILTERS: { id: FinanceStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'voided', label: 'Voided' },
  { id: 'refunded', label: 'Refunded' },
];

const STATUS_CHIP: Record<FinanceStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-[var(--lime)] text-[var(--on-accent)]' },
  pending: { label: 'Pending', className: 'bg-[var(--surface-3)] text-[var(--muted)]' },
  voided: { label: 'Voided', className: 'bg-[var(--surface-3)] text-[var(--muted)] line-through' },
  refunded: { label: 'Refunded', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' },
};

// Payment methods as they're stored on the Payment doc. Anything unmapped
// falls through as-is rather than being hidden.
const METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
  credit_card: 'Credit card',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  test: 'Test payment',
};

function prettyDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function prettyTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Owner Finance & Receipts — the BIR-compliant transaction record across every
// venue the owner holds, with the gross / net / VAT-payable roll-up they need
// for remittance. Read-only: receipts are auto-generated when a booking is
// paid, so this reports on them rather than creating them.
export function OwnerFinanceScreen({ onBack }: OwnerFinanceScreenProps) {
  // One state cell keyed by the request that produced it, so "loading" is
  // DERIVED (result.key !== requestKey) rather than set from inside the effect.
  // Changing the venue scope therefore shows the skeleton again instead of
  // leaving the previous venue's numbers on screen while the next load lands.
  const [result, setResult] = useState<{ key: string; data: ApiOwnerFinance | null; error: string | null }>(
    { key: '', data: null, error: null },
  );
  const [reloadKey, setReloadKey] = useState(0);

  const [venueId, setVenueId] = useState('');            // '' = all venues
  const [status, setStatus] = useState<FinanceStatus | 'all'>('all');
  const [category, setCategory] = useState('');           // '' = all categories
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ApiFinanceReceipt | null>(null);

  // Venue scope goes to the server; status/category/search stay client-side so
  // typing doesn't refetch on every keystroke.
  const requestKey = `${venueId}|${reloadKey}`;
  useEffect(() => {
    let alive = true;
    getOwnerFinance({ venueId: venueId || undefined })
      .then((d) => { if (alive) setResult({ key: requestKey, data: d, error: null }); })
      .catch((e) => {
        if (alive) setResult({ key: requestKey, data: null, error: e instanceof Error ? e.message : 'Could not load finance records.' });
      });
    return () => { alive = false; };
  }, [requestKey, venueId]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  const receipts = useMemo(() => data?.receipts ?? [], [data]);

  const categories = useMemo(
    () => [...new Set(receipts.map((r) => r.category))].sort(),
    [receipts],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receipts.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (category && r.category !== category) return false;
      if (!q) return true;
      return [r.receiptNumber, r.payorName, r.description, r.venueName]
        .some((f) => (f || '').toLowerCase().includes(q));
    });
  }, [receipts, status, category, search]);

  // The KPI cards always report the owner's real tax position for the loaded
  // window (paid-only, server-computed) — narrowing the list with a filter
  // must not make VAT payable look smaller than it is.
  const summary = data?.summary;

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Receipt #', 'Date', 'Venue', 'Payor', 'TIN', 'Category', 'Description', 'Gross', 'VAT', 'Net', 'Method', 'Status'];
    const lines = visible.map((r) => [
      r.receiptNumber, prettyDate(r.createdAt), r.venueName || '', r.payorName, r.payorTIN || '',
      r.category, r.description || '', r.amount, r.vatExempt ? 'Exempt' : r.vatAmount, r.netAmount,
      r.method ? (METHOD_LABELS[r.method] ?? r.method) : '', STATUS_CHIP[r.status].label,
    ].map(esc).join(','));
    const csv = [header.map(esc).join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bir-receipts-${toYMD(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const venues = data?.venues ?? [];
  const scopeLabel = venueId ? (venues.find((v) => v.id === venueId)?.name ?? 'Venue') : 'All venues';

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Finance & Receipts"
        eyebrow="Finance & billing"
        subtitle={`Transaction records with BIR tax breakdown — ${scopeLabel}`}
        action={
          receipts.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              aria-label="Export BIR report as CSV"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px] shrink-0 active:scale-95 transition-transform"
            >
              <Icon name="download" size={15} /> Export
            </button>
          ) : undefined
        }
      />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : venues.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No venues yet"
            description="List a venue first — official receipts are generated automatically once players start paying for bookings."
          />
        ) : (
          <>
            {/* KPI roll-up — paid receipts only, so VAT payable is what's owed. */}
            {summary && (
              <div className="flex flex-col gap-3 mb-5">
                <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Gross revenue</div>
                  <div className="font-heading font-bold text-[28px] text-[var(--ink)] tabular-nums mt-1">{money(summary.gross)}</div>
                  <div className="text-[12px] text-[var(--muted)] mt-0.5">
                    Includes VAT · {summary.transactions} paid transaction{summary.transactions !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Net revenue</div>
                    <div className="font-heading font-bold text-[20px] text-[var(--ink)] tabular-nums mt-1">{money(summary.net)}</div>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">After VAT</div>
                  </div>
                  <div className="rounded-2xl bg-[var(--coral)]/10 border-[0.5px] border-[var(--coral)]/25 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--coral)]">VAT payable</div>
                    <div className="font-heading font-bold text-[20px] text-[var(--coral)] tabular-nums mt-1">{money(summary.vat)}</div>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">Due for BIR remittance</div>
                  </div>
                </div>
              </div>
            )}

            {/* Venue scope — only worth showing to a multi-venue owner. */}
            {venues.length > 1 && (
              <label className="block mb-3">
                <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Venue</span>
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                >
                  <option value="">All venues</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
            )}

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt #, customer, or description…"
              className="w-full h-10 rounded-full border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-4 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] mb-3"
            />

            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatus(f.id)}
                  aria-pressed={status === f.id}
                  className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${
                    status === f.id ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 mt-2">
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  aria-pressed={category === ''}
                  className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${
                    category === '' ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={category === cat}
                    className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${
                      category === cat ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Receipt rows — cards, not a table: this is a mobile console. */}
            <div className="mt-4">
              {visible.length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title={receipts.length === 0 ? 'No receipts yet' : 'Nothing matches those filters'}
                  description={
                    receipts.length === 0
                      ? 'An official receipt is generated automatically each time a booking is paid for.'
                      : 'Try a different status, category, or search term.'
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {visible.map((r) => {
                    const chip = STATUS_CHIP[r.status];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDetail(r)}
                        className="w-full text-left rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 transition-transform active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{r.receiptNumber}</div>
                            <div className="text-[12px] text-[var(--muted)] mt-0.5">
                              {prettyDate(r.createdAt)}{prettyTime(r.createdAt) ? ` · ${prettyTime(r.createdAt)}` : ''} · {r.payorName}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                            {chip.label}
                          </span>
                        </div>
                        {r.description && (
                          <div className="text-[12px] text-[var(--muted)] mt-1.5 line-clamp-2">{r.description}</div>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                            {r.category}
                          </span>
                          <span className="text-[12px] text-[var(--muted)] tabular-nums">
                            VAT {r.vatExempt ? 'exempt' : money(r.vatAmount)}
                          </span>
                          <span className="font-heading font-bold text-[16px] text-[var(--ink)] tabular-nums">{money(r.amount)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {data?.truncated && (
              <div className="text-[12px] text-[var(--muted)] mt-3">
                Showing the {receipts.length} most recent receipts — the totals above cover this window only.
              </div>
            )}

            {/* VAT breakdown by category — paid receipts only, same basis as the KPIs. */}
            {summary && summary.byCategory.length > 0 && (
              <div className="mt-6">
                <div className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide mb-3">
                  VAT breakdown by category
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {summary.byCategory.map((cat) => (
                    <div key={cat.category} className="rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3">
                      <div className="text-[12px] font-bold text-[var(--ink)]">{cat.category}</div>
                      <div className="font-heading font-bold text-[17px] text-[var(--ink)] tabular-nums mt-0.5">{money(cat.gross)}</div>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        VAT {money(cat.vat)} · {cat.sharePct}% of gross
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Receipt detail */}
      <BottomSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.receiptNumber || 'Receipt'}
        subtitle={detail ? `${detail.venueName || 'Venue'} · ${prettyDate(detail.createdAt)}` : undefined}
        flushFooter
        footer={
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="w-full h-11 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] font-heading font-bold text-[14px]"
          >
            Close
          </button>
        }
      >
        {detail && (
          <div className="px-5">
            <DetailRow label="Receipt #" value={detail.receiptNumber} />
            <DetailRow label="Status" value={STATUS_CHIP[detail.status].label} />
            <DetailRow label="Receipt state" value={detail.receiptStatus} />
            <DetailRow label="Payor" value={detail.payorName} />
            {detail.payorTIN && <DetailRow label="TIN" value={detail.payorTIN} />}
            <DetailRow label="Venue" value={detail.venueName || '—'} />
            <DetailRow label="Category" value={detail.category} />
            {detail.description && <DetailRow label="Description" value={detail.description} />}
            <DetailRow label="Gross" value={money(detail.amount)} />
            <DetailRow
              label={detail.vatExempt ? 'VAT' : `VAT (${detail.vatRate}%)`}
              value={detail.vatExempt ? 'Exempt' : money(detail.vatAmount)}
            />
            <DetailRow label="Net amount" value={money(detail.netAmount)} />
            {detail.discountAmount > 0 && (
              <DetailRow
                label={detail.discountCategory === 'senior' ? 'Senior discount' : detail.discountCategory === 'pwd' ? 'PWD discount' : 'Discount'}
                value={money(detail.discountAmount)}
              />
            )}
            {detail.method && <DetailRow label="Method" value={METHOD_LABELS[detail.method] ?? detail.method} />}
            {detail.bookingDate && <DetailRow label="Booking date" value={detail.bookingDate} />}
            {detail.issuedAt && <DetailRow label="Issued" value={prettyDate(detail.issuedAt)} />}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b-[0.5px] border-[var(--hairline)] last:border-0">
      <span className="text-[13px] text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--ink)] text-right min-w-0 truncate">{value}</span>
    </div>
  );
}
