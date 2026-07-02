import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { useTheme, type ThemePreference } from '../../../shared/hooks/useTheme';
import { useNotificationStore } from '../../../shared/lib/notificationStore';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission, DEFAULT_PREFERENCES, type PrivacySetting, type UserPreferences } from '../../../shared/lib/permissions';
import { getSettings, updateSettings, type ProfileUpdate } from '../../../shared/lib/api';

/**
 * v2.1 Settings shell. Reuses the `v2-profile` style scope (the mockup kept the
 * settings list inside Profile.html, so its `.settings-*` classes already live
 * under `.pb-v2.v2-profile` in v2.css). Rendered from App.tsx when the player
 * design is v2.1; the v1 `SettingsScreen` still serves New/Classic.
 *
 * Carries the **logout path**: the destructive "Log out" row calls `onLogout`
 * (App's `handleLogout` → clears the session + returns to guest browsing).
 *
 * Notification toggles + display units **persist to the account** via
 * `authStore.updateProfile()` → `PATCH /me { preferences }` (optimistic, with
 * revert on failure). Theme stays client-side (`useTheme` → localStorage).
 */

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const UNITS: { id: UserPreferences['units']; label: string }[] = [
  { id: 'km', label: 'Kilometres' },
  { id: 'mi', label: 'Miles' },
];

const NOTIFICATIONS: { key: keyof UserPreferences['notifications']; label: string; hint: string }[] = [
  { key: 'gameReminders', label: 'Game reminders', hint: 'Upcoming games & booking times' },
  { key: 'chatMessages', label: 'Chat messages', hint: 'New direct & group messages' },
  { key: 'announcements', label: 'Announcements', hint: 'Club & organizer updates' },
];

const PRIVACY: { id: PrivacySetting; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'friends', label: 'Friends' },
  { id: 'private', label: 'Private' },
];

const PRIVACY_HINT: Record<PrivacySetting, string> = {
  public: 'Anyone can find and view your profile.',
  friends: 'Only players you’ve connected with can see your profile.',
  private: 'Your profile is hidden from discovery and search.',
};

// Preset "Near me" radii (stored in km). Labelled in the user's chosen unit.
const RADII_KM = [5, 10, 25, 50] as const;
const KM_TO_MI = 0.621371;

