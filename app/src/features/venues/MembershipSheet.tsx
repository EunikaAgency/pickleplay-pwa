import { useMemo, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { MEMBERSHIP_PLANS, type MembershipPlan } from './membership';
import type { ApiSubscriptionPlan } from '../../shared/lib/api';

interface MembershipSheetProps {
  open: boolean;
  onClose: () => void;
  venueName: string;
  /** The currency symbol for prices (e.g. "₱"). */
  currency: string;
  /** The plan the user is currently subscribed to at this venue, if any. */
  currentPlanId: string | null;
  /** True when the user's membership has expired — the sheet is for renewal. */
  isRenewal?: boolean;
  /** Persist a join/switch/renew to the chosen plan. */
  onJoin: (planId: string) => void;
  /** Cancel the current membership. */
  onCancel: () => void;
  /** Optional: API subscription plans from the venue owner (takes precedence over hardcoded plans). */
  apiPlans?: ApiSubscriptionPlan[] | null;
}

const BILLING_CADENCE: Record<string, string> = {
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  semiAnnual: '6 months',
  annual: 'year',
  custom: 'period',
};

const BILLING_CADENCE_LABEL: Record<string, string> = {
  weekly: 'billed weekly',
  monthly: 'billed monthly',
  quarterly: 'billed every 3 months',
  semiAnnual: 'billed every 6 months',
  annual: 'billed yearly',
  custom: 'billed per period',
};

/** Convert an API subscription plan to the MembershipPlan shape the sheet renders. */
function apiPlanToMembershipPlan(p: ApiSubscriptionPlan, _currency: string): MembershipPlan {
  const v = p.currentVersion;
  const cycleCadence = v?.billingCycle === 'custom' && v?.customBillingDays
    ? `${v.customBillingDays}d`
    : BILLING_CADENCE[v?.billingCycle ?? 'monthly'] ?? 'mo';
  const cycleLabel = v?.billingCycle === 'custom' && v?.customBillingDays
    ? `billed every ${v.customBillingDays} days`
    : BILLING_CADENCE_LABEL[v?.billingCycle ?? 'monthly'] ?? 'billed monthly';
  return {
    id: p.id,
    name: p.name,
    price: v?.price ?? 0,
    cadence: cycleCadence,
    cadenceLabel: cycleLabel,
    tagline: p.description || v?.benefits?.[0] || '',
    perks: v?.benefits ?? [],
    featured: false,
  };
}

export function MembershipSheet({
  open,
  onClose,
  venueName,
  currency,
  currentPlanId,
  isRenewal,
  onJoin,
  onCancel,
  apiPlans,
}: MembershipSheetProps) {
  // Merge API plans with hardcoded fallback. If the owner has active API plans,
  // those are shown instead of the hardcoded ones (they represent the owner's
  // actual configured plans). Otherwise fall back to the generic defaults.
  const plans: MembershipPlan[] = useMemo(() => {
    if (apiPlans && apiPlans.length > 0) {
      return apiPlans.map((p) => apiPlanToMembershipPlan(p, currency));
    }
    return MEMBERSHIP_PLANS;
  }, [apiPlans, currency]);

  const planByIdMemo = (id: string | null | undefined) => plans.find((p) => p.id === id);

  // Default the selection to the current plan (for switching) or the first plan.
  const initial = currentPlanId ?? plans[0]?.id ?? '';
  const [selected, setSelected] = useState(initial);
  const [phase, setPhase] = useState<'choose' | 'success'>('choose');

  // Re-seed the selection whenever the sheet (re)opens, so it reflects the latest
  // membership and always starts on the chooser.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setSelected(currentPlanId ?? plans[0]?.id ?? '');
    setPhase('choose');
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const selectedPlan = planByIdMemo(selected) ?? plans[0];
  const isCurrent = currentPlanId === selected;
  const price = (n: number) => `${currency}${n.toLocaleString()}`;

  const handleJoin = () => {
    if (!selectedPlan) return;
    onJoin(selected);
    setPhase('success');
  };

  const successPlan = planByIdMemo(currentPlanId) ?? selectedPlan ?? plans[0];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={phase === 'success' ? (isRenewal ? 'Renewed!' : "You're in!") : isRenewal ? 'Renew Subscription' : 'Join Membership'}
      subtitle={phase === 'success' ? undefined : venueName}
      sheetClassName="membership-sheet"
      flushFooter
      footer={
        phase === 'success' ? (
          <Button fullWidth onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button fullWidth onClick={handleJoin} disabled={isCurrent && !isRenewal}>
            <Icon name={isRenewal ? 'refresh' : 'star'} size={16} />
            {isCurrent && !isRenewal
              ? 'Your current plan'
              : isRenewal
                ? `Renew ${selectedPlan.name} · ${price(selectedPlan.price)}/${selectedPlan.cadence}`
                : currentPlanId
                  ? `Switch to ${selectedPlan.name}`
                  : `Join ${selectedPlan.name} · ${price(selectedPlan.price)}/${selectedPlan.cadence}`}
          </Button>
        )
      }
    >
      {phase === 'success' && successPlan ? (
        <div className="text-center py-6 px-5">
          <div className="w-[72px] h-[72px] rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center mb-4">
            <Icon name="verified" size={36} />
          </div>
          <h3 className="font-heading font-semibold text-[20px] text-[var(--ink)]">
            You're on the {successPlan.name} plan!
          </h3>
          <p className="text-[14px] text-[var(--muted)] font-semibold mt-2 max-w-[300px] mx-auto leading-relaxed">
            Your perks are active at {venueName}. They'll be applied automatically next time you book a
            court.
          </p>
          <div className="mt-5 text-left bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[16px] p-4">
            <div className="t-eyebrow mb-2">What you get</div>
            <ul className="flex flex-col gap-2">
              {successPlan.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-[13.5px] text-[var(--ink-2)] font-semibold">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[var(--lime-ink)]" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 pb-1">
          {currentPlanId && !isRenewal && (
            <div className="flex items-center gap-2.5 bg-[var(--lime-soft)] text-[var(--lime-ink)] rounded-[14px] px-4 py-3 text-[13px] font-bold">
              <Icon name="verified" size={16} />
              You're on the {planByIdMemo(currentPlanId)?.name} plan here — pick another to switch.
            </div>
          )}
          {currentPlanId && isRenewal && (
            <div className="flex items-center gap-2.5 bg-[var(--coral-soft)] text-[var(--coral)] rounded-[14px] px-4 py-3 text-[13px] font-bold">
              <Icon name="clock" size={16} />
              Your {planByIdMemo(currentPlanId)?.name} plan has expired — pick a plan to renew.
            </div>
          )}

          {plans.map((plan) => {
            const active = selected === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={active}
                className={`relative w-full text-left rounded-[18px] p-4 transition-all ${
                  active
                    ? 'bg-[var(--lime-soft)] border-[1.5px] border-[var(--lime-ink)]'
                    : 'bg-[var(--surface)] border-[0.5px] border-[var(--hairline)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-[16px] text-[var(--ink)]">
                        {plan.name}
                      </span>
                      {plan.featured && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] text-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                          <Icon name="bolt" size={10} /> Popular
                        </span>
                      )}
                      {currentPlanId === plan.id && (
                        <span className="rounded-full bg-[var(--ink)] text-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-[var(--muted)] font-semibold mt-0.5">{plan.tagline}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-heading font-semibold text-[18px] text-[var(--ink)] leading-none">
                      {price(plan.price)}
                      <span className="text-[var(--muted)] text-[12px] font-bold">/{plan.cadence}</span>
                    </div>
                    <div className="text-[10.5px] text-[var(--muted)] font-semibold mt-1">{plan.cadenceLabel}</div>
                  </div>
                </div>
                <ul className="flex flex-col gap-1.5 mt-3">
                  {plan.perks.slice(0, 3).map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2 text-[13px] text-[var(--ink-2)] font-semibold"
                    >
                      <Icon name="check" size={13} className="mt-0.5 shrink-0 text-[var(--lime-ink)]" />
                      {perk}
                    </li>
                  ))}
                  {plan.perks.length > 3 && (
                    <li className="text-[12px] text-[var(--muted)] font-semibold pl-[21px]">
                      + {plan.perks.length - 3} more perk{plan.perks.length - 3 === 1 ? '' : 's'}
                    </li>
                  )}
                </ul>
              </button>
            );
          })}

          <p className="text-[11.5px] text-[var(--muted)] font-semibold text-center px-4 mt-1">
            Memberships renew automatically. You can change or cancel anytime.
          </p>

          {currentPlanId && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[13px] font-bold text-[var(--coral)] py-2 mx-auto"
            >
              Cancel my membership
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
