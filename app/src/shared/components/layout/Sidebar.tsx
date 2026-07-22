import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import type { TabId } from '../../lib/navigation';
import { useAuthStore } from '../../lib/authStore';
import { useMessageStore } from '../../lib/messageStore';
import { useNotificationStore } from '../../lib/notificationStore';
import { userHasPermission } from '../../lib/permissions';
import { ROLE_META, displayRole } from '../../lib/roleDisplay';

interface SidebarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  canCreate: boolean;
  /** Whether to render the "Create game" CTA at all. Staff are a work account —
   *  they run the owner's courts, they don't host games from the console. */
  showCreate?: boolean;
  isLoggedIn: boolean;
  /** Pop one step off the navigation history (universal back). */
  onBack: () => void;
  /** Whether there's a previous screen to return to. */
  canGoBack: boolean;
  /** Open the direct-messages screen (shown only when signed in). */
  onOpenMessages?: () => void;
  /** Open the standalone owner calendar screen. */
  onOpenCalendar?: () => void;
  /** Whether the standalone owner calendar screen is active. */
  calendarActive?: boolean;
  /** Open the standalone owner pricing screen. */
  onOpenPricing?: () => void;
  /** Whether the standalone owner pricing screen is active. */
  pricingActive?: boolean;
  /** Open the manual-reservation screen (record a phone / walk-in booking). */
  onOpenManualReservation?: () => void;
  /** Whether the manual-reservation screen is active. */
  manualReservationActive?: boolean;
  /** Open the standalone owner partners screen. */
  onOpenPartners?: () => void;
  /** Whether the standalone owner partners screen is active. */
  partnersActive?: boolean;
  /** Open the rental inventory (Shop) screen. */
  onOpenShop?: () => void;
  /** Whether the shop screen is active. */
  shopActive?: boolean;
  /** The Tournament tab is a player surface — owners/admins don't get it. */
  showTournaments?: boolean;
  /** Whether the Social (Clubs + Friends) tab is offered. Hidden from staff —
   *  a delegated work account runs the owner's courts, it doesn't socialise. */
  showSocial?: boolean;
  /** Owners get owner-specific labels (Venues instead of Nearby, Bookings instead of Games, etc.). */
  isOwner?: boolean;
  /** Organizers get organizer-specific labels (Organize instead of Today, etc.). */
  isOrganizer?: boolean;
  /** Admins aren't venue owners — they don't manage venues/pricing/reservations/
   *  calendar/partners/shop, so those owner-console items are hidden for them. */
  isAdmin?: boolean;
  /** Whether the admin console screen is active (any admin screen). */
  adminActive?: boolean;
  /** Navigate to any admin screen by ScreenId — used by the collapsible admin sections. */
  onAdminNavigate?: (screenId: string) => void;
  /** The currently active admin screen id (for active-state highlighting). */
  adminScreenId?: string;
  /** Open the notifications screen. */
  onOpenNotifications?: () => void;
  /** Whether the notifications screen is active. */
  notificationsActive?: boolean;
  /** Sign out. */
  onLogout?: () => void;
}

interface SideTab {
  id: TabId;
  label: string;
  icon: string;
  iconFill?: string;
}

const tabs: SideTab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Play',   icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'social',  label: 'Social', icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