const Chevron = () => (
  <svg className="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

/** A pill-style segmented control reused for theme + units. */
function Segmented<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
              fontSize: 13,
              background: active ? 'var(--lime)' : 'var(--bg-app)',
              color: active ? 'var(--on-accent)' : 'var(--ink)',
              border: `1px solid ${active ? 'var(--lime-active)' : 'var(--border-subtle)'}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** A simple on/off switch. */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        padding: 2,
        background: checked ? 'var(--lime-active)' : 'var(--border-subtle)',
        transition: 'background 0.15s ease',
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

interface SettingsV2Props extends V2ScreenChrome {
  onLogout: () => void;
}

export function SettingsScreenV2(props: SettingsV2Props) {
  const { onNavigate, onLogout } = props;
  const { theme, setTheme } = useTheme();
  const unread = useNotificationStore((s) => s.unread);

  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  // Local mirrors of the saved settings so controls feel instant; we persist in
  // the background and revert the mirror if the request fails.
  const [prefs, setPrefs] = useState<UserPreferences>(user?.preferences ?? DEFAULT_PREFERENCES);
  const [privacy, setPrivacy] = useState<PrivacySetting>(user?.privacySetting ?? 'public');
  const [saveError, setSaveError] = useState(false);

  // Admin-only: email monitoring settings
  const isAdmin = user != null && (user.roleDefault === 'admin' || user.roles?.includes('admin') || userHasPermission(user, 'admin.access'));
  const [bccEnabled, setBccEnabled] = useState(false);
  const [bccAddress, setBccAddress] = useState('info@eunika.agency');
  const [bccSaving, setBccSaving] = useState(false);
  const [bccDirty, setBccDirty] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getSettings().then((s) => {
      setBccEnabled(s.emailBccEnabled ?? false);
      setBccAddress(s.emailBccAddress ?? 'info@eunika.agency');
    }).catch(() => {});
  }, [isAdmin]);

  const saveBcc = async () => {
    setBccSaving(true);
    try {
      await updateSettings({ emailBccEnabled: bccEnabled, emailBccAddress: bccAddress });
      setBccDirty(false);
    } catch { /* keep dirty state */ }
    setBccSaving(false);
  };

  // Persist a preferences patch optimistically: apply `next` locally, send only
  // the changed slice to the server, and roll back to `prev` on failure.
  const persist = (next: UserPreferences, patch: ProfileUpdate['preferences']) => {
    const prev = prefs;
    setPrefs(next);
    setSaveError(false);
    updateProfile({ preferences: patch }).catch(() => {
      setPrefs(prev);
      setSaveError(true);
    });
  };

  const toggleNotification = (key: keyof UserPreferences['notifications']) => {
    const value = !prefs.notifications[key];
    persist(
      { ...prefs, notifications: { ...prefs.notifications, [key]: value } },
      { notifications: { [key]: value } },
    );
  };

  const setUnits = (units: UserPreferences['units']) => {
    if (units === prefs.units) return;
    persist({ ...prefs, units }, { units });
  };

  const setRadius = (searchRadiusKm: number) => {
    if (searchRadiusKm === prefs.searchRadiusKm) return;
    persist({ ...prefs, searchRadiusKm }, { searchRadiusKm });
  };

  // Privacy lives at the top level of the user (not under preferences), so it
  // persists via its own optimistic path.
  const setPrivacySetting = (next: PrivacySetting) => {
    if (next === privacy) return;
    const prev = privacy;
    setPrivacy(next);
    setSaveError(false);
    updateProfile({ privacySetting: next }).catch(() => {
      setPrivacy(prev);
      setSaveError(true);
    });
  };

  // Label a km radius in the user's chosen unit (value persisted stays km).
  const radiusLabel = (km: number) =>
    prefs.units === 'mi' ? `${Math.round(km * KM_TO_MI)} mi` : `${km} km`;

  return (
    <V2Shell screen="v2-profile" chrome={props} title="Settings" hideTabBar hideFab>
      {/* APPEARANCE */}
      <div className="content-section">
        <h2 className="section-title">Appearance</h2>
        <Segmented options={THEMES} value={theme} onChange={setTheme} />
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

      {/* NOTIFICATION PREFERENCES */}
      <div className="content-section">
        <h2 className="section-title">Notify me about</h2>
        <ul className="settings-list">
          {NOTIFICATIONS.map(({ key, label, hint }) => (
            <li key={key} className="settings-item" style={{ cursor: 'default' }}>
              <div className="settings-label">
                <strong>{label}</strong>
                <span>{hint}</span>
              </div>
              <Toggle checked={prefs.notifications[key]} onChange={() => toggleNotification(key)} label={label} />
            </li>
          ))}
        </ul>
      </div>

      {/* DISPLAY UNITS */}
      <div className="content-section">
        <h2 className="section-title">Distance units</h2>
        <Segmented options={UNITS} value={prefs.units} onChange={setUnits} />
      </div>

      {/* SEARCH RADIUS */}
      <div className="content-section">
        <h2 className="section-title">Search radius</h2>
        <Segmented
          options={RADII_KM.map((km) => ({ id: String(km), label: radiusLabel(km) }))}
          value={String(prefs.searchRadiusKm)}
          onChange={(id) => setRadius(Number(id))}
        />
        <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          Default distance for “Near me” when browsing courts.
        </p>
      </div>

      {/* PRIVACY & VISIBILITY */}
      <div className="content-section">
        <h2 className="section-title">Privacy &amp; visibility</h2>
        <Segmented options={PRIVACY} value={privacy} onChange={setPrivacySetting} />
        <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          {PRIVACY_HINT[privacy]}
        </p>
      </div>

      {saveError && (
        <div className="content-section" role="alert" style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600 }}>
          Couldn’t save your preferences. Check your connection and try again.
        </div>
      )}

      {/* ADMIN: Email monitoring */}
      {isAdmin && (
        <div className="content-section">
          <h2 className="section-title">Email monitoring</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            Send a copy of every transactional email to a monitoring inbox.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <div>
              <strong style={{ fontSize: 14, color: "var(--ink)" }}>Email monitoring</strong>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {bccEnabled ? `Monitoring copies sent to ${bccAddress}` : "Off"}
              </p>
            </div>
            <Toggle checked={bccEnabled} onChange={() => { setBccEnabled(!bccEnabled); setBccDirty(true); }} label="Email monitoring" />
          </div>
          {bccEnabled && (
            <div style={{ padding: "8px 0" }}>
              <input
                type="email"
                value={bccAddress}
                onChange={(e) => { setBccAddress(e.target.value); setBccDirty(true); }}
                placeholder="info@eunika.agency"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 12,
                  border: "2px solid var(--muted)", background: "var(--surface)",
                  fontSize: 14, fontWeight: 600, color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>
          )}
          {bccDirty && (
            <button
              onClick={saveBcc}
              disabled={bccSaving}
              style={{
                marginTop: 8, padding: "10px 20px", borderRadius: 999,
                background: "var(--lime)", color: "var(--on-accent)",
                fontWeight: 700, fontSize: 14, border: "none",
              }}
            >
              {bccSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}

      {/* ADMIN: Test email tool */}
      {isAdmin && (
        <div className="content-section">
          <h2 className="section-title">Admin tools</h2>
          <ul className="settings-list">
            <li className="settings-item" role="button" tabIndex={0} onClick={() => onNavigate('test-email')}>
              <div className="settings-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <div className="settings-label">
                <strong>Test email tool</strong>
                <span>Send sample emails to preview templates</span>
              </div>
              <Chevron />
            </li>
          </ul>
        </div>
      )}

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
