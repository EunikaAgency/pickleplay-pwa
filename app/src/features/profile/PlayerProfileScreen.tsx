import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { apiImageUrl, getPublicUser, startConversation, type PublicUser } from '../../shared/lib/api';
import { getInitials } from '../../shared/lib/initials';
import { ROLE_META } from '../../shared/lib/roleDisplay';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

interface PlayerProfileScreenProps {
  userId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/** A coloured role pill. Falls back to grey for roles roleDisplay doesn't know. */
function RolePill({ role, label }: { role: string; label?: string }) {
  const meta = ROLE_META[role as keyof typeof ROLE_META];
  const color = meta?.color ?? '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {role === 'coach' && <Icon name="sports" size={13} />}
      {role === 'organizer' && <Icon name="emoji_events" size={13} />}
      {label ?? meta?.label ?? role}
    </span>
  );
}

export function PlayerProfileScreen({ userId, onNavigate, onBack }: PlayerProfileScreenProps) {
  const me = useAuthStore((s) => s.user);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Only touch state from the async callbacks — a synchronous setState inside an
  // effect body cascades renders (react-hooks/set-state-in-effect).
  useEffect(() => {
    let alive = true;
    getPublicUser(userId)
      .then((u) => { if (alive) setUser(u); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setFailed(false);
    setReloadKey((k) => k + 1);
  }, []);

  const message = async () => {
    if (!user || messaging) return;
    setMessaging(true);
    try {
      const conv = await startConversation(user.id);
      onNavigate('chat', { id: conv.id, name: user.displayName });
    } catch {
      setMessaging(false);
    }
  };

  const isSelf = !!me && me.id === userId;
  const photo = user ? apiImageUrl(user.avatarUrl) : null;
  const isPrivate = user?.privacySetting === 'private';

  return (
    <div className="scroll pb-[120px]">
      <div className="sticky top-0 z-20 safe-top bg-[var(--surface)]">
        <ScreenHeader onBack={onBack} eyebrow="Player" title={user?.displayName ?? 'Profile'} />
      </div>

      {loading && <div className="px-5 pt-6"><LoadingSkeleton variant="card" /></div>}
      {!loading && failed && (
        <ErrorState title="Couldn't load this profile" message="The player may no longer exist." onRetry={retry} />
      )}

      {!loading && !failed && user && (
        <div className="px-5 pt-5">
          <div className="flex flex-col items-center text-center">
            <span className="avatar-xl h-24 w-24 overflow-hidden rounded-full">
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span>{getInitials(user.displayName)}</span>}
            </span>

            <h1 className="mt-3 flex items-center gap-1.5 font-heading text-[22px] font-extrabold">
              {user.displayName}
              {user.isVerified && <span className="text-[var(--primary)]"><Icon name="verified" size={18} /></span>}
            </h1>

            {/* Coach / Organizer badges reflect a LIVE subscription, not just a role. */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {user.isCoach && <RolePill role="coach" />}
              {user.isOrganizer && <RolePill role="organizer" />}
              {!user.isCoach && !user.isOrganizer && <RolePill role="player" />}
            </div>

            {!isPrivate && (user.city || user.province) && (
              <p className="mt-2 flex items-center gap-1 text-[13px] text-[var(--muted)]">
                <Icon name="location_on" size={15} />
                {[user.city, user.province].filter(Boolean).join(', ')}
              </p>
            )}

            {user.bio && <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-[var(--muted)]">{user.bio}</p>}
          </div>

          {isPrivate && (
            <p className="mt-6 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-center text-[13px] text-[var(--muted)]">
              This profile is private.
            </p>
          )}

          {!isPrivate && user.skillLevelLabel && (
            <div className="mt-6 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Skill level</div>
              <div className="font-heading text-[16px] font-extrabold">
                {user.skillLevelLabel}
                {!!user.skillLevel && <span className="ml-1.5 text-[12px] font-normal text-[var(--muted)]">DUPR {user.skillLevel}</span>}
              </div>
            </div>
          )}

          {/* Per-venue partner badges — "Coach at Quezon Smash Club". */}
          {user.partnerRoles.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-[15px] font-extrabold">Partner at</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {user.partnerRoles.map((p) => (
                  <li key={`${p.role}-${p.venueId}`}>
                    <RolePill role={p.role} label={`${ROLE_META[p.role as keyof typeof ROLE_META]?.label ?? p.role} at ${p.venueName}`} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Booking shortcut, when this player is a live coach. */}
          {user.isCoach && user.coach && !isSelf && (
            <section className="mt-6">
              <button
                type="button"
                onClick={() => onNavigate('coach-detail', { id: user.coach!.slug || user.coach!.id })}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--primary)] bg-[var(--surface)] px-4 py-3.5 text-left"
              >
                <Icon name="sports" size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">Book a coaching session</span>
                  {user.coach.specialty && (
                    <span className="block truncate text-[12px] text-[var(--muted)]">{user.coach.specialty}</span>
                  )}
                </span>
                <Icon name="chevron_right" size={20} />
              </button>
            </section>
          )}
        </div>
      )}

      {!loading && !failed && user && !isSelf && (
        <div className="sticky-cta">
          <Button fullWidth onClick={() => void message()} disabled={messaging}>
            {messaging ? 'Opening…' : `Message ${user.displayName.split(' ')[0]}`}
          </Button>
        </div>
      )}
    </div>
  );
}
