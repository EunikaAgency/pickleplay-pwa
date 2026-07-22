import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Toast } from '../../shared/components/ui/Toast';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import {
  getSettings, updateSettings, ApiError,
  type AppSettings, type PartnerPlanTier,
} from '../../shared/lib/api';
/** Which settings surface to render. Each is a standalone sibling screen in the
 *  admin console's System section — there is no umbrella "Settings" screen. */
export type AdminSettingsSection = 'payments' | 'subscriptions' | 'email';

interface AdminSettingsScreenProps {
  section: AdminSettingsSection;
  onBack: () => void;
}

const SECTION_META: Record<AdminSettingsSection, { title: string; subtitle: string }> = {
  payments: { title: 'Payments', subtitle: 'Test mode, fees, and pricing mode.' },
  subscriptions: { title: 'Partner subscriptions', subtitle: 'Coach & organizer pricing and plan tiers.' },
  email: { title: 'Email monitoring', subtitle: 'BCC copies of transactional emails for oversight.' },
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/** One label/value row with an edit button and optional pill. */
function FieldRow({
  label, value, pill, onClick,
}: {
  label: string; value: React.ReactNode; pill?: { label: string; color: string };
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-[var(--muted)]">{label}</div>
        <div className="mt-0.5 text-[14px] font-semibold text-[var(--ink)] break-words">{value}</div>
      </div>
      {pill && (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ color: pill.color, background: 'var(--surface-2)' }}
        >
          {pill.label}
        </span>
      )}
      {onClick && (
        <button type="button" onClick={onClick} className="shrink-0 text-[var(--muted)] p-1">
          <Icon name="edit" size={18} />
        </button>
      )}
    </div>
  );
}

