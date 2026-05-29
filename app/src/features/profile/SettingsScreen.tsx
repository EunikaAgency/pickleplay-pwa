import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { useTheme, type ThemePreference } from '../../shared/hooks/useTheme';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import type { Navigate } from '../../shared/lib/navigation';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate: Navigate;
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
] as const;

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function SettingsScreen({ onLogout, onNavigate, onBack }: SettingsScreenProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="scroll pb-[60px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Settings" subtitle="Tweak your experience" />

      <div className="section mt-0!">
        <div className="section-head">
          <div className="hd-2">Appearance</div>
        </div>
        <div className="card p-3.5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center">
              <Icon name="bolt" size={18} />
            </div>
            <div className="flex-1">
              <div className="font-heading font-semibold text-[14px] text-[var(--ink)]">Theme</div>
              <div className="text-[12px] text-[var(--muted)]">Light, dark, or system.</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
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
          className="w-full h-[52px] rounded-2xl bg-[var(--coral-soft)] text-[var(--coral)] font-heading font-semibold text-[15px] flex items-center justify-center gap-2"
        >
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}
