import { Fragment, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { getInitials } from '../../shared/lib/initials';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import type { Navigate } from '../../shared/lib/navigation';
import { tierForDupr } from '../../shared/lib/skillTiers';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';

interface ProfileScreenProps {
  onNavigate: Navigate;
  onLogout: () => void;
}

type MenuItem = {
  key: string;
  icon: string;
  label: string;
  value?: string;
  color: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
};

function MenuRow({ item }: { item: MenuItem }) {
  const danger = item.tone === 'danger';
  return (
    <button type="button" onClick={item.onClick} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left">
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{ background: item.color }}
      >
        <Icon name={item.icon} size={18} />
      </span>
      <span
        className="flex-1 min-w-0 font-heading font-semibold text-[16px]"
        style={{ color: danger ? 'var(--coral)' : 'var(--ink)' }}
      >
        {item.label}
      </span>
      {item.value && <span className="text-[14px] font-semibold text-[var(--muted)] shrink-0">{item.value}</span>}
      {!danger && <Icon name="chevron" size={18} className="text-[var(--surface-3)] shrink-0" />}
    </button>
  );
}

function MenuGroup({ items }: { items: MenuItem[] }) {
  return (
    <div className="card p-0!">
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && <div className="h-px bg-[var(--hairline)] ml-[70px]" />}
          <MenuRow item={item} />
        </Fragment>
      ))}
    </div>
  );
}

export function ProfileScreen({ onNavigate, onLogout }: ProfileScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [duprOpen, setDuprOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isOwner = userHasPermission(currentUser, 'owner.access');

  const name = currentUser?.displayName ?? 'Your profile';
  const initials = getInitials(currentUser?.displayName) || '··';
  const tier = currentUser?.skillLevel != null ? tierForDupr(currentUser.skillLevel) : null;
  const roleLine = tier
    ? `${tier.name} Player`.toUpperCase()
    : (currentUser?.skillLevelLabel?.toUpperCase() ?? 'PICKLEBALL PLAYER');

  // Profile stats are still demo data — the API doesn't expose win/loss totals.
  const stats = [
    { label: 'DUPR', value: currentUser?.skillLevel != null ? `${currentUser.skillLevel}` : '—' },
    { label: 'Games', value: '124' },
    { label: 'Win rate', value: '66%' },
  ];

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Activity',
      items: [
        { key: 'my-games', icon: 'paddle', label: 'My games', color: 'var(--primary)', onClick: () => onNavigate('my-games') },
        { key: 'my-bookings', icon: 'calendar', label: 'My bookings', color: '#5b7400', onClick: () => onNavigate('my-bookings') },
        ...(userHasPermission(currentUser, 'user.messages.send')
          ? [{ key: 'messages', icon: 'chat', label: 'Messages', color: 'var(--primary)', onClick: () => onNavigate('messages') } as MenuItem]
          : []),
        { key: 'clubs', icon: 'groups', label: 'Clubs', color: 'var(--coral)', onClick: () => onNavigate('clubs') },
        ...(isOwner
          ? [{ key: 'owner-venues', icon: 'storefront', label: 'My venues', color: 'var(--primary)', onClick: () => onNavigate('owner-venues') } as MenuItem]
          : []),
        ...(userHasPermission(currentUser, 'organizer.access')
          ? [{ key: 'organize', icon: 'trophy', label: 'Organize', color: '#c89000', onClick: () => onNavigate('organizer-hub') } as MenuItem]
          : []),
      ],
    },
    {
      title: 'Account',
      items: [
        { key: 'account', icon: 'user', label: 'Account', color: 'var(--primary)', onClick: () => onNavigate('edit-profile') },
        {
          key: 'dupr',
          icon: 'verified',
          label: 'DUPR & Rating',
          value: currentUser?.skillLevel != null ? 'Verified' : undefined,
          color: '#c89000',
          onClick: () => setDuprOpen(true),
        },
        { key: 'privacy', icon: 'shield', label: 'Privacy & Visibility', color: '#5b7400', onClick: () => onNavigate('settings') },
      ],
    },
    {
      title: 'App',
      items: [
        { key: 'notifications', icon: 'bell', label: 'Notifications', value: 'On', color: 'var(--coral)', onClick: () => onNavigate('notifications') },
        { key: 'settings', icon: 'settings', label: 'Settings', color: 'var(--ink-2)', onClick: () => onNavigate('settings') },
      ],
    },
    {
      title: 'Support',
      items: [
        { key: 'help', icon: 'help', label: 'Help & Support', color: 'var(--ink-2)', onClick: () => onNavigate('settings') },
        { key: 'signout', icon: 'logout', label: 'Sign out', color: 'var(--coral)', tone: 'danger', onClick: onLogout },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => !q || it.label.toLowerCase().includes(q)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="px-5">
        <h1 className="hd-display">Profile</h1>
      </div>

      {/* Search */}
      <div className="px-5 mt-4">
        <div className="searchbar mx-0! mt-0!">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-[var(--muted)]">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Profile card — hidden while searching */}
      {!q && (
        <button
          type="button"
          onClick={() => onNavigate('edit-profile')}
          className="section block w-full text-left"
          aria-label="Edit your profile"
        >
          <div className="card">
            <div className="flex items-center gap-3.5 px-4 py-4">
              <span className="relative shrink-0">
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden font-heading font-semibold text-[18px]"
                  style={{
                    background: 'var(--primary-soft)',
                    color: 'var(--primary-deep)',
                    boxShadow: '0 0 0 2px var(--surface), 0 0 0 4px var(--coral)',
                  }}
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-[18px] text-[var(--ink)] truncate">{name}</div>
                <div className="t-eyebrow mt-1">{roleLine}</div>
              </div>
              <Icon name="chevron" size={18} className="text-[var(--surface-3)] shrink-0" />
            </div>
            <div className="h-px bg-[var(--hairline)]" />
            <div className="flex px-4 py-4">
              {stats.map((s) => (
                <div key={s.label} className="flex-1 text-center min-w-0">
                  <div className="font-heading font-semibold text-[22px] text-[var(--ink)] leading-none">{s.value}</div>
                  <div className="t-eyebrow mt-1.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </button>
      )}

      {filtered.map((section) => (
        <div key={section.title} className="section">
          <div className="t-eyebrow mb-2.5 px-0.5">{section.title}</div>
          <MenuGroup items={section.items} />
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="section text-center text-[13px] text-[var(--muted)]">No settings match "{query}".</div>
      )}

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
