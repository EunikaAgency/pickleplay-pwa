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

  // ── Profile fields ──
  const [specialty, setSpecialty] = useState('');
  const [cityPrimary, setCityPrimary] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [langInput, setLangInput] = useState('');
  const [certInput, setCertInput] = useState('');

  // ── Rate fields ──
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
        // Profile
        setSpecialty(c.specialty ?? '');
        setCityPrimary(c.cityPrimary ?? '');
        setExperienceYears(c.experienceYears != null ? String(c.experienceYears) : '');
        setBio(c.bio ?? '');
        setLanguages(c.languages ?? []);
        setCertifications(c.certifications ?? []);
        // Rates
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

  const invalidExp = experienceYears.trim() !== ''
    && (!Number.isFinite(Number(experienceYears)) || Number(experienceYears) < 0 || Number(experienceYears) > 80);

  const anyInvalid = invalid(globalPrivate) || invalid(globalGroup)
    || Object.values(venueRates).some(invalid) || invalidExp;

  // ── Chip helpers ──
  function addLang() {
    const v = langInput.trim();
    if (v && !languages.includes(v)) { setLanguages((p) => [...p, v]); setLangInput(''); }
  }
  function removeLang(idx: number) { setLanguages((p) => p.filter((_, i) => i !== idx)); }
  function addCert() {
    const v = certInput.trim();
    if (v && !certifications.includes(v)) { setCertifications((p) => [...p, v]); setCertInput(''); }
  }
  function removeCert(idx: number) { setCertifications((p) => p.filter((_, i) => i !== idx)); }

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
        // Profile fields — sent on every save alongside rates.
        specialty: specialty.trim() || null,
        cityPrimary: cityPrimary.trim() || null,
        experienceYears: experienceYears.trim() ? Number(experienceYears) : null,
        bio: bio.trim() || null,
        languages: languages.length ? languages : undefined,
        certifications: certifications.length ? certifications : undefined,
        // Rates
        pricePrivatePerHour: toAmount(globalPrivate),
        priceGroupPerPlayer: toAmount(globalGroup),
        venueRates: rates,
      });
      setCoach(updated);
      setToast('Saved');
      setTimeout(() => setToast(''), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const publicSlug = coach?.slug || coach?.id || '';

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Coach Information" />
      </div>

      <div className="px-5 pt-4">
        {loading && <LoadingSkeleton variant="list-row" count={3} />}

        {!loading && failed && (
          <ErrorState
            title="Couldn't load your coach profile"
            message="Check your connection and try again."
            onRetry={retry}
          />
        )}

        {!loading && noProfile && (
          <EmptyState
            icon="storefront"
            title="No coach profile yet"
            description="Your coach profile is created once a venue owner approves you as a coach there. Open a court and apply — then you can set your profile and rates here."
            action={{ label: 'Coach at a venue', onPress: () => onNavigate('nearby') }}
          />
        )}

        {!loading && !failed && !noProfile && coach && (
          <>
            {/* ── Public profile ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[15px] font-extrabold">Public profile</h2>
                <button
                  type="button"
                  onClick={() => onNavigate('coach-detail', { id: publicSlug })}
                  className="flex items-center gap-1 text-[13px] font-bold text-[var(--primary)]"
                >
                  <span>View public page</span>
                  <Icon name="open_in_new" size={15} />
                </button>
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Everything here appears on your public coach card at <code className="text-[12px]">/coaches/{publicSlug}</code>.
              </p>

              <label className="mt-3.5 block">
                <span className="text-[13px] font-bold">Headline</span>
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Pickleball coach · DUPR 5.0"
                  aria-label="Headline — what you coach"
                  className="mt-1.5 block w-full rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3 text-[14px] outline-none placeholder:text-[var(--muted)]"
                />
                <span className="mt-0.5 block text-[12px] text-[var(--muted)]">Shown below your name on your public card.</span>
              </label>

              <label className="mt-3 block">
                <span className="text-[13px] font-bold">City</span>
                <input
                  value={cityPrimary}
                  onChange={(e) => setCityPrimary(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Makati"
                  aria-label="City where you coach"
                  className="mt-1.5 block w-full rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3 text-[14px] outline-none placeholder:text-[var(--muted)]"
                />
              </label>

              <label className="mt-3 block">
                <span className="text-[13px] font-bold">Experience</span>
                <span className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3">
                  <input
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Years of coaching experience"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <span className="text-[12px] text-[var(--muted)]">years</span>
                </span>
                {invalidExp && (
                  <span className="mt-0.5 block text-[12px] font-semibold text-[var(--coral)]">Enter a number 0–80, or leave it blank.</span>
                )}
              </label>

              <label className="mt-3 block">
                <span className="text-[13px] font-bold">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={5000}
                  rows={3}
                  placeholder="Tell players about your coaching philosophy, background, and what to expect in a session…"
                  aria-label="Bio"
                  className="mt-1.5 block w-full rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3 text-[14px] outline-none placeholder:text-[var(--muted)] resize-none"
                />
              </label>

              {/* Languages */}
              <div className="mt-3">
                <span className="text-[13px] font-bold">Languages</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {languages.map((l, i) => (
                    <span key={`${l}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-semibold">
                      {l}
                      <button type="button" onClick={() => removeLang(i)} aria-label={`Remove ${l}`} className="text-[var(--muted)] hover:text-[var(--coral)]">
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-[var(--hairline)] px-3 py-2.5">
                  <input
                    value={langInput}
                    onChange={(e) => setLangInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLang(); } }}
                    maxLength={50}
                    placeholder="Add a language…"
                    aria-label="Add a language"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <button type="button" onClick={addLang} disabled={!langInput.trim()} className="text-[13px] font-bold text-[var(--primary)] disabled:opacity-40">Add</button>
                </span>
              </div>

              {/* Certifications */}
              <div className="mt-3">
                <span className="text-[13px] font-bold">Certifications</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {certifications.map((c, i) => (
                    <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-semibold">
                      {c}
                      <button type="button" onClick={() => removeCert(i)} aria-label={`Remove ${c}`} className="text-[var(--muted)] hover:text-[var(--coral)]">
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-[var(--hairline)] px-3 py-2.5">
                  <input
                    value={certInput}
                    onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCert(); } }}
                    maxLength={100}
                    placeholder="Add a certification…"
                    aria-label="Add a certification"
                    className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
                  />
                  <button type="button" onClick={addCert} disabled={!certInput.trim()} className="text-[13px] font-bold text-[var(--primary)] disabled:opacity-40">Add</button>
                </span>
              </div>
            </section>

            {/* ── Global rates ─────────────────────────────────────── */}
            <section className="mt-7">
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
            {saving ? 'Saving…' : 'Save all changes'}
          </button>
        </div>
      )}

      <Toast message={toast} show={!!toast} />
    </div>
  );
}
