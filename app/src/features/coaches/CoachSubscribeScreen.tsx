import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { Toast } from '../../shared/components/ui/Toast';
import {
  ApiError, cancelPartnerSubscription, getMyPartnerSubscriptions, subscribeToPartnerPlan,
  type PartnerSubscriptionState,
} from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

interface CoachSubscribeScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
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

export function CoachSubscribeScreen({ onNavigate, onBack }: CoachSubscribeScreenProps) {
  const [state, setState] = useState<PartnerSubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The store refreshes the user so the new coach role reaches the rest of the app.
  const restore = useAuthStore((s) => s.restore);

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

  /** Re-read the subscription state (used after a subscribe/cancel + on retry). */
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
      await subscribeToPartnerPlan('coach');
      // Subscribing grants the global coach role — re-read /me so permission
      // gates (and the profile badge) pick it up without a re-login.
      await restore();
      reload();
      setToast("You're a coach now — set up your profile.");
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ADDRESS_REQUIRED') {
        setError('Add your address in Edit Profile before subscribing.');
        reload();
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not complete the subscription. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!state?.coach || busy) return;
    if (!window.confirm('Cancel your coach subscription? You will be removed from Find Coach immediately. This term is not refunded.')) return;
    setBusy(true);
    setError(null);
    try {
      await cancelPartnerSubscription(state.coach.id);
      await restore();
      reload();
      setToast('Coach subscription cancelled.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const active = state?.coach ?? null;
  const price = state?.pricing.coach ?? 0;
  const days = state?.pricing.durationDays ?? 30;
  const addressComplete = state?.addressComplete ?? true;

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Become a coach" />
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
          {/* Status card — active subscription, or the pitch. */}
          {active ? (
            <div className="rounded-2xl border border-[var(--lime)] bg-[var(--lime-soft,rgba(154,205,50,0.12))] p-4">
              <div className="flex items-center gap-2">
                <Icon name="verified" size={20} />
                <span className="font-heading text-[16px] font-extrabold">Coach subscription active</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                Renews {fmtDate(active.expiresAt)} · {peso(active.priceAmount)} / {days} days
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--ink-fill,var(--navy,#1A2138))] p-5 text-white">
              <div className="font-heading text-[22px] font-extrabold leading-tight">
                Coach on PickleBallers
              </div>
              <p className="mt-1.5 text-[13px] opacity-80">
                Subscribe to unlock coaching. Only subscribed coaches appear in Find Coach —
                that&apos;s how players know you&apos;re legit.
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
              {COACH_BENEFITS.map((b) => (
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

          {/* Coach tools, once subscribed. */}
          {active && (
            <div className="mt-6 flex flex-col gap-2">
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
            </div>
          )}
        </div>
      )}

      {/* Sticky action. */}
      {!loading && !loadError && state && (
        <div className="sticky-cta">
          {active ? (
            <Button variant="ghost" fullWidth onClick={() => void doCancel()} disabled={busy}>
              {busy ? 'Working…' : 'Cancel subscription'}
            </Button>
          ) : (
            <Button
              fullWidth
              onClick={() => void doSubscribe()}
              disabled={busy || !addressComplete}
            >
              {busy ? 'Subscribing…' : !addressComplete ? 'Add your address to continue' : `Subscribe · ${peso(price)}`}
            </Button>
          )}
        </div>
      )}

      <Toast message={toast ?? ''} show={!!toast} />
    </div>
  );
}
