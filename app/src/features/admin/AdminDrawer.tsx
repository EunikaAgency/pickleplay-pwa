import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import { getInitials } from '../../shared/lib/initials';
import type { ScreenId } from '../../shared/lib/navigation';
import { isSectionCollapsed, readAdminSectionPrefs, writeAdminSectionPrefs } from '../../shared/lib/adminSectionPrefs';

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNavigate: (screenId: ScreenId) => void;
  activeScreenId?: string;
  onOpenSocial?: () => void;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
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
      { screenId: 'admin-payments', icon: 'payments', label: 'Payments' },
      { screenId: 'admin-partner-subscriptions', icon: 'card_membership', label: 'Partner subscriptions' },
      { screenId: 'admin-email-monitoring', icon: 'mail', label: 'Email monitoring' },
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
export function AdminDrawer({ open, onClose, onOpen, onNavigate, activeScreenId = '', onOpenSocial, onOpenNotifications, onLogout }: AdminDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const name = user?.displayName ?? 'Admin';
  // Sections start collapsed except the one holding the active screen, and an
  // explicit open/close is remembered across reloads — matching (and sharing
  // its stored preference with) the desktop sidebar.
  const [prefs, setPrefs] = useState<Record<string, boolean>>(readAdminSectionPrefs);

  function toggle(label: string, isCollapsed: boolean) {
    setPrefs((p) => {
      const next = { ...p, [label]: !isCollapsed };
      writeAdminSectionPrefs(next);
      return next;
    });
  }

  function handleNav(screenId: ScreenId) {
    onNavigate(screenId);
    onClose();
  }

  if (!open) {
    // Floating hamburger trigger — shown on admin screens that don't use
    // V2Shell (which has its own hamburger in V2TopNav). Positioned below
    // the sticky ScreenHeader back button so it never overlaps it.
    return (
      <button
        className="admin-drawer-fab"
        onClick={onOpen}
        aria-label="Open admin menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
    );
  }

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

        {/* Social — matches the desktop sidebar's Social tab */}
        {onOpenSocial && (
          <button
            type="button"
            className={`admin-drawer-home ${activeScreenId === 'social' ? 'active' : ''}`}
            onClick={() => { onOpenSocial(); onClose(); }}
            aria-current={activeScreenId === 'social' ? 'page' : undefined}
          >
            <Icon name="groups" size={18} />
            <span>Social</span>
          </button>
        )}

        {/* Notifications — matches the desktop sidebar's Notifications button */}
        {onOpenNotifications && (
          <button
            type="button"
            className={`admin-drawer-home ${activeScreenId === 'notifications' ? 'active' : ''}`}
            onClick={() => { onOpenNotifications(); onClose(); }}
            aria-current={activeScreenId === 'notifications' ? 'page' : undefined}
          >
            <Icon name="notifications" size={18} />
            <span>Notifications</span>
          </button>
        )}

        {/* Logout — matches the desktop sidebar's footer logout */}
        {onLogout && (
          <button
            type="button"
            className="admin-drawer-home"
            onClick={onLogout}
          >
            <Icon name="logout" size={18} />
            <span>Log out</span>
          </button>
        )}

        {/* Section tree */}
        <nav className="admin-drawer-nav">
          {ADMIN_SECTIONS.map((section) => {
            const holdsActive = section.items.some((item) => item.screenId === activeScreenId);
            const isCollapsed = isSectionCollapsed(prefs, section.label, holdsActive);
            return (
              <div key={section.label} className="ad-section">
                <button
                  type="button"
                  className="ad-section-header"
                  onClick={() => toggle(section.label, isCollapsed)}
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
