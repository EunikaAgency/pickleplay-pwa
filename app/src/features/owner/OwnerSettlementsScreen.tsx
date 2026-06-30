import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import {
  listOwnerSettlements, getOwnerBalance, listPayoutMethods,
  createPayoutMethod, deletePayoutMethod,
  type ApiSettlement, type ApiOwnerBalance, type ApiPayoutMethod,
} from '../../shared/lib/api';
import { money } from '../bookings/bookingDisplay';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerSettlementsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[var(--surface-3)] text-[var(--muted)]' },
  pending: { label: 'Pending', className: 'bg-[var(--blue)]/15 text-[var(--blue)]' },
  processing: { label: 'Processing', className: 'bg-[var(--primary-soft)] text-[var(--primary-deep)]' },
  paid: { label: 'Paid', className: 'bg-[var(--lime)] text-[var(--ink)]' },
  disputed: { label: 'Disputed', className: 'bg-[var(--coral)]/15 text-[var(--coral)]' },
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  gcash: 'GCash',
  maya: 'Maya',
  other: 'Other',
};

function prettyPeriod(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start} – ${end}`;
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

export function OwnerSettlementsScreen(props: OwnerSettlementsScreenProps) {
  const { onBack } = props;
  const [settlements, setSettlements] = useState<ApiSettlement[]>([]);
  const [balance, setBalance] = useState<ApiOwnerBalance[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<ApiPayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Detail sheet
  const [detail, setDetail] = useState<ApiSettlement | null>(null);

  // Add payout method sheet
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethod, setNewMethod] = useState({ venueId: '', method: 'bank_transfer', accountName: '', accountNumber: '', bankName: '' });
  const [addingMethod, setAddingMethod] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      listOwnerSettlements().catch(() => [] as ApiSettlement[]),
      getOwnerBalance().catch(() => [] as ApiOwnerBalance[]),
      listPayoutMethods().catch(() => [] as ApiPayoutMethod[]),
    ])
      .then(([s, b, p]) => {
        if (alive) { setSettlements(s); setBalance(b); setPayoutMethods(p); }
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load settlements.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Total unsenttled across all venues.
  const totalUnsenttled = useMemo(() => balance.reduce((sum, b) => sum + (b.unsenttledNet || 0), 0), [balance]);

  const handleAddMethod = async () => {
    if (!newMethod.venueId || !newMethod.accountName || !newMethod.accountNumber) {
      setMethodError('Please fill in all required fields.');
      return;
    }
    setAddingMethod(true);
    setMethodError(null);
    try {
      await createPayoutMethod(newMethod);
      setShowAddMethod(false);
      setNewMethod({ venueId: '', method: 'bank_transfer', accountName: '', accountNumber: '', bankName: '' });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMethodError(e instanceof Error ? e.message : 'Could not add payout method.');
    } finally {
      setAddingMethod(false);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    try {
      await deletePayoutMethod(id);
      setPayoutMethods((prev) => prev.filter((m) => m.id !== id));
    } catch { /* refetch on next open */ }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Settlements" eyebrow="Payouts & reconciliation" />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <>
            {/* Balance hero */}
            {balance.length > 0 && (
              <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 mb-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)] mb-3">
                  Unsenttled balance
                </div>
                <div className="font-heading font-bold text-[28px] text-[var(--ink)] tabular-nums">
                  {money(totalUnsenttled)}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  Across {balance.length} venue{balance.length !== 1 ? 's' : ''}
                </div>
                {balance.map((b) => (
                  <div key={b.venueId} className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[var(--ink)]">{b.venueName || 'Venue'}</span>
                    <span className="text-[var(--muted)]">
                      {b.bookingCount} booking{b.bookingCount !== 1 ? 's' : ''} · {money(b.unsenttledNet)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Payout methods */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide">
                  Payout methods
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddMethod(true)}
                  className="text-[12px] font-bold text-[var(--primary)] flex items-center gap-1"
                >
                  <Icon name="plus" size={14} /> Add
                </button>
              </div>
              {payoutMethods.length === 0 ? (
                <div className="text-[13px] text-[var(--muted)] py-2">
                  No payout methods yet. Add one to receive settlements.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {payoutMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--ink)]">
                          {METHOD_LABELS[pm.method] || pm.method}
                          {pm.isDefault && <span className="ml-1.5 text-[10px] font-bold text-[var(--primary)] uppercase">Default</span>}
                        </div>
                        <div className="text-[12px] text-[var(--muted)] truncate">
                          {pm.accountName} · {pm.bankName ? `${pm.bankName} · ` : ''}•••{pm.accountNumber.slice(-4)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMethod(pm.id)}
                        className="text-[11px] font-semibold text-[var(--coral)] shrink-0 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settlements list */}
            <div className="mb-2">
              <span className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wide">
                Settlement history
              </span>
            </div>
            {settlements.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="No settlements yet"
                description="Once your revenue is processed, settlement reports will appear here."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {settlements.map((s) => {
                  const chip = STATUS_CHIP[s.status] || STATUS_CHIP.draft;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDetail(s)}
                      className="w-full text-left rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 transition-transform active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">
                            {s.settlementRef}
                          </div>
                          <div className="text-[12px] text-[var(--muted)] mt-0.5">
                            {prettyPeriod(s.periodStart, s.periodEnd)}
                          </div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                          {chip.label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[12px] text-[var(--muted)]">{s.totalBookings} bookings</span>
                        <span className="font-heading font-bold text-[16px] text-[var(--ink)] tabular-nums">{money(s.netPayout)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Settlement detail sheet */}
      <BottomSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.settlementRef || 'Settlement'}
        subtitle={detail ? prettyPeriod(detail.periodStart, detail.periodEnd) : undefined}
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
            <DetailRow label="Reference" value={detail.settlementRef} />
            <DetailRow label="Period" value={prettyPeriod(detail.periodStart, detail.periodEnd)} />
            <DetailRow label="Bookings" value={`${detail.totalBookings}`} />
            <DetailRow label="Gross revenue" value={money(detail.grossRevenue)} />
            <DetailRow label="Platform fees" value={money(detail.platformFees)} />
            <DetailRow label="Net payout" value={money(detail.netPayout)} />
            <DetailRow label="Status" value={(STATUS_CHIP[detail.status] || STATUS_CHIP.draft).label} />
            {detail.payoutMethod && <DetailRow label="Method" value={METHOD_LABELS[detail.payoutMethod] || detail.payoutMethod} />}
            {detail.payoutRef && <DetailRow label="Payout ref" value={detail.payoutRef} />}
            {detail.paidAt && <DetailRow label="Paid on" value={new Date(detail.paidAt).toLocaleDateString()} />}
            {detail.notes && <DetailRow label="Notes" value={detail.notes} />}
          </div>
        )}
      </BottomSheet>

      {/* Add payout method sheet */}
      <BottomSheet
        open={showAddMethod}
        onClose={() => { setShowAddMethod(false); setMethodError(null); }}
        title="Add payout method"
        flushFooter
        footer={
          <div className="flex flex-col gap-2">
            {methodError && (
              <div className="text-[12px] text-[var(--coral)] font-semibold text-center">{methodError}</div>
            )}
            <button
              type="button"
              onClick={handleAddMethod}
              disabled={addingMethod}
              className="w-full h-11 rounded-xl bg-[var(--lime)] text-[var(--ink)] font-heading font-bold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {addingMethod
                ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</>
                : <><Icon name="check" size={16} /> Save method</>}
            </button>
          </div>
        }
      >
        <div className="px-5 flex flex-col gap-3">
          {/* Method type */}
          <label className="block">
            <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Method</span>
            <select
              value={newMethod.method}
              onChange={(e) => setNewMethod((m) => ({ ...m, method: e.target.value }))}
              className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)]"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="other">Other</option>
            </select>
          </label>

          {/* Account name */}
          <label className="block">
            <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Account name</span>
            <input
              type="text"
              value={newMethod.accountName}
              onChange={(e) => setNewMethod((m) => ({ ...m, accountName: e.target.value }))}
              placeholder="Juan Dela Cruz"
              className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          </label>

          {/* Account number */}
          <label className="block">
            <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Account number</span>
            <input
              type="text"
              value={newMethod.accountNumber}
              onChange={(e) => setNewMethod((m) => ({ ...m, accountNumber: e.target.value }))}
              placeholder="0000 0000 0000 0000"
              className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          </label>

          {/* Bank name (for bank_transfer) */}
          {newMethod.method === 'bank_transfer' && (
            <label className="block">
              <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wide">Bank name</span>
              <input
                type="text"
                value={newMethod.bankName}
                onChange={(e) => setNewMethod((m) => ({ ...m, bankName: e.target.value }))}
                placeholder="BDO / BPI / Metrobank…"
                className="mt-1 w-full h-10 rounded-lg border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)]"
              />
            </label>
          )}
        </div>
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
