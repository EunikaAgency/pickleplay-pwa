import { useCallback, useEffect, useState } from 'react';
import { PublicProfileHero, type ProfileAction, type ProfileStat } from '../../shared/components/ui/PublicProfileHero';
import { Toast } from '../../shared/components/ui/Toast';
import { apiImageUrl, getPublicUser, startConversation, type PublicUser } from '../../shared/lib/api';
import { ROLE_META } from '../../shared/lib/roleDisplay';
import { useAuthStore } from '../../shared/lib/authStore';
import type { Navigate } from '../../shared/lib/navigation';

interface PlayerProfileScreenProps {
  userId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

/* Small inline stroke icons, matching the v2 chrome idiom. */
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const ShareIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
);
const PinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
const CoachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6" /><path d="m2 10 10-5 10 5-10 5z" /><path d="M6 12v5c3 2.5 9 2.5 12 0v-5" /></svg>
);
const ChevIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

/** "Jul 2026" from an ISO date; '' when missing/unparseable. */
function monthYear(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function PlayerProfileScreen({ userId, onNavigate, onBack }: PlayerProfileScreenProps) {
  const me = useAuthStore((s) => s.user);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(false);

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
    setLoading(true); setFailed(false); setReloadKey((k) => k + 1);
  }, []);

  const message = async () => {
    if (!user || messaging) return;
    setMessaging(true);
    try {
      const conv = await startConversation(user.id);
      onNavigate('chat', { id: conv.id, name: user.displayName });
    } catch { setMessaging(false); }
  };

  const share = async () => {
    if (!user) return;
    const url = `${window.location.origin}/players/${user.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: user.displayName, url }); return; }
      await navigator.clipboard.writeText(url);
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch { /* dismissed / unsupported */ }
  };

  const isSelf = !!me && me.id === userId;
  const photo = user ? apiImageUrl(user.avatarUrl) : null;
  const isPrivate = user?.privacySetting === 'private';

  const roleWord = user?.isCoach ? 'Coach' : user?.isOrganizer ? 'Organizer' : 'Player';
  const handle = user
    ? [roleWord, !isPrivate && user.skillLevelLabel ? user.skillLevelLabel : null].filter(Boolean).join(' · ')
    : '';
  const loc = !isPrivate && (user?.city || user?.province)
    ? [user?.city, user?.province].filter(Boolean).join(', ')
    : '';
  const joined = monthYear(user?.memberSince);

  const stats: ProfileStat[] = [];
  if (user && !isPrivate && user.skillLevel) stats.push({ value: String(user.skillLevel), label: 'DUPR' });
  if (joined) stats.push({ value: joined, label: 'joined' });

  const actions: ProfileAction[] = [];
  if (user) {
    if (isSelf) {
      actions.push({ label: 'Edit profile', onClick: () => onNavigate('edit-profile') });
    } else {
      actions.push({ label: messaging ? 'Opening…' : `Message`, onClick: () => void message(), disabled: messaging });
    }
    actions.push({ label: 'Share', onClick: () => void share(), variant: 'outline' });
  }

  const partnerRoles = user?.partnerRoles ?? [];
  const showCoachShortcut = !!(user?.isCoach && user.coach && !isSelf);
  const hasBody = isPrivate || partnerRoles.length > 0 || showCoachShortcut;

  return (
    <div className="pb-v2 px-profile">
      <header className="px-topbar">
        <button className="px-iconbtn" aria-label="Go back" onClick={onBack}><BackIcon /></button>
        <span className="px-topbar-eyebrow">Player</span>
        <button className="px-iconbtn" aria-label="Share profile" onClick={() => void share()}><ShareIcon /></button>
      </header>

      {loading && (
        <section className="px-hero">
          <div className="px-id">
            <div className="px-id-main">
              <div className="v2sk" style={{ height: 26, width: '62%', borderRadius: 8 }} />
              <div className="v2sk" style={{ height: 13, width: '44%', marginTop: 12, borderRadius: 8 }} />
            </div>
            <div className="v2sk" style={{ width: 74, height: 74, borderRadius: '50%' }} />
          </div>
          <div className="v2sk" style={{ height: 13, marginTop: 20, borderRadius: 8 }} />
          <div className="v2sk" style={{ height: 13, width: '80%', marginTop: 8, borderRadius: 8 }} />
          <div className="px-actions">
            <div className="v2sk" style={{ flex: 1, height: 44, borderRadius: 12 }} />
            <div className="v2sk" style={{ flex: 1, height: 44, borderRadius: 12 }} />
          </div>
        </section>
      )}

      {!loading && failed && (
        <div className="px-error">
          <div className="px-error-emoji">🤷</div>
          <p>Couldn't load this profile. The player may no longer exist.</p>
          <button className="px-retry" onClick={retry}>Try again</button>
        </div>
      )}

      {!loading && !failed && user && (
        <>
          <PublicProfileHero
            name={user.displayName}
            handle={handle}
            avatarUrl={photo}
            verified={user.isVerified}
            bio={isPrivate ? undefined : user.bio}
            detail={loc ? <><PinIcon />{loc}</> : undefined}
            stats={stats}
            actions={undefined}
          />

          {/* 2×2 stat card grid */}
          {!isPrivate && (
            <div className="px-grid">
              <div className="px-slot">
                <div className="px-slot-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                </div>
                <div className="px-slot-value">{user.skillLevelLabel || '—'}</div>
                <div className="px-slot-label">Skill{user.skillLevel ? ` · DUPR ${user.skillLevel}` : ''}</div>
              </div>
              <div className="px-slot">
                <div className="px-slot-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <div className="px-slot-value">{joined || '—'}</div>
                <div className="px-slot-label">Member since</div>
              </div>
              {loc ? (
                <div className="px-slot">
                  <div className="px-slot-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <div className="px-slot-value" style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                    {[user.city, user.province].filter(Boolean).join(', ')}
                  </div>
                  <div className="px-slot-label">Location</div>
                </div>
              ) : null}
              <div className="px-slot">
                <div className="px-slot-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <div className="px-slot-value" style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15 }}>
                  {roleWord}
                </div>
                <div className="px-slot-label">Role</div>
              </div>
            </div>
          )}

          {hasBody && (
            <div className="px-body">
              {isPrivate && (
                <p className="px-note">🔒 This profile is private.</p>
              )}

              {partnerRoles.length > 0 && (
                <section className="px-section">
                  <h2 className="px-section-title">Partner at</h2>
                  <div className="px-partners">
                    {partnerRoles.map((p) => {
                      const color = ROLE_META[p.role as keyof typeof ROLE_META]?.color ?? '#6B7280';
                      const label = ROLE_META[p.role as keyof typeof ROLE_META]?.label ?? p.role;
                      return (
                        <span key={`${p.role}-${p.venueId}`} className="px-partner" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                          {label} at {p.venueName}
                        </span>
                      );
                    })}
                  </div>
                </section>
              )}

              {showCoachShortcut && user.coach && (
                <section className="px-section">
                  <div className="px-card accent">
                    <button
                      type="button"
                      className="px-row"
                      onClick={() => onNavigate('coach-detail', { id: user.coach!.slug || user.coach!.id })}
                    >
                      <span className="px-row-icon"><CoachIcon /></span>
                      <span className="px-row-main">
                        <span className="px-row-title">Book a coaching session</span>
                        {user.coach.specialty && <span className="px-row-sub">{user.coach.specialty}</span>}
                      </span>
                      <span className="px-chev"><ChevIcon /></span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          <div className="px-sticky-cta">
            {actions.map((a, i) => (
              <button key={a.label} type="button" className={`px-btn ${a.variant ?? (i === 0 ? 'primary' : 'outline')}`} onClick={a.onClick} disabled={a.disabled}>{a.label}</button>
            ))}
          </div>
        </>
      )}

      <div className="px-toast-wrap"><Toast message="Link copied" show={toast} /></div>
    </div>
  );
}
