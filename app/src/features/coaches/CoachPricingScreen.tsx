import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Toast } from '../../shared/components/ui/Toast';
import { ApiError, getMyCoach, updateMyCoach, type ApiCoachDetail } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { currencySymbol, money } from './coachDisplay';

interface CoachPricingScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

/** Blank → null (clears the rate). A non-numeric or negative entry is rejected
 *  by `invalid()` before save, so this only ever sees a usable value. */
function toAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function invalid(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const n = Number(t);
  return !Number.isFinite(n) || n < 0;
}

export function CoachPricingScreen({ onNavigate, onBack }: CoachPricingScreenProps) {
  const [coach, setCoach] = useState<ApiCoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [noProfile, setNoProfile] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [globalPrivate, setGlobalPrivate] = useState('');
  const [globalGroup, setGlobalGroup] = useState('');
  // Per-venue private rate, keyed by venue id. Blank = bill the global rate.
  const [venueRates, setVenueRates] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Reset-on-retry is done by `retry` (an event), never synchronously in here —
  // a setState in the effect body cascades renders.
  useEffect(() => {
    let alive = true;
    getMyCoach()
      .then((c) => {
        if (!alive) return;
        setCoach(c);
        setGlobalPrivate(c.pricePrivatePerHour != null ? String(c.pricePrivatePerHour) : '');
        setGlobalGroup(c.priceGroupPerPlayer != null ? String(c.priceGroupPerPlayer) : '');
        const map: Record<string, string> = {};
        for (const r of c.venueRates || []) {
          if (r.pricePrivatePerHour != null) map[r.venueId] = String(r.pricePrivatePerHour);
        }
        setVenueRates(map);
      })
      .catch((e) => {
        if (!alive) return;
        // 404 isn't a failure — it means this account has no coach profile yet.
        if (e instanceof ApiError && e.status === 404) setNoProfile(true);
        else setFailed(true);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoading(true); setFailed(false); setNoProfile(false);
    setReloadKey((k) => k + 1);
  }, []);

  const currency = coach?.priceCurrency || 'PHP';
  const sym = currencySymbol(currency);
  const globalRate = toAmount(globalPrivate);

  const anyInvalid = invalid(globalPrivate) || invalid(globalGroup)
    || Object.values(venueRates).some(invalid);

  async function save() {
    if (anyInvalid || saving) return;
    setSaving(true); setError('');
    try {
      // Sent whole: a venue left blank drops out of the list, which the API
      // reads as "clear the override" and bills that venue at the global rate.
      const rates = Object.entries(venueRates)
        .map(([venueId, raw]) => ({ venueId, pricePrivatePerHour: toAmount(raw) }))
        .filter((r) => r.pricePrivatePerHour != null);
      const updated = await updateMyCoach({
        pricePrivatePerHour: toAmount(globalPrivate),
        priceGroupPerPlayer: toAmount(globalGroup),
        venueRates: rates,
      });
      setCoach(updated);
      setToast('Rates saved');
      setTimeout(() => setToast(''), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your rates. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Coach Information" />
      </div>

      <div className="px-5 pt-4">
        {loading && <LoadingSkeleton variant="list-row" count={3} />}

        {!loading && failed && (
          <ErrorState
            title="Couldn't load your rates"
            message="Check your connection and try again."
            onRetry={retry}
          />
        )}

        {!loading && noProfile && (
          <EmptyState
            icon="storefront"
            title="No coach profile yet"
            description="Your coach profile is created once a venue owner approves you as a coach there. Open a court and apply — then you can set your rates here."
            action={{ label: 'Coach at a venue', onPress: () => onNavigate('nearby') }}
          />
        )}

        {!loading && !failed && !noProfile && coach && (
          <>
            {/* ── Global rates ─────────────────────────────────────── */}
            <section>
              <h2 className="font-heading text-[15px] font-extrabold">Standard rates</h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                What you charge by default. This is the rate players see on your card in Find Coach.
              </p>

              <label className="mt-3.5 block">
                <span className="text-[13px] font-bold">Private session</span>
                <span className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3">
                  <span className="text-[14px] font-bold text-[var(--muted)]">{sym}</span>
                  <input
                    value={globalPrivate}
                    onChange={(e) => setGlobalPrivate(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Private session rate per hour"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <span className="text-[12px] text-[var(--muted)]">per hour</span>
                </span>
                {invalid(globalPrivate) && (
                  <span className="mt-1 block text-[12px] font-semibold text-[var(--coral)]">Enter a number, or leave it blank.</span>
                )}
              </label>

              <label className="mt-3 block">
                <span className="text-[13px] font-bold">Group session</span>
                <span className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3">
                  <span className="text-[14px] font-bold text-[var(--muted)]">{sym}</span>
                  <input
                    value={globalGroup}
                    onChange={(e) => setGlobalGroup(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Group session rate per player"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <span className="text-[12px] text-[var(--muted)]">per player</span>
                </span>
                {invalid(globalGroup) && (
                  <span className="mt-1 block text-[12px] font-semibold text-[var(--coral)]">Enter a number, or leave it blank.</span>
                )}
              </label>
            </section>

            {/* ── Per-venue overrides ──────────────────────────────── */}
            <section className="mt-7">
              <h2 className="font-heading text-[15px] font-extrabold">Rates by venue</h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Charge a different rate at a specific venue — court fees and club cuts differ.
                Leave one blank to use your standard rate.
              </p>

              {coach.venues.length === 0 ? (
                <div className="mt-3.5 rounded-2xl border border-dashed border-[var(--hairline)] px-4 py-5 text-center">
                  <p className="text-[13px] font-bold">No venues yet</p>
                  <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                    Apply at a court and once the owner approves you, it shows up here.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('nearby')}
                    className="mt-3 text-[13px] font-bold text-[var(--primary)]"
                  >
                    Find a venue
                  </button>
                </div>
              ) : (
                <ul className="mt-3.5 flex flex-col gap-2.5">
                  {coach.venues.map((v) => {
                    const raw = venueRates[v.id] ?? '';
                    return (
                      <li key={v.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3.5">
                        <div className="flex items-center gap-2">
                          <Icon name="stadium" size={17} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold">{v.name}</span>
                            {v.location && (
                              <span className="block truncate text-[12px] text-[var(--muted)]">{v.location}</span>
                            )}
                          </span>
                        </div>
                        <span className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--field-border)] px-3 py-2.5">
                          <span className="text-[14px] font-bold text-[var(--muted)]">{sym}</span>
                          <input
                            value={raw}
                            onChange={(e) => setVenueRates((m) => ({ ...m, [v.id]: e.target.value }))}
                            inputMode="decimal"
                            placeholder={globalRate != null ? String(globalRate) : '0'}
                            aria-label={`Private session rate at ${v.name}`}
                            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                          />
                          <span className="text-[12px] text-[var(--muted)]">per hour</span>
                        </span>
                        <span className="mt-1.5 block text-[12px] text-[var(--muted)]">
                          {invalid(raw)
                            ? <span className="font-semibold text-[var(--coral)]">Enter a number, or leave it blank.</span>
                            : raw.trim()
                              ? `Sessions here bill ${money(toAmount(raw) ?? 0, currency)}.`
                              : globalRate != null
                                ? `Uses your standard ${money(globalRate, currency)}/hr.`
                                : 'Uses your standard rate.'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {error && (
              <div role="alert" className="mt-5 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {!loading && !failed && !noProfile && coach && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--hairline)] bg-[var(--surface)] px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5">
          <button
            type="button"
            onClick={save}
            disabled={saving || anyInvalid}
            className="submit-btn w-full disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </div>
      )}

      <Toast message={toast} show={!!toast} />
    </div>
  );
}
