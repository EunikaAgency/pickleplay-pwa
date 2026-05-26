import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/Chip';
import { useTheme, type ThemePreference } from '../hooks/useTheme';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const SECTIONS = [
  {
    title: 'Account',
    items: [
      { id: 'edit-profile',   ic: 'user',   name: 'Edit profile',        desc: 'Name, photo, bio', color: 'var(--primary)' },
      { id: 'notifications',  ic: 'bell',   name: 'Notifications',       desc: 'Push, email, in-app', color: 'var(--coral)' },
      { id: 'settings',       ic: 'shield', name: 'Privacy & security',  desc: 'Visibility, blocking', color: '#5b7400' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'settings', ic: 'help', name: 'Help & FAQ',          desc: 'Get answers and contact us', color: 'var(--ink-2)' },
      { id: 'settings', ic: 'bolt', name: 'About PickleBallers', desc: 'Version, terms, credits',    color: 'var(--primary)' },
    ],
  },
];

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function SettingsScreen({ onLogout, onNavigate, onBack }: SettingsScreenProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="scroll" style={{ paddingBottom: 60, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="back" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="hd-2">Settings</div>
          <div className="t-sm">Tweak your experience</div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <div className="hd-2">Appearance</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'var(--primary-tint)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bolt" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Theme</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Light, dark, or system.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map((opt) => (
              <Chip key={opt.id} selected={theme === opt.id} onClick={() => setTheme(opt.id)}>
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="section">
          <div className="section-head">
            <div className="hd-2">{section.title}</div>
          </div>
          <div className="set-list">
            {section.items.map((s) => (
              <button key={s.name} className="row" onClick={() => onNavigate(s.id)}>
                <div className="ic" style={{ background: s.color }}>
                  <Icon name={s.ic} size={16} />
                </div>
                <div className="body">
                  <div className="name">{s.name}</div>
                  <div className="desc">{s.desc}</div>
                </div>
                <Icon name="chevron" size={16} className="chev" />
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="section">
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            height: 52,
            background: 'var(--coral-soft)',
            color: 'var(--coral)',
            borderRadius: 16,
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}
