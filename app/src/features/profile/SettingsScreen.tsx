import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { getSettings, updateSettings } from '../../shared/lib/api';
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
  const user = useAuthStore((s) => s.user);
  const isAdmin = user != null && (user.roleDefault === 'admin' || user.roles?.includes('admin') || userHasPermission(user, 'admin.access'));
  const [bccEnabled, setBccEnabled] = useState(false);
  const [bccAddress, setBccAddress] = useState('info@eunika.agency');
  const [bccLoaded, setBccLoaded] = useState(false);
  const [bccSaving, setBccSaving] = useState(false);
  const [bccDirty, setBccDirty] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getSettings().then((s) => {
      setBccEnabled(s.emailBccEnabled ?? false);
      setBccAddress(s.emailBccAddress ?? 'info@eunika.agency');
      setBccLoaded(true);
    }).catch(() => setBccLoaded(true));
  }, [isAdmin]);

  const saveBcc = async () => {
    setBccSaving(true);
    try {
      await updateSettings({ emailBccEnabled: bccEnabled, emailBccAddress: bccAddress });
      setBccDirty(false);
    } catch {}
    setBccSaving(false);
  };

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

      {isAdmin && bccLoaded && (
        <div className="section">
          <div className="section-head"><div className="hd-2">Email monitoring</div></div>
          <div className="card p-4">
            <p className="text-[13px] text-[var(--muted)] mb-3">Send a copy of every transactional email to a monitoring inbox.</p>
            <label className="flex items-center justify-between cursor-pointer mb-3">
              <span className="font-heading font-semibold text-[14px] text-[var(--ink)]">Email monitoring</span>
              <input type="checkbox" checked={bccEnabled} onChange={(e) => { setBccEnabled(e.target.checked); setBccDirty(true); }} className="size-5 rounded accent-[var(--lime)]" />
            </label>
            {bccEnabled && (
              <input
                type="email" value={bccAddress}
                onChange={(e) => { setBccAddress(e.target.value); setBccDirty(true); }}
                placeholder="info@eunika.agency"
                className="w-full h-11 rounded-xl border-2 border-[var(--muted)] bg-[var(--surface)] px-4 text-[14px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] outline-none mb-3 focus:border-[var(--lime)]"
              />
            )}
            {bccDirty && (
              <button onClick={saveBcc} disabled={bccSaving}
                className="h-10 px-5 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-semibold text-[14px]">
                {bccSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="section">
          <div className="section-head"><div className="hd-2">Admin tools</div></div>
          <div className="set-list">
            <button className="row" onClick={() => onNavigate('test-email')}>
              <div className="ic" style={{ background: 'var(--primary)' }}>
                <Icon name="mail" size={16} />
              </div>
              <div className="body">
                <div className="name">Test email tool</div>
                <div className="desc">Send sample emails to preview templates</div>
              </div>
              <Icon name="chevron" size={16} className="chev" />
            </button>
          </div>
        </div>
      )}

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
