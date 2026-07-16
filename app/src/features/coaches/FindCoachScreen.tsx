import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { apiImageUrl, listCoaches, type ApiCoach } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { getInitials } from '../../shared/lib/initials';
import type { Navigate } from '../../shared/lib/navigation';
import { coachRate, coachLocation } from './coachDisplay';

interface FindCoachScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function FindCoachScreen({ onNavigate, onBack }: FindCoachScreenProps) {
  const [coaches, setCoaches] = useState<ApiCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const currentUser = useAuthStore((s) => s.user);

  // A coach browsing Find Coach shouldn't be offered themselves — you can't book
  // yourself (the API 400s with SELF_BOOKING), so hide your own listing. Derived
  // rather than filtered on fetch, so it stays right if the session lands later.
  const visible = coaches.filter((c) => !currentUser || c.userId !== currentUser.id);

  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the search into a server-side query, so matches aren't limited to
  // the rows already on screen. The spinner is flipped on by the input's change
  // handler (an event), never synchronously inside this effect.
  useEffect(() => {
    let alive = true;
    const search = query.trim();
    const t = setTimeout(() => {
      // `subscribed: true` is the whole point of this screen — the directory
      // also holds imported/unclaimed coach rows, which aren't real accounts.
      listCoaches({ subscribed: true, search: search || undefined })
        .then((rows) => { if (alive) { setCoaches(rows); setFailed(false); } })
        .catch(() => { if (alive) setFailed(true); })
        .finally(() => { if (alive) setLoading(false); });
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true); setFailed(false); setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="scroll pb-[100px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Coaching" title="Find a coach" />
      </div>

      <div className="px-5 pt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--field-border)] bg-[var(--surface)] px-3.5 py-3">
          <Icon name="search" size={20} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLoading(true); }}
            placeholder="Search coaches or specialties…"
            aria-label="Search coaches"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted)]"
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <Icon name="verified" size={14} />
          Every coach here holds an active PickleBallers subscription.
        </p>
      </div>

      <div className="px-5 pt-4">
        {loading && <LoadingSkeleton variant="list-row" count={4} />}

        {!loading && failed && (
          <ErrorState
            title="Couldn't load coaches"
            message="Check your connection and try again."
            onRetry={retry}
          />
        )}

        {!loading && !failed && visible.length === 0 && (
          <EmptyState
            icon="sports_tennis"
            title={query ? 'No coaches match that search' : 'No coaches yet'}
            description={
              query
                ? 'Try a different name or specialty.'
                : 'Subscribed coaches will show up here. Are you a coach? Subscribe from your profile.'
            }
            action={query ? undefined : { label: 'Become a coach', onPress: () => onNavigate('coach-subscribe') }}
          />
        )}

        {!loading && !failed && visible.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {visible.map((coach) => {
              const photo = apiImageUrl(coach.avatarUrl || coach.imageUrl);
              return (
                <li key={coach.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('coach-detail', { id: coach.slug || coach.id })}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3.5 text-left"
                  >
                    <span className="avatar flex-none h-14 w-14 overflow-hidden rounded-full">
                      {photo
                        ? <img src={photo} alt="" className="h-full w-full object-cover" />
                        : <span>{getInitials(coach.displayName)}</span>}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-heading text-[15px] font-extrabold">{coach.displayName}</span>
                        {coach.isVerified && (
                          <span className="flex-none text-[var(--primary)]" title="Verified"><Icon name="verified" size={15} /></span>
                        )}
                      </span>
                      {coach.specialty && (
                        <span className="block truncate text-[12.5px] text-[var(--muted)]">{coach.specialty}</span>
                      )}
                      <span className="mt-1 flex items-center gap-2.5 text-[12px] text-[var(--muted)]">
                        {!!coach.rating && (
                          <span className="flex items-center gap-0.5">
                            <Icon name="star" size={13} />
                            {coach.rating.toFixed(1)}
                            {!!coach.reviewCount && <span className="opacity-70">({coach.reviewCount})</span>}
                          </span>
                        )}
                        {coachLocation(coach) && <span className="truncate">{coachLocation(coach)}</span>}
                      </span>
                    </span>

                    <span className="flex-none text-right">
                      <span className="block font-heading text-[14px] font-extrabold">{coachRate(coach)}</span>
                      <span className="block text-[11px] text-[var(--muted)]">per hour</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