// Owner labels track the owner screen each tab opens (App.tsx): home → the
// owner dashboard, games → "Bookings", nearby → "Venues" ops map.
const ownerTabs: SideTab[] = [
  { id: 'home',    label: 'Home',     icon: 'home' },
  { id: 'booking', label: 'Bookings', icon: 'calendar' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Venues',   icon: 'map_pin' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

// Organizer tabs — the organizer console home lives on the "Organize" tab.
const organizerTabs: SideTab[] = [
  { id: 'home',    label: 'Organize', icon: 'trophy' },
  { id: 'games',   label: 'Games',    icon: 'calendar' },
  { id: 'nearby',  label: 'Nearby',   icon: 'map_pin' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  // Profile is rendered last for every role (see the pinned button below the nav list).
];

type AdminSection = {
  label: string;
  icon: string;
  items: { screenId: string; icon: string; label: string }[];
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

/** The collapsible admin section tree rendered inside the sidebar nav (desktop only). */
function AdminSections({ onNavigate, activeScreenId }: { onNavigate: (screenId: string) => void; activeScreenId: string }) {
  // All sections start expanded so everything is visible by default.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(label: string) {
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));
  }

  return (
    <>
      {ADMIN_SECTIONS.map((section) => {
        const isCollapsed = collapsed[section.label] ?? false;
        return (
          <div key={section.label} className="admin-section">
            <button
              type="button"
              className="admin-section-header"
              onClick={() => toggle(section.label)}
              aria-expanded={!isCollapsed}
            >
              <span className="admin-section-icon">
                <Icon name={section.icon} size={16} />
              </span>
              <span className="admin-section-label">{section.label}</span>
              <Icon name="expand_more" size={16} className={`admin-section-chevron ${isCollapsed ? 'collapsed' : ''}`} />
            </button>
            {!isCollapsed && (
              <div className="admin-section-items">
                {section.items.map((item) => {
                  const isActive = activeScreenId === item.screenId;
                  return (
                    <button
                      key={item.screenId}
                      type="button"
                      className={`admin-item ${isActive ? 'active' : ''}`}
                      onClick={() => onNavigate(item.screenId)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="admin-item-icon">
                        <Icon name={item.icon} size={16} />
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar({ activeTab, onTabPress, onCreate, canCreate, showCreate = true, isLoggedIn, onBack, canGoBack, onOpenMessages, onOpenCalendar, calendarActive = false, onOpenPricing, pricingActive = false, onOpenManualReservation, manualReservationActive = false, onOpenPartners, partnersActive = false, onOpenShop, shopActive = false, showTournaments = true, showSocial = true, isOwner = false, isOrganizer = false, isAdmin = false, adminActive = false, onAdminNavigate, adminScreenId, onOpenNotifications, notificationsActive = false, onLogout }: SidebarProps) {
  const currentUser = useAuthStore((s) => s.user);
  const unreadMessages = useMessageStore((s) => s.unread);
  const unreadNotifs = useNotificationStore((s) => s.unread);
  const roleTabs = isOwner ? ownerTabs : isOrganizer ? organizerTabs : tabs;
  const visibleTabs = roleTabs
    .filter((t) => t.id !== 'tournaments' || showTournaments)
    .filter((t) => t.id !== 'social' || showSocial)
    // Admins don't run venues, so drop the owner "Venues" (nearby) tab — which
    // also carries the Calendar/Pricing/Reservation/Partners owner sub-items.
    // They also don't need Play or Profile — the admin console covers everything.
    .filter((t) => t.id !== 'nearby' || !isAdmin)
    .filter((t) => t.id !== 'games' || !isAdmin);
  const showOwnerCalendar = userHasPermission(currentUser, 'owner.access') && onOpenCalendar;
  const showOwnerPricing = userHasPermission(currentUser, 'owner.pricing.manage') && onOpenPricing;
  const showOwnerManualReservation = userHasPermission(currentUser, 'owner.bookings.manage') && onOpenManualReservation;
  const showOwnerPartners = userHasPermission(currentUser, 'owner.access') && onOpenPartners;
  const footName = currentUser?.displayName ?? 'Guest';
  // Staff aren't players, so show their role ("Staff") under the name rather
  // than a DUPR rating (which they may still carry on the account).
  const isStaff = currentUser?.roleDefault === 'staff';
  const footSub = !currentUser
    ? 'Browsing as guest'
    : isStaff
      ? ROLE_META[displayRole(currentUser)].label
      : currentUser.skillLevel != null
        ? `DUPR ${currentUser.skillLevel}`
        : currentUser.skillLevelLabel ?? ROLE_META[displayRole(currentUser)].label;
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <img src="/brand-icon.png" alt="" />
        </span>
        <span className="brand-name">PickleBallers</span>
      </div>

      <button
        className="side-tab mb-2 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back to the previous screen"
      >
        <span className="ico">
          <Icon name="chevron" size={20} className="rotate-180" />
        </span>
        Back
      </button>

      <nav className="flex flex-col gap-1">
        {visibleTabs.map((t) => {
          const isActive = activeTab === t.id && !(t.id === 'nearby' && pricingActive) && !(t.id === 'nearby' && manualReservationActive) && !(t.id === 'nearby' && calendarActive) && !(t.id === 'nearby' && partnersActive);
          // Guests see the "Profile" tab as "Login" - tapping it sends them to sign in.
          // Admins get "Overview" instead of "Today" — their home is the admin console.
          const label = t.id === 'home' && isAdmin ? 'Overview' : t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
          return (
            <div key={t.id} className="contents">
              <button
                className={`side-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabPress(t.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="ico">
                  <Icon name={(!isOwner && !isOrganizer) && isActive ? (t.iconFill ?? t.icon) : t.icon} size={20} />
                </span>
                {label}
              </button>
              {t.id === 'nearby' && showOwnerCalendar && (
                <button
                  className={'side-tab ' + (calendarActive ? 'active' : '')}
                  onClick={onOpenCalendar}
                  aria-current={calendarActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="calendar" size={20} />
                  </span>
                  Calendar
                </button>
              )}
              {t.id === 'nearby' && showOwnerPricing && (
                <button
                  className={`side-tab ${pricingActive ? 'active' : ''}`}
                  onClick={onOpenPricing}
                  aria-current={pricingActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="bolt" size={20} />
                  </span>
                  Pricing
                </button>
              )}
              {t.id === 'nearby' && showOwnerManualReservation && (
                <button
                  className={`side-tab ${manualReservationActive ? 'active' : ''}`}
                  onClick={onOpenManualReservation}
                  aria-current={manualReservationActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="add" size={20} />
                  </span>
                  Reservation
                </button>
              )}
              {t.id === 'nearby' && showOwnerPartners && (
                <button
                  className={`side-tab ${partnersActive ? 'active' : ''}`}
                  onClick={onOpenPartners}
                  aria-current={partnersActive ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon name="groups" size={20} />
                  </span>
                  Partners
                </button>
              )}
            </div>
          );
        })}
        {/* Messages — hidden for admins (they use the admin console, not DMs). */}
        {isLoggedIn && onOpenMessages && !isAdmin && (
          <button className={`side-tab ${activeTab === 'messages' ? 'active' : ''}`} onClick={onOpenMessages} aria-current={activeTab === 'messages' ? 'page' : undefined}>
            <span className="ico">
              <Icon name="chat" size={20} />
            </span>
            Messages
            {unreadMessages > 0 && (
              <span className="side-tab-badge" aria-label={`${unreadMessages} unread messages`}>
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>
        )}
        {/* Notifications — shown for all logged-in users (replaces the Profile tab
            for admins, who get it here instead). */}
        {isLoggedIn && onOpenNotifications && (
          <button
            className={`side-tab ${notificationsActive ? 'active' : ''}`}
            onClick={onOpenNotifications}
            aria-current={notificationsActive ? 'page' : undefined}
          >
            <span className="ico">
              <Icon name="notifications" size={20} />
            </span>
            Notifications
            {unreadNotifs > 0 && (
              <span className="side-tab-badge" aria-label={`${unreadNotifs} unread notifications`}>
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
        )}
        {/* Shop — owner only (admins don't run rental inventory) */}
        {isOwner && !isAdmin && onOpenShop && (
          <button
            className={`side-tab ${shopActive ? 'active' : ''}`}
            onClick={onOpenShop}
            aria-current={shopActive ? 'page' : undefined}
          >
            <span className="ico">
              <Icon name="storefront" size={20} />
            </span>
            Shop/Rental
          </button>
        )}
        {/* ── Admin console — collapsible sections with header labels ── */}
        {isAdmin && onAdminNavigate && <AdminSections onNavigate={onAdminNavigate} activeScreenId={adminScreenId ?? ''} />}
        {/* Profile — non-admins get the tab; admins reach everything from the
            sidebar sections above. */}
        {!isAdmin && (
          <button
            className={`side-tab ${activeTab === 'profile' && !shopActive ? 'active' : ''}`}
            onClick={() => onTabPress('profile')}
            aria-current={activeTab === 'profile' && !shopActive ? 'page' : undefined}
          >
            <span className="ico">
              <Icon name={(!isOwner && !isOrganizer) && activeTab === 'profile' && !shopActive ? 'user_fill' : 'user'} size={20} />
            </span>
            {isLoggedIn ? 'Profile' : 'Login'}
          </button>
        )}
      </nav>

      {showCreate && (
        <button className="side-create disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreate} disabled={!canCreate}>
          <Icon name="plus" size={18} /> Create game
        </button>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <Avatar src={currentUser?.avatarUrl} name={footName} size={36} />
        <div className="meta">
          <div className="name">{footName}</div>
          <div className="sub">{footSub}</div>
        </div>
        {isAdmin && onLogout && (
          <button type="button" onClick={onLogout} className="admin-item-icon" title="Sign out" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
            <Icon name="logout" size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
