import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import { getInitials } from '../../shared/lib/initials';
import type { ScreenId } from '../../shared/lib/navigation';

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (screenId: ScreenId) => void;
  activeScreenId?: string;
}

type AdminSection = {
  label: string;
  icon: string;
  items: { screenId: ScreenId; icon: string; label: string }[];
};

const ADMIN_SECTIONS: AdminSection[] = [
  {
    label: 'Directory',
    icon: 'folder',
    items: [
      { screenId: 'admin-users', icon: 'people', label: 'Players' },
      { screenId: 'admin-venues', icon: 'stadium', label: 'Venues' },
      { screenId: 'admin-owners', icon: 'storefront', label: 'Owners' },
      { screenId: 'admin-coaches', icon: 'sports', label: 'Coaches' },
      { screenId: 'admin-bookings', icon: 'event_available', label: 'Bookings' },
      { screenId: 'admin-games', icon: 'sports_tennis', label: 'Games' },
    ],
  },
  {
    label: 'Moderation',
    icon: 'gavel',
    items: [
      { screenId: 'admin-moderation', icon: 'dashboard', label: 'Overview' },
      { screenId: 'admin-reviews', icon: 'rate_review', label: 'Reviews' },
      { screenId: 'admin-review-reports', icon: 'flag', label: 'Review reports' },
      { screenId: 'admin-post-reports', icon: 'report', label: 'Post reports' },
      { screenId: 'admin-claims', icon: 'assignment_ind', label: 'Venue claims' },
      { screenId: 'admin-venue-approvals', icon: 'fact_check', label: 'Venue approvals' },
      { screenId: 'admin-suggested-edits', icon: 'edit_note', label: 'Suggested edits' },
    ],
  },
  {
    label: 'System',
    icon: 'settings',
    items: [
      { screenId: 'admin-analytics', icon: 'analytics', label: 'Analytics' },
      { screenId: 'admin-settings', icon: 'settings', label: 'Settings' },
      { screenId: 'admin-feature-flags', icon: 'toggle_on', label: 'Feature flags' },
      { screenId: 'admin-roles', icon: 'shield_person', label: 'Roles & permissions' },
    ],
  },
];

/**
 * Mobile/tablet sidebar drawer for the admin console. Slides in from the left
 * over a dark backdrop — giving admins navigation parity with the desktop
 * Sidebar without the phone-style bottom tab bar.
 */
export function AdminDrawer({ open, onClose, onNavigate, activeScreenId = '' }: AdminDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const name = user?.displayName ?? 'Admin';
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(label: string) {
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));
  }

  function handleNav(screenId: ScreenId) {
    onNavigate(screenId);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — taps close the drawer */}
      <div
        className="admin-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside className="admin-drawer" role="dialog" aria-label="Admin navigation">
        {/* Header */}
        <div className="admin-drawer-header">
          <div className="admin-drawer-user">
            <div className="admin-drawer-avatar">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={name} />
                : <span>{getInitials(name)}</span>}
            </div>
            <div className="admin-drawer-name">{name}</div>
          </div>
          <button className="admin-drawer-close" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* Dashboard home */}
        <button
          type="button"
          className={`admin-drawer-home ${activeScreenId === 'admin-hub' ? 'active' : ''}`}
          onClick={() => handleNav('admin-hub')}
          aria-current={activeScreenId === 'admin-hub' ? 'page' : undefined}
        >
          <Icon name="dashboard" size={18} />
          <span>Dashboard</span>
        </button>

        {/* Section tree */}
        <nav className="admin-drawer-nav">
          {ADMIN_SECTIONS.map((section) => {
            const isCollapsed = collapsed[section.label] ?? false;
            return (
              <div key={section.label} className="ad-section">
                <button
                  type="button"
                  className="ad-section-header"
                  onClick={() => toggle(section.label)}
                  aria-expanded={!isCollapsed}
                >
                  <Icon name={section.icon} size={16} />
                  <span className="ad-section-label">{section.label}</span>
                  <Icon
                    name="expand_more"
                    size={16}
                    className={`ad-section-chevron ${isCollapsed ? 'collapsed' : ''}`}
                  />
                </button>
                {!isCollapsed && (
                  <div className="ad-section-items">
                    {section.items.map((item) => {
                      const isActive = activeScreenId === item.screenId;
                      return (
                        <button
                          key={item.screenId}
                          type="button"
                          className={`ad-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNav(item.screenId)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon name={item.icon} size={16} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
