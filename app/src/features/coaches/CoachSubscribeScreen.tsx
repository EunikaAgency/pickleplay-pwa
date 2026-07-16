import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { Toast } from '../../shared/components/ui/Toast';
import {
  ApiError, cancelPartnerSubscription, getMyPartnerSubscriptions, getSettings, resumePartnerSubscription,
  subscribeToPartnerPlan, type AppSettings, type CheckoutCard,
  type PartnerPlan, type PartnerSubscription, type PartnerSubscriptionState,
} from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

interface CoachSubscribeScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** Which partner plan this screen sells. Defaults to coach; 'organizer' reuses
   *  the exact same flow (gating, address gate, cancel/resume) for the ₱999
   *  organizer subscription — only the copy, benefits and post-subscribe tools
   *  differ. The API is already plan-parameterized. */
  plan?: PartnerPlan;
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const COACH_BENEFITS = [
  'Get listed in Find Coach so players can discover you',
  'Apply to coach at any venue in the directory',
  'Accept paid coaching bookings from players',
  'A verified Coach badge on your public profile',
];

const ORGANIZER_BENEFITS = [
  'Charge for Open Play sessions — and keep every peso',
  'Apply to organize at any venue in the directory',
  'Run tournaments, events & recurring open play',
  'A verified Organizer badge on your public profile',
];

/** Per-plan copy so this one screen sells either the coach (₱499) or the
 *  organizer (₱999) subscription — the flow, gating and API are identical. */
const PLAN_UI = {
  coach: {
    eyebrow: 'Coaching',
    title: 'Become a coach',
    pitchTitle: 'Coach on PickleBallers',
    pitchSub: "Subscribe to unlock coaching. Only subscribed coaches appear in Find Coach — that's how players know you're legit.",
    activeTitle: 'Coach subscription active',
    benefits: COACH_BENEFITS,
    stay: 'You stay a coach',
    endingTail: "After that you'll drop off Find Coach and stop taking bookings.",
    keepVerb: 'coaching',
    afterDrop: 'After that you drop off Find Coach and stop receiving booking requests.',
    subscribedToast: "You're a coach now — set up your profile.",
  },
  organizer: {
    eyebrow: 'Organizing',
    title: 'Become an organizer',
    pitchTitle: 'Organize on PickleBallers',
    pitchSub: 'Subscribe to unlock organizing. Only subscribed organizers can charge for Open Play and run events — the subscription is the licence to charge.',
    activeTitle: 'Organizer subscription active',
    benefits: ORGANIZER_BENEFITS,
    stay: 'You stay an organizer',
    endingTail: 'After that you can no longer charge for Open Play or run events.',
    keepVerb: 'organizing',
    afterDrop: 'After that you can no longer charge for Open Play or run events.',
    subscribedToast: "You're an organizer now.",
  },
} as const;

/** Chip copy + colour for a row in the subscription history. */
function historyChip(s: PartnerSubscription): { label: string; color: string } {
  if (s.isActive && s.cancelAtPeriodEnd) return { label: 'Ending', color: 'var(--amber, #F59E0B)' };
  if (s.isActive) return { label: 'Active', color: 'var(--primary)' };
  if (s.status === 'expired') return { label: 'Expired', color: 'var(--muted)' };
  if (s.status === 'cancelled') return { label: 'Cancelled', color: 'var(--coral)' };
  return { label: s.status, color: 'var(--muted)' };
}

