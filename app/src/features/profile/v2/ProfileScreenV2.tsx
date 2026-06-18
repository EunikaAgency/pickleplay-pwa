import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import { getInitials } from '../../../shared/lib/initials';

// Demo match history — the API exposes no match results yet (same limitation the
// current ProfileScreen accepts).
const DEMO_MATCHES = [
  { result: 'win', title: 'Sunset Park Round Robin', sub: 'Sat · Doubles', score: '11–7' },
  { result: 'win', title: 'Morning Social Mixer', sub: 'Thu · Mixed Doubles', score: '11–4' },
  { result: 'loss', title: 'Competitive Singles Ladder', sub: 'Tue · Singles', score: '8–11' },
];

export function ProfileScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate } = chrome;
  const user = useAuthStore((s) => s.user);
  const name = user?.displayName ?? 'Guest';
  const level = user?.skillLevelLabel || (user?.skillLevel != null ? `${user.skillLevel.toFixed(1)} DUPR` : null);

  return (
    <V2Shell screen="v2-profile" chrome={chrome}>
      {/* HEADER */}
      <div className="profile-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px', position: 'relative', zIndex: 1 }}>
          <button className="icon-btn" aria-label="Settings" onClick={() => onNavigate('settings')} style={{ color: '#fff' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          <button className="icon-btn" aria-label="Notifications" onClick={() => onNavigate('notifications')} style={{ color: '#fff' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </button>
        </div>

        <div className="profile-card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="avatar-positioner">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt={name} />
                  : <span style={{ fontFamily: "'Grandstander', cursive", fontWeight: 800, fontSize: 28, color: 'var(--ink)' }}>{getInitials(name)}</span>}
              </div>
              {level && <div className="level-badge">{level}</div>}
            </div>
          </div>
          <h1 className="profile-name">{name}</h1>
          {user?.bio && <p className="profile-tagline">{user.bio}</p>}
          <div className="stats-row">
            <div className="stat-col"><span className="stat-col-number games">—</span><span className="stat-col-label">Games</span></div>
            <div className="stat-col"><span className="stat-col-number wins">—</span><span className="stat-col-label">Wins</span></div>
            <div className="stat-col"><span className="stat-col-number losses">—</span><span className="stat-col-label">Losses</span></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="edit-profile-btn" onClick={() => onNavigate('edit-profile')}>Edit Profile</button>
          </div>
        </div>
      </div>

      {/* CONTENT (demo metrics) */}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="section-gap" />

        {userHasPermission(user, 'organizer.access') && (
          <div className="content-section">
            <h2 className="section-title">Organize</h2>
            <button
              className="edit-profile-btn"
              onClick={() => onNavigate('organizer-hub')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              Organizer console
            </button>
          </div>
        )}

        <div className="content-section">
          <h2 className="section-title">Win Rate</h2>
          <div className="winrate-row">
            <div className="winrate-label-group"><p>Play games to start tracking your win rate.</p></div>
            <div className="winrate-number">—</div>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Win rate">
            <div className="progress-fill" style={{ width: '0%' }} />
          </div>
        </div>

        <div className="content-section">
          <h2 className="section-title">Activity</h2>
          <div className="activity-grid">
            <div className="activity-card"><div className="activity-card-label">Last Played</div><div className="activity-card-value">—</div><div className="activity-card-sub">&nbsp;</div></div>
            <div className="activity-card"><div className="activity-card-label">Played</div><div className="activity-card-value">—</div><div className="activity-card-sub">sessions</div></div>
            <div className="activity-card"><div className="activity-card-label">Frequency</div><div className="activity-card-value">—</div><div className="activity-card-sub">per week</div></div>
            <div className="activity-card"><div className="activity-card-label">Best Week</div><div className="activity-card-value">—</div><div className="activity-card-sub">sessions</div></div>
          </div>
        </div>

        <div className="content-section">
          <div className="upgrade-banner">
            <div className="upgrade-text"><strong>Unlock Full Stats</strong><p>Match history, leaderboards &amp; advanced analytics.</p></div>
            <button className="upgrade-pill">Go PRO</button>
          </div>
        </div>

        <div className="section-gap" />

        <div className="content-section">
          <h2 className="section-title">Recent Matches</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {DEMO_MATCHES.map((m, i) => (
              <li key={i} className="match-item">
                <div className={`match-result-badge ${m.result}`}>{m.result === 'win' ? 'W' : 'L'}</div>
                <div className="match-info">
                  <div className="match-info-top">{m.title}</div>
                  <div className="match-info-sub">{m.sub}</div>
                </div>
                <div className="match-score">{m.score}</div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </V2Shell>
  );
}
