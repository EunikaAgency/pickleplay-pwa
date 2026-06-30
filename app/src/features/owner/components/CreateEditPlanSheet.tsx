import { useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import {
  createSubscriptionPlan,
  updateSubscriptionPlan,
  type ApiSubscriptionPlan,
  type CreateSubscriptionPlanPayload,
  type UpdateSubscriptionPlanPayload,
} from '../../../shared/lib/api';

interface CreateEditPlanSheetProps {
  open: boolean;
  onClose: () => void;
  venueId: string;
  plan: ApiSubscriptionPlan | null; // null = create, non-null = edit
  onSaved: (plan: ApiSubscriptionPlan) => void;
}

const BILLING_CYCLE_OPTIONS = [
  { value: 'weekly', label: 'Weekly', cadence: 'week' },
  { value: 'monthly', label: 'Monthly', cadence: 'month' },
  { value: 'quarterly', label: 'Quarterly', cadence: '3 months' },
  { value: 'semiAnnual', label: 'Semi-Annual', cadence: '6 months' },
  { value: 'annual', label: 'Annual', cadence: 'year' },
  { value: 'custom', label: 'Custom', cadence: 'custom' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active — visible to players' },
  { value: 'draft', label: 'Draft — not shown to anyone' },
  { value: 'disabled', label: 'Disabled — hidden from new subscribers' },
] as const;

export function CreateEditPlanSheet({ open, onClose, venueId, plan, onSaved }: CreateEditPlanSheetProps) {
  const isEdit = plan != null;
  const v = plan?.currentVersion;

  // ── Form state ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [customBillingDays, setCustomBillingDays] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [newBenefit, setNewBenefit] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [freeTrialDays, setFreeTrialDays] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [status, setStatus] = useState<string>('draft');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Re-seed the form whenever the sheet (re)opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    if (plan && v) {
      setName(plan.name);
      setDescription(plan.description ?? '');
      setPrice(String(v.price));
      setBillingCycle(v.billingCycle);
      setCustomBillingDays(v.customBillingDays ? String(v.customBillingDays) : '');
      setBenefits([...v.benefits]);
      setMaxMembers(v.maxMembers ? String(v.maxMembers) : '');
      setFreeTrialDays(v.freeTrialDays ? String(v.freeTrialDays) : '');
      setAutoRenew(v.autoRenew);
      setStatus(plan.status);
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setBillingCycle('monthly');
      setCustomBillingDays('');
      setBenefits([]);
      setMaxMembers('');
      setFreeTrialDays('');
      setAutoRenew(true);
      setStatus('draft');
    }
    setError('');
    setSaving(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const showCustomDays = billingCycle === 'custom';

  const addBenefit = () => {
    const t = newBenefit.trim();
    if (!t || benefits.includes(t)) return;
    setBenefits((b) => [...b, t]);
    setNewBenefit('');
  };

  const removeBenefit = (idx: number) => {
    setBenefits((b) => b.filter((_, i) => i !== idx));
  };

  const canSave = name.trim().length > 0 && price.trim().length > 0 && !Number.isNaN(Number(price)) && Number(price) >= 0;

  // ── Admin warning for live edits ───────────────────────────────
  const showVersionWarning = isEdit && plan?.status === 'active' && v != null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        currency: 'PHP',
        billingCycle: billingCycle as any,
        customBillingDays: showCustomDays && customBillingDays ? Number(customBillingDays) : null,
        benefits: benefits.length > 0 ? benefits : undefined,
        maxMembers: maxMembers ? Number(maxMembers) : null,
        freeTrialDays: freeTrialDays ? Number(freeTrialDays) : null,
        autoRenew,
        status: status as any,
      };

      let result: ApiSubscriptionPlan;
      if (isEdit) {
        // When editing an active plan's structural fields, confirm versioning.
        if (showVersionWarning) {
          const structuralChange =
            (v && Number(price) !== v.price) ||
            billingCycle !== v.billingCycle ||
            (showCustomDays && Number(customBillingDays || 0) !== (v.customBillingDays ?? 0)) ||
            benefits.length !== v.benefits.length ||
            !benefits.every((b, i) => b === v.benefits[i]);
          if (structuralChange) {
            const ok = confirm(
              'This update will apply immediately to new subscribers. Existing subscribers will continue using their current subscription until their next renewal.\n\nContinue?',
            );
            if (!ok) { setSaving(false); return; }
          }
        }
        result = await updateSubscriptionPlan(plan!.id, body as UpdateSubscriptionPlanPayload);
      } else {
        result = await createSubscriptionPlan(venueId, body as CreateSubscriptionPlanPayload);
      }
      onSaved(result);
    } catch (e: any) {
      setError(e?.message ?? e?.error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Compute a live price preview.
  const pricePreview = useMemo(() => {
    const num = Number(price);
    if (Number.isNaN(num) || num < 0) return null;
    const cycleLabel = showCustomDays && customBillingDays
      ? `${customBillingDays} days`
      : BILLING_CYCLE_OPTIONS.find((o) => o.value === billingCycle)?.cadence ?? billingCycle;
    return `₱${num.toLocaleString()} / ${cycleLabel}`;
  }, [price, billingCycle, customBillingDays, showCustomDays]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${plan!.name}` : 'Create Subscription Plan'}
      subtitle={isEdit ? 'Changes to price, billing, or benefits create a new version.' : 'Set up a plan players can subscribe to.'}
      flushFooter
      footer={
        <div className="space-y-2">
          {error && (
            <div className="text-[13px] font-bold text-[var(--coral)] text-center">{error}</div>
          )}
          <Button fullWidth onClick={handleSave} disabled={!canSave || saving}>
            <Icon name={saving ? 'hourglass_top' : 'save'} size={16} />
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-[13px] font-bold text-[var(--muted)] py-1"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-5 pb-1">
        {/* ── Version warning ─────────────────────────────────────── */}
        {showVersionWarning && (
          <div className="flex items-start gap-2.5 bg-[var(--lime-soft)] text-[var(--lime-ink)] rounded-[14px] px-4 py-3 text-[12.5px] font-bold leading-relaxed">
            <Icon name="info" size={16} className="shrink-0 mt-0.5" />
            Updates to price, billing, or benefits will create a new version. Existing subscribers stay on their current version until their next renewal.
          </div>
        )}

        {/* ── Basic Information ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Basic Information</div>

          <label className="block">
            <span className="t-sm font-bold text-[var(--ink)]">Plan Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Membership"
              maxLength={100}
              className="mt-1 w-full h-10 rounded-xl bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] border-none outline-none"
            />
          </label>

          <label className="block">
            <span className="t-sm font-bold text-[var(--ink)]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this plan…"
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] border-none outline-none resize-none"
            />
          </label>
        </div>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Pricing</div>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="t-sm font-bold text-[var(--ink)]">Price</span>
              <div className="mt-1 flex items-center gap-1 h-10 rounded-xl bg-[var(--surface-2)] px-3">
                <span className="font-bold text-[14px] text-[var(--ink)]">₱</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
              </div>
            </label>
          </div>

          {pricePreview && (
            <div className="text-[13px] font-bold text-[var(--lime-ink)]">
              {pricePreview}
            </div>
          )}
        </div>

        {/* ── Billing Cycle ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Billing Cycle</div>

          <div className="grid grid-cols-3 gap-2">
            {BILLING_CYCLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBillingCycle(opt.value)}
                className={`h-10 rounded-xl text-[13px] font-bold transition-all ${
                  billingCycle === opt.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--ink)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {showCustomDays && (
            <label className="block">
              <span className="t-sm font-bold text-[var(--ink)]">Repeat every</span>
              <div className="mt-1 flex items-center gap-2 h-10 rounded-xl bg-[var(--surface-2)] px-3">
                <input
                  type="number"
                  value={customBillingDays}
                  onChange={(e) => setCustomBillingDays(e.target.value)}
                  placeholder="30"
                  min={1}
                  max={365}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] w-20"
                />
                <span className="text-[14px] text-[var(--muted)] font-semibold">Days</span>
              </div>
            </label>
          )}
        </div>

        {/* ── Benefits ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Benefits</div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newBenefit}
              onChange={(e) => setNewBenefit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBenefit(); } }}
              placeholder="e.g. 20% off every court booking"
              maxLength={200}
              className="flex-1 h-10 rounded-xl bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] border-none outline-none"
            />
            <button
              type="button"
              onClick={addBenefit}
              disabled={!newBenefit.trim()}
              className="inline-flex items-center gap-1 px-3 h-10 rounded-xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-40 shrink-0"
            >
              <Icon name="add" size={16} /> Add
            </button>
          </div>

          {benefits.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {benefits.map((b, i) => (
                <li key={`${b}-${i}`} className="flex items-center gap-2 text-[13px] text-[var(--ink-2)] font-semibold bg-[var(--surface-2)] rounded-xl px-3 py-2">
                  <Icon name="check" size={14} className="shrink-0 text-[var(--lime-ink)]" />
                  <span className="flex-1 min-w-0 break-words">{b}</span>
                  <button
                    type="button"
                    onClick={() => removeBenefit(i)}
                    className="shrink-0 text-[var(--muted)] hover:text-[var(--coral)]"
                    aria-label={`Remove "${b}"`}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {benefits.length === 0 && (
            <p className="t-sm text-[var(--muted)]">Add benefits like court discounts, priority booking, or members-only events.</p>
          )}
        </div>

        {/* ── Optional Settings ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Optional Settings</div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="t-sm font-bold text-[var(--ink)]">Max Members</span>
              <input
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                placeholder="Unlimited"
                min={0}
                className="mt-1 w-full h-10 rounded-xl bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] border-none outline-none"
              />
            </label>

            <label className="block">
              <span className="t-sm font-bold text-[var(--ink)]">Free Trial</span>
              <div className="mt-1 flex items-center gap-1 h-10 rounded-xl bg-[var(--surface-2)] px-3">
                <input
                  type="number"
                  value={freeTrialDays}
                  onChange={(e) => setFreeTrialDays(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)]"
                />
                <span className="text-[12px] text-[var(--muted)] font-semibold">days</span>
              </div>
            </label>
          </div>

          <label className="flex items-center justify-between h-10">
            <span className="t-sm font-bold text-[var(--ink)]">Auto Renewal</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoRenew}
              onClick={() => setAutoRenew(!autoRenew)}
              className={`relative w-11 h-6 rounded-full transition-colors ${autoRenew ? 'bg-[var(--primary)]' : 'bg-[var(--hairline)]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${autoRenew ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>

        {/* ── Status ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="t-eyebrow">Status</div>

          <div className="flex flex-col gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-[13px] font-bold transition-all ${
                  status === opt.value
                    ? 'bg-[var(--lime-soft)] border-[1.5px] border-[var(--lime-ink)] text-[var(--lime-ink)]'
                    : 'bg-[var(--surface-2)] border-[0.5px] border-transparent text-[var(--ink)]'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  status === opt.value ? 'border-[var(--lime-ink)]' : 'border-[var(--hairline)]'
                }`}>
                  {status === opt.value && <span className="w-2 h-2 rounded-full bg-[var(--lime-ink)]" />}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