/** Editable plan-tier chip shown in the tier list. */
function TierChip({ tier, onEdit, onRemove }: { tier: PartnerPlanTier; onEdit: () => void; onRemove: () => void }) {
  const label = `${tier.label} · ${peso(tier.price)} · ${tier.durationDays}d`;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold ${tier.enabled ? 'border-[var(--lime)] bg-[var(--lime-soft,rgba(154,205,50,0.12))]' : 'border-[var(--hairline)] opacity-60'}`}>
      <button type="button" onClick={onEdit} className="hover:opacity-70">{label}</button>
      <button type="button" onClick={onRemove} className="text-[var(--coral)] hover:opacity-70" aria-label={`Remove ${tier.label}`}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/**
 * Admin console: app-wide settings — payment mode, service/transaction fees,
 * pricing mode, partner subscription prices + configurable term tiers per role,
 * email BCC, and a link to Feature Flags. Gated by `admin.settings.manage`.
 */
export function AdminSettingsScreen({ section, onBack }: AdminSettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reqId = useRef(0);

  // which sheet is open
  const [feeMode, setFeeMode] = useState<string | null>(null);
  const [feeValue, setFeeValue] = useState('');

  const [bccOpen, setBccOpen] = useState(false);
  const [bccForm, setBccForm] = useState({ enabled: false, address: '' });

  const [editTierPlan, setEditTierPlan] = useState<'coach' | 'organizer' | null>(null);
  const [editTier, setEditTier] = useState<PartnerPlanTier | null>(null);
  const [tierForm, setTierForm] = useState<PartnerPlanTier>({ key: '', label: '', durationDays: 30, price: 0, enabled: true });

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoadState('loading');
    try {
      const s = await getSettings();
      if (id === reqId.current) { setSettings(s); setLoadState('idle'); }
    } catch { if (id === reqId.current) setLoadState('error'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function savePatch(patch: any, label: string) {
    setSaving(label);
    try {
      const s = await updateSettings(patch);
      setSettings(s);
      setToast(`${label} saved ✓`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : `Could not save ${label.toLowerCase()}.`);
    } finally {
      setSaving(null);
    }
  }

  // ── Tier helpers ──────────────────────────────────────────────────

  const tiersFor = (plan: 'coach' | 'organizer'): PartnerPlanTier[] =>
    plan === 'coach'
      ? settings?.partnerSubscription?.coachTiers ?? []
      : settings?.partnerSubscription?.organizerTiers ?? [];

  const openNewTier = (plan: 'coach' | 'organizer') => {
    setEditTierPlan(plan); setEditTier(null);
    setTierForm({ key: '', label: '', durationDays: 30, price: 0, enabled: true });
  };

  const openEditTier = (plan: 'coach' | 'organizer', tier: PartnerPlanTier) => {
    setEditTierPlan(plan); setEditTier(tier); setTierForm({ ...tier });
  };

  const saveTiers = async () => {
    if (!editTierPlan) return;
    const key = tierForm.key.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key || !tierForm.label.trim() || tierForm.durationDays < 1 || tierForm.price < 0) {
      setToast('Fill in all fields before saving the tier.');
      return;
    }
    const current = tiersFor(editTierPlan);
    let next: PartnerPlanTier[];
    if (editTier) {
      next = current.map((t) => t.key === editTier.key ? { ...tierForm, key } : t);
    } else {
      if (current.some((t) => t.key === key)) {
        setToast(`A tier with key "${key}" already exists.`);
        return;
      }
      next = [...current, { ...tierForm, key }];
    }
    const field = editTierPlan === 'coach' ? 'coachPlanTiers' : 'organizerPlanTiers';
    await savePatch({ [field]: next }, `${editTierPlan === 'coach' ? 'Coach' : 'Organizer'} tiers`);
    setEditTierPlan(null); setEditTier(null);
  };

  const removeTier = async (plan: 'coach' | 'organizer', tier: PartnerPlanTier) => {
    const field = plan === 'coach' ? 'coachPlanTiers' : 'organizerPlanTiers';
    await savePatch({ [field]: tiersFor(plan).filter((t) => t.key !== tier.key) }, `Removed ${tier.label}`);
  };

  // ── Fee editor helpers ────────────────────────────────────────────

  const openFee = (mode: string, val: string) => { setFeeMode(mode); setFeeValue(val); };

  const saveFee = async () => {
    const mode = feeMode; setFeeMode(null);
    const num = (min: number, max: number) => Math.min(max, Math.max(min, Number(feeValue) || min));
    const patches: Record<string, any> = {
      service: { serviceFeePercent: num(0, 100) },
      transaction: { transactionFeePercent: num(0, 100) },
      coach_price: { coachSubscriptionPrice: Math.max(0, Number(feeValue) || 0) },
      organizer_price: { organizerSubscriptionPrice: Math.max(0, Number(feeValue) || 0) },
      duration: { partnerSubscriptionDays: Math.min(3650, Math.max(1, Math.round(Number(feeValue) || 30))) },
      pricing_mode: { pricingMode: feeValue === 'blend' ? 'blend' : 'start' },
    };
    const label = { service: 'Service fee', transaction: 'Transaction fee', coach_price: 'Coach price', organizer_price: 'Organizer price', duration: 'Term days', pricing_mode: 'Pricing mode' }[mode!] ?? 'Setting';
    if (mode && patches[mode]) await savePatch(patches[mode], label);
  };

  // ── Render ────────────────────────────────────────────────────────

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Admin console"
      title={SECTION_META[section].title}
      subtitle={SECTION_META[section].subtitle}
      className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]"
      action={(
        <button type="button" onClick={() => void load()} aria-label="Refresh" className="text-[var(--muted)]" disabled={saving !== null}>
          <Icon name="refresh" size={20} />
        </button>
      )}
    />
  );

  if (loadState === 'loading') return <div className="scroll safe-top safe-bottom px-5">{header}<div className="pt-4"><LoadingSkeleton variant="card" count={5} /></div></div>;
  if (loadState === 'error' || !settings) return <div className="scroll safe-top safe-bottom px-5">{header}<div className="pt-4"><ErrorState title="Couldn't load settings" message="Check your connection and try again." onRetry={() => void load()} /></div></div>;

  const sub = settings.partnerSubscription;
  const coachTiers = sub?.coachTiers ?? [];
  const organizerTiers = sub?.organizerTiers ?? [];

  return (
    <div className="scroll safe-top safe-bottom px-5 pb-20">
      {header}

      <div className="space-y-5 pt-4">

        {/* ── Payments ──────────────────────────────────────────────── */}
        {section === 'payments' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-heading text-[16px] font-extrabold text-[var(--ink)] mb-3">
            <Icon name="payments" size={18} /> Payments
          </h2>
          <div className="space-y-3">
            <FieldRow label="Test mode"
              value={settings.paymentTestMode ? 'ON — demo cards only' : 'OFF — live gateway'}
              pill={settings.paymentTestMode ? { label: 'Test', color: 'var(--amber)' } : { label: 'Live', color: 'var(--primary)' }}
              onClick={() => savePatch({ paymentTestMode: !settings.paymentTestMode }, 'Payment mode')} />
            <FieldRow label="Service fee" value={`${settings.serviceFeePercent}% charged on top of venue rate`}
              onClick={() => openFee('service', String(settings.serviceFeePercent))} />
            <FieldRow label="Transaction fee" value={`${settings.transactionFeePercent}% of total (player-paid gateway fee)`}
              onClick={() => openFee('transaction', String(settings.transactionFeePercent))} />
            <FieldRow label="Pricing mode"
              value={settings.pricingMode === 'blend' ? 'Blend — per clock hour' : 'Start — rate from start time'}
              onClick={() => openFee('pricing_mode', settings.pricingMode ?? 'start')} />
          </div>
        </section>
        )}

        {/* ── Partner subscriptions ─────────────────────────────────── */}
        {section === 'subscriptions' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-heading text-[16px] font-extrabold text-[var(--ink)] mb-3">
            <Icon name="card_membership" size={18} /> Partner subscriptions
          </h2>
          <div className="space-y-3">
            <FieldRow label="Coach price" value={`${peso(sub?.coach ?? 499)} / ${sub?.durationDays ?? 30} days`}
              onClick={() => openFee('coach_price', String(sub?.coach ?? 499))} />
            <FieldRow label="Organizer price" value={`${peso(sub?.organizer ?? 999)} / ${sub?.durationDays ?? 30} days`}
              onClick={() => openFee('organizer_price', String(sub?.organizer ?? 999))} />
            <FieldRow label="Term length" value={`${sub?.durationDays ?? 30} days`}
              onClick={() => openFee('duration', String(sub?.durationDays ?? 30))} />
          </div>

          {/* Coach plan tiers */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-[var(--muted)]">Coach plan tiers</span>
              <button type="button" onClick={() => openNewTier('coach')} className="text-[12px] font-bold text-[var(--primary)] inline-flex items-center gap-1">
                <Icon name="add" size={16} /> Add tier
              </button>
            </div>
            {coachTiers.length === 0 ? (
              <p className="text-[12px] text-[var(--muted)] italic">No tiers configured — only the base coach price applies.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {coachTiers.map((t) => <TierChip key={t.key} tier={t} onEdit={() => openEditTier('coach', t)} onRemove={() => removeTier('coach', t)} />)}
              </div>
            )}
            <p className="mt-2 text-[11px] text-[var(--muted)]">When tiers exist, subscribers can pick a term (e.g. Quarterly, Annual).</p>
          </div>

          {/* Organizer plan tiers */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-[var(--muted)]">Organizer plan tiers</span>
              <button type="button" onClick={() => openNewTier('organizer')} className="text-[12px] font-bold text-[var(--primary)] inline-flex items-center gap-1">
                <Icon name="add" size={16} /> Add tier
              </button>
            </div>
            {organizerTiers.length === 0 ? (
              <p className="text-[12px] text-[var(--muted)] italic">No tiers configured — only the base organizer price applies.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {organizerTiers.map((t) => <TierChip key={t.key} tier={t} onEdit={() => openEditTier('organizer', t)} onRemove={() => removeTier('organizer', t)} />)}
              </div>
            )}
            <p className="mt-2 text-[11px] text-[var(--muted)]">When tiers exist, subscribers can pick a term at checkout.</p>
          </div>
        </section>
        )}

        {/* ── Email monitoring ─────────────────────────────────────── */}
        {section === 'email' && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-heading text-[16px] font-extrabold text-[var(--ink)] mb-3">
            <Icon name="mail" size={18} /> Email monitoring
          </h2>
          <FieldRow label="BCC transactional emails"
            value={settings.emailBccEnabled ? `ON → ${settings.emailBccAddress ?? ''}` : 'OFF'}
            pill={settings.emailBccEnabled ? { label: 'On', color: 'var(--lime-ink)' } : { label: 'Off', color: 'var(--muted)' }}
            onClick={() => { setBccForm({ enabled: settings.emailBccEnabled ?? false, address: settings.emailBccAddress ?? 'info@eunika.agency' }); setBccOpen(true); }} />
        </section>
        )}
      </div>

      {/* ── Fee / Price numeric editor ─────────────────────────────── */}
      <BottomSheet
        open={feeMode !== null}
        onClose={() => setFeeMode(null)}
        title={feeMode === 'pricing_mode' ? 'Pricing mode' : feeMode === 'duration' ? 'Term length (days)' : feeMode === 'coach_price' ? 'Coach price (₱)' : feeMode === 'organizer_price' ? 'Organizer price (₱)' : `${feeMode === 'transaction' ? 'Transaction' : 'Service'} fee (%)`}
        subtitle={feeMode === 'pricing_mode' ? 'start = rate from booking start time; blend = per clock hour' : undefined}
        footer={(
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => void saveFee()} disabled={saving !== null}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" fullWidth onClick={() => setFeeMode(null)}>Cancel</Button>
          </div>
        )}
      >
        <div className="px-5 pb-4">
          {feeMode === 'pricing_mode' ? (
            <div className="flex flex-col gap-3">
              {(['start', 'blend'] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[var(--hairline)] p-4 has-[:checked]:border-[var(--primary)]">
                  <input type="radio" name="pricingMode" value={v} checked={feeValue === v} onChange={() => setFeeValue(v)} className="size-5 accent-primary" />
                  <div>
                    <div className="text-[14px] font-bold capitalize">{v === 'start' ? 'Start time' : 'Blend'}</div>
                    <div className="text-[12px] text-[var(--muted)]">{v === 'start' ? 'Rate is based on the booking start time only.' : 'Resolves per clock hour across override boundaries.'}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="field p-0!">
              <label className="lbl">{feeMode === 'duration' ? 'Days' : feeMode === 'coach_price' || feeMode === 'organizer_price' ? 'Price (₱)' : 'Percentage (%)'}</label>
              <input className="control" type="number" inputMode="numeric" value={feeValue} min={0}
                max={feeMode === 'duration' ? 3650 : feeMode === 'service' || feeMode === 'transaction' ? 100 : undefined}
                onChange={(e) => setFeeValue(e.target.value)} placeholder="0" />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ── BCC editor sheet ──────────────────────────────────────── */}
      <BottomSheet open={bccOpen} onClose={() => setBccOpen(false)} title="Email BCC settings"
        footer={(
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => { setBccOpen(false); void savePatch({ emailBccEnabled: bccForm.enabled, emailBccAddress: bccForm.address }, 'Email BCC'); }} disabled={saving !== null}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" fullWidth onClick={() => setBccOpen(false)}>Cancel</Button>
          </div>
        )}
      >
        <div className="px-5 pb-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={bccForm.enabled} onChange={(e) => setBccForm((f) => ({ ...f, enabled: e.target.checked }))} className="size-5 accent-primary" />
            <span className="text-[14px] font-bold">Send BCC copies</span>
          </label>
          {bccForm.enabled && (
            <div className="field p-0!">
              <label className="lbl">BCC address</label>
              <input className="control" type="email" value={bccForm.address}
                onChange={(e) => setBccForm((f) => ({ ...f, address: e.target.value }))} placeholder="info@eunika.agency" />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ── Tier editor sheet ─────────────────────────────────────── */}
      <BottomSheet
        open={editTierPlan !== null}
        onClose={() => { setEditTierPlan(null); setEditTier(null); }}
        title={editTier ? `Edit ${editTierPlan} tier` : `Add ${editTierPlan} tier`}
        subtitle="Configurable term options subscribers can choose from."
        footer={(
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => void saveTiers()} disabled={saving !== null}>{saving ? 'Saving…' : editTier ? 'Update tier' : 'Add tier'}</Button>
            <Button variant="ghost" fullWidth onClick={() => { setEditTierPlan(null); setEditTier(null); }}>Cancel</Button>
          </div>
        )}
      >
        <div className="px-5 pb-4 space-y-3">
          <div className="field p-0!">
            <label className="lbl">Key (stable identifier, e.g. "quarterly")</label>
            <input className="control" value={tierForm.key} disabled={!!editTier}
              onChange={(e) => setTierForm((f) => ({ ...f, key: e.target.value }))} placeholder="quarterly" />
          </div>
          <div className="field p-0!">
            <label className="lbl">Label (shown to subscribers, e.g. "Quarterly")</label>
            <input className="control" value={tierForm.label}
              onChange={(e) => setTierForm((f) => ({ ...f, label: e.target.value }))} placeholder="Quarterly" />
          </div>
          <div className="flex gap-2">
            <div className="field p-0! flex-1">
              <label className="lbl">Duration (days)</label>
              <input className="control" type="number" inputMode="numeric" value={tierForm.durationDays} min={1} max={3650}
                onChange={(e) => setTierForm((f) => ({ ...f, durationDays: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div className="field p-0! flex-1">
              <label className="lbl">Price (₱)</label>
              <input className="control" type="number" inputMode="numeric" value={tierForm.price} min={0}
                onChange={(e) => setTierForm((f) => ({ ...f, price: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 pt-1">
            <input type="checkbox" checked={tierForm.enabled}
              onChange={(e) => setTierForm((f) => ({ ...f, enabled: e.target.checked }))} className="size-5 accent-primary" />
            <div>
              <span className="text-[14px] font-bold">Enabled</span>
              <p className="text-[11px] text-[var(--muted)]">Disabled tiers are kept in config but hidden from subscribers.</p>
            </div>
          </label>
        </div>
      </BottomSheet>

      <Toast message={toast ?? ''} show={!!toast} />
    </div>
  );
}
