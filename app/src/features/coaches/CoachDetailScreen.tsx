import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { apiImageUrl, getCoach, type ApiCoachDetail } from '../../shared/lib/api';
import { getInitials } from '../../shared/lib/initials';
import type { Navigate } from '../../shared/lib/navigation';
import { coachLocation, coachRate, money, serviceDuration, serviceLabel } from './coachDisplay';

interface CoachDetailScreenProps {
  coachId: string;
  onNavigate: Navigate;
  onBack: () => void;
  /** Returns false (and opens the auth sheet) when the viewer is a guest. */
  onRequireAuth?: (intent: string) => boolean;
}

export function CoachDetailScreen({ coachId, onNavigate, onBack, onRequireAuth }: CoachDetailScreenProps) {
  const [coach, setCoach] = useState<ApiCoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // State is only touched from the async callbacks — a sync setState in an
  // effect body cascades renders (react-hooks/set-state-in-effect).
  useEffect(() => {
    let alive = true;
    getCoach(coachId)
      .then((c) => { if (alive) setCoach(c); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coachId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true); setFailed(false); setReloadKey((k) => k + 1);
  }, []);

  const book = (serviceId?: string) => {
    // Guests get the auth sheet; booking needs an account.
    if (onRequireAuth && !onRequireAuth('book a coach')) return;
    onNavigate('book-coach', { id: coachId, serviceId });
  };

  const photo = coach ? apiImageUrl(coach.avatarUrl || coach.imageUrl) : null;
  const services = (coach?.services ?? []).filter((s) => s.isActive !== false);

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coach" title={coach?.displayName ?? 'Coach'} />
      </div>

      {loading && <div className="px-5 pt-6"><LoadingSkeleton variant="card" /></div>}
      {!loading && failed && (
        <ErrorState title="Couldn't load this coach" message="They may no longer be listed." onRetry={retry} />
      )}

      {!loading && !failed && coach && (
        <div className="px-5 pt-4">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <span className="avatar flex-none h-20 w-20 overflow-hidden rounded-full">
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span>{getInitials(coach.displayName)}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate font-heading text-[20px] font-extrabold">{coach.displayName}</h1>
                {coach.isVerified && <span className="flex-none text-[var(--primary)]"><Icon name="verified" size={17} /></span>}
              </div>
              {coach.specialty && <p className="text-[13px] text-[var(--muted)]">{coach.specialty}</p>}
              <div className="mt-1 flex items-center gap-3 text-[12.5px] text-[var(--muted)]">
                {!!coach.rating && (
                  <span className="flex items-center gap-0.5">
                    <Icon name="star" size={14} /> {coach.rating.toFixed(1)}
                    {!!coach.reviewCount && <span className="opacity-70">({coach.reviewCount})</span>}
                  </span>
                )}
                {coachLocation(coach) && <span className="truncate">{coachLocation(coach)}</span>}
              </div>
            </div>
          </div>

          {/* Quick facts */}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Private rate</div>
              <div className="font-heading text-[16px] font-extrabold">{coachRate(coach)}<span className="text-[12px] font-normal text-[var(--muted)]">/hr</span></div>
            </div>
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Experience</div>
              <div className="font-heading text-[16px] font-extrabold">
                {coach.experienceYears ? `${coach.experienceYears} yrs` : '—'}
              </div>
            </div>
          </div>

          {coach.bio && (
            <section className="mt-6">
              <h2 className="font-heading text-[15px] font-extrabold">About</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2,var(--muted))]">{coach.bio}</p>
            </section>
          )}

          {/* Bookable session types. Tapping one pre-selects it in the form. */}
          {services.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-[15px] font-extrabold">Sessions</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => book(s.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{serviceLabel(s)}</span>
                        <span className="block text-[12px] text-[var(--muted)]">
                          {[serviceDuration(s), s.maxStudents ? `up to ${s.maxStudents}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="flex-none font-heading text-[14px] font-extrabold">
                        {money(s.price, coach.priceCurrency)}
                      </span>
                      <Icon name="chevron_right" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {coach.venues.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-[15px] font-extrabold">Coaches at</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {coach.venues.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('court-details', { id: v.slug || v.id })}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-left"
                    >
                      <Icon name="stadium" size={18} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{v.name}</span>
                        {v.location && <span className="block truncate text-[12px] text-[var(--muted)]">{v.location}</span>}
                      </span>
                      <Icon name="chevron_right" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {!loading && !failed && coach && (
        <div className="sticky-cta">
          <Button fullWidth onClick={() => book()}>Book a session</Button>
        </div>
      )}
    </div>
  );
}
