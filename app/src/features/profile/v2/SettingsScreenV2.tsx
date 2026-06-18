import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { useTheme, type ThemePreference } from '../../../shared/hooks/useTheme';
import { useNotificationStore } from '../../../shared/lib/notificationStore';

/**
 * v2.1 Settings shell. Reuses the `v2-profile` style scope (the mockup kept the
 * settings list inside Profile.html, so its `.settings-*` classes already live
 * under `.pb-v2.v2-profile` in v2.css). Rendered from App.tsx when the player
 * design is v2.1; the v1 `SettingsScreen` still serves New/Classic.
 *
 * Carries the **logout path**: the destructive "Log out" row calls `onLogout`
 * (App's `handleLogout` → clears the session + returns to guest browsing).
 */

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const Chevron = () => (
  <svg className="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

interface SettingsV2Props extends V2ScreenChrome {
  onLogout: () => void;
}

export function SettingsScreenV2(props: SettingsV2Props) {
  const { onNavigate, onLogout } = props;
  const { theme, setTheme } = useTheme();
  const unread = useNotificationStore((s) => s.unread);

  return (
    <V2Shell screen="v2-profile" chrome={props} title="Settings" hideTabBar hideFab>
      {/* APPEARANCE */}
      <div className="content-section">
        <h2 className="section-title">Appearance</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEMES.map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: 13,
                  background: active ? 'var(--lime)' : 'var(--bg-app)',
                  color: 'var(--ink)',
                  border: `1px solid ${active ? 'var(--lime-active)' : 'var(--border-subtle)'}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACCOUNT */}
      <div className="content-section">
        <h2 className="section-title">Account</h2>
        <ul className="settings-list">
          <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('edit-profile')}>
            <div className="settings-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
            <div className="settings-label">
              <strong>Edit Profile</strong>
              <span>Name, photo &amp; bio</span>
            </div>
            <Chevron />
          </li>

          <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('notifications')}>
            <div className="settings-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </div>
            <div className="settings-label">
              <strong>Notifications</strong>
              <span>Game alerts &amp; reminders</span>
            </div>
            {unread > 0 && <span className="badge-pill">{unread > 9 ? '9+' : unread}</span>}
            <Chevron />
          </li>
        </ul>
      </div>

      {/* SESSION */}
      <div className="content-section">
        <ul className="settings-list">
          <li className="settings-item" role="button" tabIndex={0} onClick={onLogout}>
            <div className="settings-icon danger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </div>
            <div className="settings-label">
              <strong style={{ color: 'var(--error)' }}>Log Out</strong>
              <span>Sign out of your account</span>
            </div>
          </li>
        </ul>
      </div>

      <div style={{ height: 20 }} />
    </V2Shell>
  );
}
