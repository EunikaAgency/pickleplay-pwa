import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicProfileHero, type ProfileAction, type ProfileStat } from '../../shared/components/ui/PublicProfileHero';
import { Toast } from '../../shared/components/ui/Toast';
import { apiImageUrl, getCoach, startConversation, type ApiCoachDetail } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';
import { coachLocation, coachRate, money, serviceDuration, serviceLabel } from './coachDisplay';

interface CoachDetailScreenProps {
  coachId: string;
  onNavigate: Navigate;
  onBack: () => void;
  /** Returns false (and opens the auth sheet) when the viewer is a guest. */
  onRequireAuth?: (intent: string) => boolean;
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
const StadiumIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a8 3 0 0 0 16 0" /><path d="M4 8v8a8 3 0 0 0 16 0V8" /><path d="M4 8a8 3 0 0 1 16 0" /></svg>
);
const ChevIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

export function CoachDetailScreen({ coachId, onNavigate, onBack, onRequireAuth }: CoachDetailScreenProps) {
  const [coach, setCoach] = useState<ApiCoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('About');
  const [messaging, setMessaging] = useState(false);
  const [toast, setToast] = useState(false);

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

  const message = async () => {
    if (!coach?.userId || messaging) return;
    if (onRequireAuth && !onRequireAuth('message a coach')) return;
    setMessaging(true);
    try {
      const conv = await startConversation(coach.userId);
      onNavigate('chat', { id: conv.id, name: coach.displayName });
    } catch { setMessaging(false); }
  };

  const share = async () => {
    if (!coach) return;
    const url = `${window.location.origin}/coaches/${coach.slug || coach.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: coach.displayName, url }); return; }
      await navigator.clipboard.writeText(url);
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch { /* dismissed / unsupported */ }
  };

  const photo = coach ? apiImageUrl(coach.avatarUrl || coach.imageUrl) : null;
  const services = useMemo(() => (coach?.services ?? []).filter((s) => s.isActive !== false), [coach]);
  const venues = coach?.venues ?? [];

  // Tabs are data-driven — only surface a tab that has content.
  const tabs = useMemo(() => {
    const list = ['About'];
    if (services.length) list.push('Sessions');
    if (venues.length) list.push('Venues');
    return list;
  }, [services.length, venues.length]);

  // Keep the active tab valid if the visible set changes (e.g. after load).
  const activeTab = tabs.includes(tab) ? tab : 'About';

  const rateLabel = coach ? coachRate(coach) : '—';
  const stats: ProfileStat[] = [];
  if (coach?.rating) stats.push({ value: coach.rating.toFixed(1), label: coach.reviewCount ? `Rating · ${coach.reviewCount}` : 'Rating' });
  if (coach?.experienceYears) stats.push({ value: `${coach.experienceYears} yr${coach.experienceYears === 1 ? '' : 's'}`, label: 'Experience' });
  if (rateLabel !== '—') stats.push({ value: rateLabel, label: 'Per hour' });

  const actions: ProfileAction[] = [];
  if (coach) {
    actions.push({ label: 'Book a session', onClick: () => book() });
    actions.push(coach.userId
      ? { label: messaging ? 'Opening…' : 'Message', onClick: () => void message(), disabled: messaging, variant: 'outline' }
      : { label: 'Share', onClick: () => void share(), variant: 'outline' });
  }

  const loc = coach ? coachLocation(coach) : '';

  return (
    <div className="pb-v2 px-profile">
      <header className="px-topbar">
        <button className="px-iconbtn" aria-label="Go back" onClick={onBack}><BackIcon /></button>
        <span className="px-topbar-eyebrow">Coach</span>
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
          <div className="px-error-emoji">🎾</div>
          <p>Couldn't load this coach. They may no longer be listed.</p>
          <button className="px-retry" onClick={retry}>Try again</button>
        </div>
      )}

      {!loading && !failed && coach && (
        <>
          <PublicProfileHero
            name={coach.displayName}
            handle={coach.specialty || 'Pickleball coach'}
            avatarUrl={photo}
            verified={!!coach.isVerified}
            bio={coach.bio}
            detail={loc ? <><PinIcon />{loc}</> : undefined}
            stats={stats}
            tabs={tabs.length > 1 ? tabs : undefined}
            activeTab={activeTab}
            onTab={setTab}
          />

          {/* 2×2 stat card grid */}
          <div className="px-grid">
            <div className="px-slot">
              <div className="px-slot-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              </div>
              <div className="px-slot-value">{coach.skillLevelLabel || '—'}</div>
              <div className="px-slot-label">Skill{coach.skillLevel ? ` · DUPR ${coach.skillLevel}` : ''}</div>
            </div>
            <div className="px-slot">
              <div className="px-slot-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <div className="px-slot-value">{coach.studentCount ?? 0}</div>
              <div className="px-slot-label">Student{(coach.studentCount ?? 0) === 1 ? '' : 's'}</div>
            </div>
            <div className="px-slot">
              <div className="px-slot-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <div className="px-slot-value">{rateLabel}</div>
              <div className="px-slot-label">per hour</div>
            </div>
            <div className="px-slot">
              <div className="px-slot-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a8 3 0 0 0 16 0" /><path d="M4 8v8a8 3 0 0 0 16 0V8" /><path d="M4 8a8 3 0 0 1 16 0" /></svg>
              </div>
              <div className="px-slot-value">{venues.length}</div>
              <div className="px-slot-label">Venue{venues.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div className="px-body">
            {activeTab === 'About' && (
              <>
                <section className="px-section">
                  <h2 className="px-section-title">About</h2>
                  <p className="px-text">{coach.bio || `${coach.displayName} hasn't added a bio yet.`}</p>
                </section>

                {!!coach.languages?.length && (
                  <section className="px-section">
                    <h2 className="px-section-title">Languages</h2>
                    <div className="px-chips">
                      {coach.languages.map((l) => <span key={l} className="px-chip">{l}</span>)}
                    </div>
                  </section>
                )}

                {!!coach.certifications?.length && (
                  <section className="px-section">
                    <h2 className="px-section-title">Certifications</h2>
                    <div className="px-chips">
                      {coach.certifications.map((c) => <span key={c} className="px-chip">{c}</span>)}
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'Sessions' && (
              <section className="px-section">
                <h2 className="px-section-title">Book a session</h2>
                <div className="px-card">
                  {services.map((s) => (
                    <button key={s.id} type="button" className="px-row" onClick={() => book(s.id)}>
                      <span className="px-row-main">
                        <span className="px-row-title">{serviceLabel(s)}</span>
                        <span className="px-row-sub">
                          {[serviceDuration(s), s.maxStudents ? `up to ${s.maxStudents}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="px-row-price">{money(s.price, coach.priceCurrency)}</span>
                      <span className="px-chev"><ChevIcon /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'Venues' && (
              <section className="px-section">
                <h2 className="px-section-title">Coaches at</h2>
                <div className="px-card">
                  {venues.map((v) => (
                    <button key={v.id} type="button" className="px-row" onClick={() => onNavigate('court-details', { id: v.slug || v.id })}>
                      <span className="px-row-icon"><StadiumIcon /></span>
                      <span className="px-row-main">
                        <span className="px-row-title">{v.name}</span>
                        {v.location && <span className="px-row-sub">{v.location}</span>}
                      </span>
                      <span className="px-chev"><ChevIcon /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

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
