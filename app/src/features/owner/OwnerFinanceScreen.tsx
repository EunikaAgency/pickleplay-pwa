import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import {
  getOwnerFinance,
  issueReceipt,
  MANUAL_RECEIPT_CATEGORIES,
  RECEIPT_METHODS,
  type ApiOwnerFinance,
  type ApiFinanceReceipt,
  type FinanceStatus,
  type ManualReceiptCategory,
  type ReceiptMethod,
} from '../../shared/lib/api';
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

const STATUS_LABELS: Record<FinanceStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  voided: 'Voided',
  refunded: 'Refunded',
};

const METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Credit Card',
  credit_card: 'Credit Card',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
  test: 'Test payment',
};

const METHOD_ICONS: Record<string, string> = {
  gcash: '💙',
  maya: '💜',
  card: '💳',
  credit_card: '💳',
  cash: '💵',
  bank_transfer: '🏦',
  other: '•',
  test: '🧪',
};

const AVATAR_TONES = ['#dbe7dd', '#e7dfcf', '#d8e9ea', '#f0d9d3', '#dedcf0', '#dfe4c8'];

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

function categoryLabel(category: string): string {
  if (!category) return 'Other';
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

function categoryTone(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('membership')) return 'membership';
  if (normalized.includes('coach')) return 'coaching';
  if (normalized.includes('rental')) return 'rental';
  if (normalized.includes('shop')) return 'shop';
  if (normalized.includes('event')) return 'event';
  return 'court';
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

function avatarTone(name: string): string {
  const score = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_TONES[score % AVATAR_TONES.length];
}

interface ReceiptDraft {
  venueId: string;
  payorName: string;
  payorTIN: string;
  category: ManualReceiptCategory;
  description: string;
  amount: string;
  method: ReceiptMethod;
  birInvoiceNumber: string;
}

const EMPTY_DRAFT: ReceiptDraft = {
  venueId: '',
  payorName: '',
  payorTIN: '',
  category: 'Court',
  description: '',
  amount: '',
  method: 'cash',
  birInvoiceNumber: '',
};

// The owner finance workspace is intentionally full width on desktop. The same
// data becomes compact cards below the desktop breakpoint so the route remains
// usable as a mobile PWA.
export function OwnerFinanceScreen({ onBack }: OwnerFinanceScreenProps) {
  const [result, setResult] = useState<{ key: string; data: ApiOwnerFinance | null; error: string | null }>(
    { key: '', data: null, error: null },
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [venueId, setVenueId] = useState('');
  const [status, setStatus] = useState<FinanceStatus | 'all'>('all');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ApiFinanceReceipt | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [draft, setDraft] = useState<ReceiptDraft>(EMPTY_DRAFT);
  const [issueState, setIssueState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [issueError, setIssueError] = useState('');

  const requestKey = `${venueId}|${reloadKey}`;
  useEffect(() => {
    let alive = true;
    getOwnerFinance({ venueId: venueId || undefined })
      .then((finance) => { if (alive) setResult({ key: requestKey, data: finance, error: null }); })
      .catch((reason) => {
        if (alive) setResult({
          key: requestKey,
          data: null,
          error: reason instanceof Error ? reason.message : 'Could not load finance records.',
        });
      });
    return () => { alive = false; };
  }, [requestKey, venueId]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;
  const receipts = useMemo(() => data?.receipts ?? [], [data]);
  const categories = useMemo(
    () => [...new Set(receipts.map((receipt) => receipt.category))].sort(),
    [receipts],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((receipt) => {
      if (status !== 'all' && receipt.status !== status) return false;
      if (category && receipt.category !== category) return false;
      if (!query) return true;
      return [receipt.receiptNumber, receipt.payorName, receipt.description, receipt.venueName, receipt.birInvoiceNumber]
        .some((field) => (field || '').toLowerCase().includes(query));
    });
  }, [receipts, status, category, search]);

  const summary = data?.summary;
  const venues = data?.venues ?? [];
  const scopeLabel = venueId ? (venues.find((venue) => venue.id === venueId)?.name ?? 'Venue') : 'All Venues';

  const openIssueReceipt = () => {
    setDraft((current) => ({ ...current, venueId: current.venueId || venueId || venues[0]?.id || '' }));
    setIssueOpen(true);
  };

  const exportCsv = () => {
    const esc = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Receipt #', 'Date', 'Venue', 'Customer', 'TIN', 'Category', 'Description', 'Gross', 'VAT', 'Net', 'Method', 'Status', 'BIR Invoice'];
    const lines = visible.map((receipt) => [
      receipt.receiptNumber,
      prettyDate(receipt.createdAt),
      receipt.venueName || '',
      receipt.payorName,
      receipt.payorTIN || '',
      receipt.category,
      receipt.description || '',
      receipt.amount,
      receipt.vatExempt ? 'Exempt' : receipt.vatAmount,
      receipt.netAmount,
      receipt.method ? (METHOD_LABELS[receipt.method] ?? receipt.method) : '',
      STATUS_LABELS[receipt.status],
      receipt.birInvoiceNumber || '',
    ].map(esc).join(','));
    const csv = [header.map(esc).join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bir-receipts-${toYMD(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const submitReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.venueId || !draft.payorName.trim() || !draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setIssueState('error');
      setIssueError('Complete the venue, customer, description, and gross amount.');
      return;
    }
    setIssueState('saving');
    setIssueError('');
    try {
      await issueReceipt({
        venueId: draft.venueId,
        payorName: draft.payorName.trim(),
        payorTIN: draft.payorTIN.trim() || undefined,
        category: draft.category,
        description: draft.description.trim(),
        amount,
        method: draft.method,
        birInvoiceNumber: draft.birInvoiceNumber.trim() || undefined,
      });
      setDraft(EMPTY_DRAFT);
      setIssueState('idle');
      setIssueOpen(false);
      setReloadKey((key) => key + 1);
    } catch (reason) {
      setIssueState('error');
      setIssueError(reason instanceof Error ? reason.message : 'Could not issue the receipt.');
    }
  };

  return (
    <div className="scroll owner-finance-screen">
      <main className="finance-workspace">
        <div className="finance-page-heading">
          <div>
            <button type="button" className="finance-content-back" onClick={onBack} aria-label="Back"><Icon name="back" size={16} /></button>
            <div className="finance-heading-badges">
              <span>Finance &amp; Billing</span>
              <span><Icon name="globe" size={12} /> {scopeLabel}</span>
            </div>
            <h1>Finance &amp; Receipts</h1>
            <p>Transaction records with BIR tax breakdown — {scopeLabel}</p>
          </div>
          <div className="finance-heading-actions">
            {venues.length > 1 && (
              <select className="finance-venue-select" value={venueId} onChange={(event) => setVenueId(event.target.value)} aria-label="Venue scope">
                <option value="">All Venues</option>
                {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            )}
            <button type="button" className="finance-btn finance-btn-secondary" onClick={exportCsv} disabled={visible.length === 0}>
              <Icon name="download" size={15} /> Export BIR Report
            </button>
            <button type="button" className="finance-btn finance-btn-primary" onClick={openIssueReceipt}>
              <Icon name="plus" size={14} /> Issue Receipt
            </button>
          </div>
        </div>

        {loading ? (
          <div className="finance-state"><LoadingSkeleton variant="card" count={4} /></div>
        ) : error ? (
          <div className="finance-state"><ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} /></div>
        ) : venues.length === 0 ? (
          <div className="finance-state">
            <EmptyState icon="receipt" title="No venues yet" description="List a venue first — official receipts are generated once players start paying for bookings." />
          </div>
        ) : (
          <>
            {summary && (
              <section className="finance-kpi-grid" aria-label="Revenue summary">
                <article className="finance-kpi-card gross">
                  <div className="finance-kpi-head"><span>Gross Revenue</span><i>₱</i></div>
                  <strong>{money(summary.gross)}</strong>
                  <p>Includes VAT · {summary.transactions} transaction{summary.transactions !== 1 ? 's' : ''}</p>
                </article>
                <article className="finance-kpi-card net">
                  <div className="finance-kpi-head"><span>Net Revenue</span><i><Icon name="trending_up" size={16} /></i></div>
                  <strong>{money(summary.net)}</strong>
                  <p>After 12% VAT deduction</p>
                </article>
                <article className="finance-kpi-card vat">
                  <div className="finance-kpi-head"><span>VAT Payable</span><i><Icon name="description" size={16} /></i></div>
                  <strong>{money(summary.vat)}</strong>
                  <p>Due for BIR remittance</p>
                </article>
              </section>
            )}

            <section className="finance-filterbar" aria-label="Receipt filters">
              <label className="finance-search">
                <Icon name="search" size={15} />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by receipt #, customer, or description…" />
              </label>
              <div className="finance-segment" aria-label="Status">
                {STATUS_FILTERS.map((filter) => (
                  <button key={filter.id} type="button" onClick={() => setStatus(filter.id)} className={status === filter.id ? 'active' : ''} aria-pressed={status === filter.id}>
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="finance-segment finance-category-filter" aria-label="Category">
                <button type="button" onClick={() => setCategory('')} className={category === '' ? 'active' : ''} aria-pressed={category === ''}>All</button>
                {categories.map((item) => (
                  <button key={item} type="button" onClick={() => setCategory(item)} className={category === item ? 'active' : ''} aria-pressed={category === item}>
                    {categoryLabel(item)}
                  </button>
                ))}
              </div>
            </section>

            <section className="finance-ledger" aria-label="Receipt ledger">
              {visible.length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title={receipts.length === 0 ? 'No receipts yet' : 'Nothing matches those filters'}
                  description={receipts.length === 0 ? 'An official receipt is generated automatically each time a booking is paid for.' : 'Try a different status, category, or search term.'}
                />
              ) : (
                <>
                  <div className="finance-table">
                    <div className="finance-table-head finance-table-row">
                      <span>Receipt #</span><span>Date / Time</span><span>Customer</span><span>Category</span><span>Description</span><span>Gross</span><span>VAT (12%)</span><span>Net Amt.</span><span>Method</span><span>Status</span><span>BIR Invoice</span>
                    </div>
                    {visible.map((receipt) => (
                      <button key={receipt.id} type="button" className="finance-table-row finance-table-body" onClick={() => setDetail(receipt)}>
                        <span className="finance-receipt-number">{receipt.receiptNumber}</span>
                        <span className="finance-date"><b>{prettyDate(receipt.createdAt)}</b><small>{prettyTime(receipt.createdAt)}</small></span>
                        <span className="finance-customer"><i style={{ background: avatarTone(receipt.payorName) }}>{initials(receipt.payorName)}</i><b>{receipt.payorName}</b></span>
                        <span><em className={`finance-category ${categoryTone(receipt.category)}`}>{categoryLabel(receipt.category)}</em></span>
                        <span className="finance-description">{receipt.description || '—'}</span>
                        <span className="finance-money gross-amount">{money(receipt.amount)}</span>
                        <span className="finance-money vat-amount">{receipt.vatExempt ? 'Exempt' : money(receipt.vatAmount)}</span>
                        <span className="finance-money net-amount">{money(receipt.netAmount)}</span>
                        <span className="finance-method"><i>{receipt.method ? (METHOD_ICONS[receipt.method] ?? '•') : '—'}</i>{receipt.method ? (METHOD_LABELS[receipt.method] ?? receipt.method) : '—'}</span>
                        <span><em className={`finance-status ${receipt.status}`}>{STATUS_LABELS[receipt.status]}</em></span>
                        <span className="finance-invoice">{receipt.birInvoiceNumber || '—'}</span>
                      </button>
                    ))}
                  </div>

                  <div className="finance-mobile-list">
                    {visible.map((receipt) => (
                      <button key={receipt.id} type="button" className="finance-mobile-card" onClick={() => setDetail(receipt)}>
                        <div className="finance-mobile-card-head">
                          <div><b>{receipt.receiptNumber}</b><small>{prettyDate(receipt.createdAt)} · {prettyTime(receipt.createdAt)}</small></div>
                          <em className={`finance-status ${receipt.status}`}>{STATUS_LABELS[receipt.status]}</em>
                        </div>
                        <div className="finance-mobile-customer"><i style={{ background: avatarTone(receipt.payorName) }}>{initials(receipt.payorName)}</i><span><b>{receipt.payorName}</b><small>{receipt.description || '—'}</small></span></div>
                        <div className="finance-mobile-totals"><em className={`finance-category ${categoryTone(receipt.category)}`}>{categoryLabel(receipt.category)}</em><span>VAT {receipt.vatExempt ? 'exempt' : money(receipt.vatAmount)}</span><b>{money(receipt.amount)}</b></div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {data?.truncated && <p className="finance-truncated">Showing the {receipts.length} most recent receipts. The totals cover this window only.</p>}
          </>
        )}
      </main>

      <BottomSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.receiptNumber || 'Receipt'}
        subtitle={detail ? `${detail.venueName || 'Venue'} · ${prettyDate(detail.createdAt)}` : undefined}
        flushFooter
        footer={<button type="button" onClick={() => setDetail(null)} className="finance-sheet-close">Close</button>}
      >
        {detail && (
          <div className="px-5">
            <DetailRow label="Receipt #" value={detail.receiptNumber} />
            <DetailRow label="Status" value={STATUS_LABELS[detail.status]} />
            <DetailRow label="Receipt state" value={detail.receiptStatus} />
            <DetailRow label="Customer" value={detail.payorName} />
            {detail.payorTIN && <DetailRow label="TIN" value={detail.payorTIN} />}
            <DetailRow label="Venue" value={detail.venueName || '—'} />
            <DetailRow label="Category" value={categoryLabel(detail.category)} />
            {detail.description && <DetailRow label="Description" value={detail.description} />}
            <DetailRow label="Gross" value={money(detail.amount)} />
            <DetailRow label={detail.vatExempt ? 'VAT' : `VAT (${detail.vatRate}%)`} value={detail.vatExempt ? 'Exempt' : money(detail.vatAmount)} />
            <DetailRow label="Net amount" value={money(detail.netAmount)} />
            {detail.method && <DetailRow label="Method" value={METHOD_LABELS[detail.method] ?? detail.method} />}
            <DetailRow label="BIR invoice" value={detail.birInvoiceNumber || '—'} />
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={issueOpen}
        onClose={() => { if (issueState !== 'saving') setIssueOpen(false); }}
        title="Issue Receipt"
        subtitle="Record a payment received outside an online booking."
        flushFooter
        footer={null}
      >
        <form className="finance-issue-form" onSubmit={submitReceipt}>
          <label>Venue<select value={draft.venueId} onChange={(event) => setDraft({ ...draft, venueId: event.target.value })} required><option value="">Select venue</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
          <div className="finance-form-grid">
            <label>Customer<input value={draft.payorName} onChange={(event) => setDraft({ ...draft, payorName: event.target.value })} placeholder="Customer name" required /></label>
            <label>TIN <small>Optional</small><input value={draft.payorTIN} onChange={(event) => setDraft({ ...draft, payorTIN: event.target.value })} placeholder="000-000-000" /></label>
          </div>
          <div className="finance-form-grid">
            <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ManualReceiptCategory })}>{MANUAL_RECEIPT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Method<select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as ReceiptMethod })}>{RECEIPT_METHODS.map((item) => <option key={item} value={item}>{METHOD_LABELS[item] ?? item}</option>)}</select></label>
          </div>
          <label>Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What was paid for?" required /></label>
          <div className="finance-form-grid">
            <label>Gross amount<input type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0.00" required /></label>
            <label>BIR invoice # <small>Optional</small><input value={draft.birInvoiceNumber} onChange={(event) => setDraft({ ...draft, birInvoiceNumber: event.target.value })} placeholder="BIR-2026-0001" /></label>
          </div>
          {issueState === 'error' && <p className="finance-form-error">{issueError}</p>}
          <div className="finance-form-actions"><button type="button" onClick={() => setIssueOpen(false)} disabled={issueState === 'saving'}>Cancel</button><button type="submit" disabled={issueState === 'saving'}>{issueState === 'saving' ? 'Issuing…' : 'Issue Receipt'}</button></div>
        </form>
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b-[0.5px] border-[var(--hairline)] last:border-0">
      <span className="text-[13px] text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--ink)] text-right min-w-0">{value}</span>
    </div>
  );
}
