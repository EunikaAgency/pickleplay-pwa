import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import {
  listSubscriptionPlans,
  deleteSubscriptionPlan,
  duplicateSubscriptionPlan,
  toggleSubscriptionPlan,
  type ApiSubscriptionPlan,
} from '../../shared/lib/api';
import { CreateEditPlanSheet } from './components/CreateEditPlanSheet';
import type { Navigate } from '../../shared/lib/navigation';

interface SubscriptionPlansScreenProps {
  venueId: string;
  venueName: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const BILLING_LABELS: Record<string, string> = {
  weekly: 'week',
  monthly: 'month',
  quarterly: '3 months',
  semiAnnual: '6 months',
  annual: 'year',
  custom: 'days',
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-[var(--lime-soft)] text-[var(--lime-ink)]',
  draft: 'bg-[var(--surface-2)] text-[var(--muted)]',
  disabled: 'bg-[var(--coral-soft)] text-[var(--coral)]',
};

function priceLabel(plan: ApiSubscriptionPlan): string {
  const v = plan.currentVersion;
  if (!v) return '—';
  const sym = v.currency === 'PHP' ? '₱' : v.currency;
  const amt = v.price.toLocaleString();
  const cycle = v.billingCycle === 'custom' && v.customBillingDays
    ? `${v.customBillingDays} days`
    : BILLING_LABELS[v.billingCycle] ?? v.billingCycle;
  return `${sym}${amt} / ${cycle}`;
}

export function SubscriptionPlansScreen({ venueId, venueName, onBack }: SubscriptionPlansScreenProps) {
  const [plans, setPlans] = useState<ApiSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // ── Create / Edit sheet ──────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ApiSubscriptionPlan | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Error popup (replaces the old blocking alert() on a failed delete).
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPlans = () => {
    setLoading(true);
    setError(false);
    listSubscriptionPlans(venueId)
      .then((rows) => { setPlans(rows); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPlans(); }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditingPlan(null); setSheetOpen(true); };
  const openEdit = (plan: ApiSubscriptionPlan) => { setEditingPlan(plan); setSheetOpen(true); };
  const closeSheet = () => { setSheetOpen(false); setEditingPlan(null); };

  const onSaved = (plan: ApiSubscriptionPlan) => {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === plan.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = plan;
        return next;
      }
      return [plan, ...prev];
    });
    closeSheet();
  };

  const handleDuplicate = async (planId: string) => {
    setPending(planId);
    try {
      const dup = await duplicateSubscriptionPlan(planId);
      setPlans((prev) => [dup, ...prev]);
    } catch { /* ignore */ }
    finally { setPending(null); }
  };

  const handleToggle = async (plan: ApiSubscriptionPlan) => {
    if (plan.status === 'draft') return;
    setPending(plan.id);
    try {
      const updated = await toggleSubscriptionPlan(plan.id);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    } catch { /* ignore */ }
    finally { setPending(null); }
  };

  const handleDelete = async (plan: ApiSubscriptionPlan) => {
    if (!confirm(`Delete "${plan.name}"? This can't be undone.${plan.memberCount > 0 ? ` It has ${plan.memberCount} active subscriber${plan.memberCount === 1 ? '' : 's'} — disable it instead.` : ''}`)) return;
    setPending(plan.id);
    try {
      await deleteSubscriptionPlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (e: any) {
      setErrorMsg(e?.message ?? e?.error?.message ?? 'Could not delete this plan.');
    }
    finally { setPending(null); }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        <ScreenHeader onBack={onBack} eyebrow="Membership" title="Subscription Plans" />
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} eyebrow="Membership" title="Subscription Plans" />
        <ErrorState title="Couldn't load plans" message="Tap to retry." onRetry={loadPlans} />
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom">
      <ScreenHeader onBack={onBack} eyebrow="Membership" title="Subscription Plans" />

      <div className="px-5 space-y-4">
        {/* ── Intro + Create ──────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between items-start gap-3">
          <p className="t-sm text-[var(--muted)]">
            Manage the subscription plans available for {venueName || 'this venue'}. Only{' '}
            <strong className="text-[var(--ink)]">Active</strong> plans appear to players.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-full bg-[var(--primary)] text-white font-bold text-[12px]"
          >
            <Icon name="add" size={14} /> Create Plan
          </button>
        </div>

        {/* ── Plans list ──────────────────────────────────────────── */}
        {plans.length === 0 ? (
          <EmptyState
            icon="card_membership"
            title="No subscription plans yet"
            description="Create a plan so players can subscribe to your venue's membership."
            action={{ label: 'Create your first plan', onPress: openCreate }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan) => {
              const v = plan.currentVersion;
              const isBusy = pending === plan.id;
              return (
                <div
                  key={plan.id}
                  className="rounded-[18px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 space-y-3"
                >
                  {/* ── Header ─────────────────────────────────────── */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-semibold text-[16px] text-[var(--ink)]">
                          {plan.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_STYLE[plan.status] ?? STATUS_STYLE.draft}`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="font-heading font-semibold text-[18px] text-[var(--ink)] mt-1">
                        {priceLabel(plan)}
                      </div>
                      {plan.description && (
                        <p className="t-sm text-[var(--muted)] mt-0.5 line-clamp-2">{plan.description}</p>
                      )}
                    </div>
                  </div>

                  {/* ── Benefits ───────────────────────────────────── */}
                  {v && v.benefits.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {v.benefits.slice(0, 4).map((b) => (
                        <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--ink-2)] font-semibold">
                          <Icon name="check" size={13} className="mt-0.5 shrink-0 text-[var(--lime-ink)]" />
                          {b}
                        </li>
                      ))}
                      {v.benefits.length > 4 && (
                        <li className="text-[12px] text-[var(--muted)] font-semibold pl-[21px]">
                          + {v.benefits.length - 4} more
                        </li>
                      )}
                    </ul>
                  )}

                  {/* ── Meta ───────────────────────────────────────── */}
                  <div className="flex items-center gap-3 t-sm text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Icon name="group" size={13} /> {plan.memberCount} {plan.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    {v && v.freeTrialDays ? (
                      <span className="flex items-center gap-1">
                        <Icon name="calendar" size={13} /> {v.freeTrialDays}d trial
                      </span>
                    ) : null}
                    {v && !v.autoRenew && (
                      <span className="flex items-center gap-1 text-[var(--coral)]">
                        <Icon name="sync_disabled" size={13} /> Manual renew
                      </span>
                    )}
                  </div>

                  {/* ── Actions ─────────────────────────────────────── */}
                  <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(plan)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[12px] disabled:opacity-50"
                    >
                      <Icon name="edit" size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(plan.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[12px] disabled:opacity-50"
                    >
                      <Icon name="content_copy" size={13} /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(plan)}
                      disabled={isBusy || plan.status === 'draft'}
                      className={`inline-flex items-center gap-1 px-3 h-8 rounded-full font-bold text-[12px] disabled:opacity-50 ${
                        plan.status === 'active'
                          ? 'bg-[var(--coral-soft)] text-[var(--coral)]'
                          : plan.status === 'draft'
                            ? 'bg-[var(--surface-2)] text-[var(--muted)]'
                            : 'bg-[var(--lime-soft)] text-[var(--lime-ink)]'
                      }`}
                    >
                      <Icon name={plan.status === 'active' ? 'block' : 'check_circle'} size={13} />
                      {plan.status === 'active' ? 'Disable' : plan.status === 'disabled' ? 'Enable' : 'Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(plan)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--coral-soft)] text-[var(--coral)] font-bold text-[12px] disabled:opacity-50"
                    >
                      <Icon name="delete" size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit sheet ─────────────────────────────────────── */}
      <CreateEditPlanSheet
        open={sheetOpen}
        onClose={closeSheet}
        venueId={venueId}
        plan={editingPlan}
        onSaved={onSaved}
      />

      {/* ── Error popup (replaces the old blocking alert) ───────────── */}
      {errorMsg && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/45 px-6"
          role="alertdialog"
          aria-modal="true"
          aria-label="Couldn't delete plan"
          onClick={() => setErrorMsg(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-[18px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-xl p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--coral-soft)] text-[var(--coral)] mb-3">
              <Icon name="error" size={22} />
            </span>
            <div className="font-heading font-semibold text-[16px] text-[var(--ink)]">Couldn't delete plan</div>
            <p className="t-sm text-[var(--muted)] mt-1">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="mt-4 w-full h-10 rounded-full bg-[var(--primary)] text-white font-bold text-[13px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