export function CoachSubscribeScreen({ onNavigate, onBack, plan = 'coach' }: CoachSubscribeScreenProps) {
  const ui = PLAN_UI[plan];
  const [state, setState] = useState<PartnerSubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Payment step — collecting card credentials before the subscription is
  // created, exactly like booking checkout (test mode pre-fills the demo card).
  const [payOpen, setPayOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [card, setCard] = useState<CheckoutCard>({});
  // The store refreshes the user so the new coach/organizer role reaches the rest
  // of the app.
  const restore = useAuthStore((s) => s.restore);
  // Used to pre-fill the cardholder name + billing address (the profile address
  // is already required to subscribe, so it's the natural billing default).
  const user = useAuthStore((s) => s.user);

  const [reloadKey, setReloadKey] = useState(0);

  // Fetch on mount and whenever `reloadKey` bumps (after subscribe / cancel).
  // No synchronous setState in the effect body — see react-hooks/set-state-in-effect.
  useEffect(() => {
    let alive = true;
    getMyPartnerSubscriptions()
      .then((s) => { if (alive) { setState(s); setLoadError(false); } })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Pre-fill the cardholder name + billing address from the signed-in profile
  // (the profile address is already required before subscribing, so it doubles
  // as the billing address by default — the user can still edit it).
  const billingDefaults: CheckoutCard = {
    name: user?.displayName ?? '',
    billingAddress1: user?.address1 ?? '',
    billingAddress2: user?.address2 ?? '',
    billingCity: user?.city ?? '',
    billingProvince: user?.province ?? '',
    billingZip: user?.zipcode ?? '',
  };

  // Payment mode — pre-fill the demo card in test mode, like the booking flow;
  // billing details come from the profile in either mode.
  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setCard((c) => ({ ...billingDefaults, ...c, ...(s.paymentTestMode ? s.testCard : {}) }));
      })
      .catch(() => { if (alive) setCard((c) => ({ ...billingDefaults, ...c })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const retry = useCallback(() => {
    setLoading(true); setLoadError(false); setReloadKey((k) => k + 1);
  }, []);

  // Toast is a controlled `show` flag, not self-dismissing.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const doSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await subscribeToPartnerPlan(plan, { card });
      // Subscribing grants the global coach/organizer role — re-read /me so
      // permission gates (and the profile badge) pick it up without a re-login.
      await restore();
      setPayOpen(false);
      reload();
      setToast(ui.subscribedToast);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ADDRESS_REQUIRED') {
        setError('Add your address in Edit Profile before subscribing.');
        setPayOpen(false);
        reload();
      } else {
        // CARD_DECLINED and other errors stay in the payment sheet so the user
        // can fix the card and retry.
        setError(e instanceof ApiError ? e.message : 'Could not complete the subscription. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    const sub = state?.[plan];
    if (!sub || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelPartnerSubscription(sub.id);
      setConfirmOpen(false);
      reload();
      setToast(`Cancelled. ${ui.stay} until ${fmtDate(updated.expiresAt)}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const doResume = async () => {
    const sub = state?.[plan];
    if (!sub || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resumePartnerSubscription(sub.id);
      reload();
      setToast('Subscription resumed.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resume. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const active = state?.[plan] ?? null;
  const ending = !!active?.cancelAtPeriodEnd;
  const price = state?.pricing[plan] ?? 0;
  const days = state?.pricing.durationDays ?? 30;
  const addressComplete = state?.addressComplete ?? true;
  const history = state?.subscriptions ?? [];

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow={ui.eyebrow} title={ui.title} />
      </div>

      {loading && <div className="px-5 pt-6"><LoadingSkeleton /></div>}
      {!loading && loadError && (
        <ErrorState
          title="Couldn't load your subscription"
          message="Check your connection and try again."
          onRetry={retry}
        />
      )}

      {!loading && !loadError && state && (
        <div className="px-5 pt-4">
          {/* Status card — active, ending, or the pitch. */}
          {active ? (
            ending ? (
              <div className="rounded-2xl border border-[var(--coral)] bg-[var(--coral-soft)] p-4">
                <div className="flex items-center gap-2">
                  <Icon name="schedule" size={20} />
                  <span className="font-heading text-[16px] font-extrabold">Subscription ending</span>
                </div>
                <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                  {ui.stay} until <strong>{fmtDate(active.expiresAt)}</strong>. {ui.endingTail}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--lime)] bg-[var(--lime-soft,rgba(154,205,50,0.12))] p-4">
                <div className="flex items-center gap-2">
                  <Icon name="verified" size={20} />
                  <span className="font-heading text-[16px] font-extrabold">{ui.activeTitle}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                  Renews {fmtDate(active.expiresAt)} · {peso(active.priceAmount)} / {days} days
                </p>
              </div>
            )
          ) : (
            <div className="rounded-2xl bg-[var(--ink-fill,var(--navy,#1A2138))] p-5 text-white">
              <div className="font-heading text-[22px] font-extrabold leading-tight">
                {ui.pitchTitle}
              </div>
              <p className="mt-1.5 text-[13px] opacity-80">
                {ui.pitchSub}
              </p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-heading text-[34px] font-extrabold leading-none">{peso(price)}</span>
                <span className="text-[13px] opacity-70">/ {days} days</span>
              </div>
            </div>
          )}

          {/* What the subscription buys. */}
          <div className="mt-6">
            <h2 className="font-heading text-[15px] font-extrabold">What you get</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {ui.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-none text-[var(--primary)]"><Icon name="check_circle" size={18} /></span>
                  <span className="text-[14px] leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The address gate. Shown before the user wastes a tap on Subscribe. */}
          {!active && !addressComplete && (
            <button
              type="button"
              onClick={() => onNavigate('edit-profile')}
              className="mt-6 flex w-full items-center gap-3 rounded-xl border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-left"
            >
              <Icon name="location_off" size={20} />
              <span className="flex-1">
                <span className="block text-[13px] font-bold text-[var(--coral)]">Add your address first</span>
                <span className="block text-[12px] text-[var(--muted)]">
                  Missing: {state.missingAddressFields.join(', ')}. Tap to edit your profile.
                </span>
              </span>
              <Icon name="chevron_right" size={20} />
            </button>
          )}

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]">
              {error}
            </div>
          )}

          {/* Partner tools, once subscribed. */}
          {active && (
            <div className="mt-6 flex flex-col gap-2">
              {plan === 'coach' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('coach-pricing')}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                  >
                    <Icon name="payments" size={20} />
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">Your rates</span>
                      <span className="block text-[12px] text-[var(--muted)]">Set your hourly rate — players see it on your card.</span>
                    </span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('coach-bookings')}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                  >
                    <Icon name="event_available" size={20} />
                    <span className="flex-1 text-[14px] font-bold">Session requests</span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('nearby')}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                  >
                    <Icon name="stadium" size={20} />
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">Coach at a venue</span>
                      <span className="block text-[12px] text-[var(--muted)]">Open a court and apply — the owner approves you.</span>
                    </span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('organizer-hub')}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                  >
                    <Icon name="dashboard" size={20} />
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">Organizer console</span>
                      <span className="block text-[12px] text-[var(--muted)]">Tournaments, open play &amp; rosters.</span>
                    </span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('nearby')}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                  >
                    <Icon name="stadium" size={20} />
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">Organize at a venue</span>
                      <span className="block text-[12px] text-[var(--muted)]">Open a court and apply — the owner approves you.</span>
                    </span>
                    <Icon name="chevron_right" size={20} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Subscription history — every term this account has bought. */}
          {history.length > 0 && (
            <section className="mt-8">
              <h2 className="font-heading text-[15px] font-extrabold">Subscription history</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {history.map((s) => {
                  const chip = historyChip(s);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold capitalize">
                          {s.plan} · {peso(s.priceAmount)}
                        </span>
                        <span className="block text-[12px] text-[var(--muted)]">
                          {fmtDate(s.startedAt)} – {fmtDate(s.expiresAt)}
                        </span>
                      </span>
                      <span
                        className="flex-none rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ color: chip.color, background: 'var(--surface-2)' }}
                      >
                        {chip.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Sticky action. */}
      {!loading && !loadError && state && (
        <div className="sticky-cta">
          {active ? (
            ending ? (
              <Button fullWidth onClick={() => void doResume()} disabled={busy}>
                {busy ? 'Working…' : 'Resume subscription'}
              </Button>
            ) : (
              <Button variant="danger" fullWidth onClick={() => setConfirmOpen(true)} disabled={busy}>
                Cancel subscription
              </Button>
            )
          ) : (
            <Button
              fullWidth
              onClick={() => { setError(null); setPayOpen(true); }}
              disabled={busy || !addressComplete}
            >
              {!addressComplete ? 'Add your address to continue' : `Subscribe · ${peso(price)}`}
            </Button>
          )}
        </div>
      )}

      {/* Payment step — card credentials are collected here before the
          subscription is created (mirrors booking checkout). */}
      <BottomSheet
        open={payOpen}
        onClose={() => { if (!busy) { setPayOpen(false); setError(null); } }}
        title={`Subscribe · ${peso(price)}`}
        subtitle={`Billed every ${days} days. Cancel anytime.`}
        // No tab bar sits behind this screen's sheet, so the default 96px
        // tab-bar clearance is dead space that squeezes the form into a scroll.
        flushFooter
        footer={
          <div className="flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => void doSubscribe()}
              disabled={
                busy || !card.name?.trim() || !card.number?.trim() || !card.expiry?.trim() || !card.cvc?.trim()
                || !card.billingAddress1?.trim() || !card.billingCity?.trim()
                || !card.billingProvince?.trim() || !card.billingZip?.trim()
              }
            >
              {busy ? 'Processing…' : `Pay & subscribe · ${peso(price)}`}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setPayOpen(false); setError(null); }} disabled={busy}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="subscribe-pay px-5 pb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--muted)]">Card details</span>
            {settings?.paymentTestMode && (
              <span className="chip text-[12px] font-bold text-[var(--lime-ink)]">TEST mode — no charge</span>
            )}
          </div>
          <div className="field p-0! mb-2">
            <label className="lbl">Cardholder name</label>
            <input
              className="control" autoComplete="cc-name" value={card.name ?? ''} placeholder="Name on card"
              onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div className="field p-0! mb-2">
            <label className="lbl">Card number</label>
            <input
              className="control" inputMode="numeric" autoComplete="cc-number" value={card.number ?? ''} placeholder="4242 4242 4242 4242"
              onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <div className="field p-0! flex-1">
              <label className="lbl">Expiry</label>
              <input
                className="control" autoComplete="cc-exp" value={card.expiry ?? ''} placeholder="MM/YY"
                onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
              />
            </div>
            <div className="field p-0! flex-1">
              <label className="lbl">CVC</label>
              <input
                className="control" inputMode="numeric" autoComplete="cc-csc" value={card.cvc ?? ''} placeholder="123"
                onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
              />
            </div>
          </div>

          <div className="mb-2 mt-3 text-[13px] font-bold text-[var(--muted)]">Billing address</div>
          <div className="field p-0! mb-2">
            <label className="lbl">Address</label>
            <input
              className="control" autoComplete="billing address-line1" value={card.billingAddress1 ?? ''} placeholder="Street, building"
              onChange={(e) => setCard((c) => ({ ...c, billingAddress1: e.target.value }))}
            />
          </div>
          <div className="field p-0! mb-2">
            <label className="lbl">Apartment, suite, landmark <span className="text-[var(--muted)] font-normal">(optional)</span></label>
            <input
              className="control" autoComplete="billing address-line2" value={card.billingAddress2 ?? ''} placeholder="Unit / landmark"
              onChange={(e) => setCard((c) => ({ ...c, billingAddress2: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <div className="field p-0! flex-[2]">
              <label className="lbl">City</label>
              <input
                className="control" autoComplete="billing address-level2" value={card.billingCity ?? ''} placeholder="City"
                onChange={(e) => setCard((c) => ({ ...c, billingCity: e.target.value }))}
              />
            </div>
            <div className="field p-0! flex-1">
              <label className="lbl">ZIP</label>
              <input
                className="control" inputMode="numeric" autoComplete="billing postal-code" value={card.billingZip ?? ''} placeholder="1000"
                onChange={(e) => setCard((c) => ({ ...c, billingZip: e.target.value }))}
              />
            </div>
          </div>
          <div className="field p-0! mt-2">
            <label className="lbl">Province</label>
            <input
              className="control" autoComplete="billing address-level1" value={card.billingProvince ?? ''} placeholder="Province"
              onChange={(e) => setCard((c) => ({ ...c, billingProvince: e.target.value }))}
            />
          </div>
          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]">
              {error}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* In-app confirmation — never a native window.confirm(). */}
      <BottomSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel your subscription?"
        subtitle="This takes effect at the end of your paid term."
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="danger" fullWidth onClick={() => void doCancel()} disabled={busy}>
              {busy ? 'Cancelling…' : 'Yes, cancel at term end'}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setConfirmOpen(false)} disabled={busy}>
              Keep my subscription
            </Button>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-none text-[var(--primary)]"><Icon name="check_circle" size={18} /></span>
              <span className="text-[13.5px] leading-snug">
                You keep {ui.keepVerb} until{' '}
                <strong>{active ? fmtDate(active.expiresAt) : 'the end of your term'}</strong> — you already paid for it.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-none text-[var(--coral)]"><Icon name="cancel" size={18} /></span>
              <span className="text-[13.5px] leading-snug">
                {ui.afterDrop}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-none text-[var(--muted)]"><Icon name="undo" size={18} /></span>
              <span className="text-[13.5px] leading-snug">
                You can resume any time before that date. No refund is issued.
              </span>
            </li>
          </ul>
        </div>
      </BottomSheet>

      <Toast message={toast ?? ''} show={!!toast} />
    </div>
  );
}
