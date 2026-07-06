import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import type { TabId } from '../../lib/navigation';
import { useAuthStore } from '../../lib/authStore';
import { useMessageStore } from '../../lib/messageStore';
import { userHasPermission, type AppUser } from '../../lib/permissions';

/** Human label for a signed-in user's role, used as the sidebar footer subtitle. */
function roleLabel(user: AppUser): string {
  if (userHasPermission(user, 'admin.access')) return 'Admin';
  if (userHasPermission(user, 'owner.access')) return 'Owner';
  if (userHasPermission(user, 'organizer.access')) return 'Organizer';
  if (userHasPermission(user, 'coach.access')) return 'Coach';
  return 'Player';
}

interface SidebarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  canCreate: boolean;
  isLoggedIn: boolean;
  /** Pop one step off the navigation history (universal back). */
  onBack: () => void;
  /** Whether there's a previous screen to return to. */
  canGoBack: boolean;
  /** Open the direct-messages screen (shown only when signed in). */
  onOpenMessages?: () => void;
  /** Open the standalone owner pricing screen. */
  onOpenPricing?: () => void;
  /** Whether the standalone owner pricing screen is active. */
  pricingActive?: boolean;
  /** The Tournament tab is a player surface — owners/admins don't get it. */
  showTournaments?: boolean;
  /** Owners get owner-specific labels (Profile instead of You, Venues instead of Nearby, etc.). */
  isOwner?: boolean;
  /** Organizers get organizer-specific labels (Organize instead of Today, etc.). */
  isOrganizer?: boolean;
}

interface SideTab {
  id: TabId;
  label: string;
  icon: string;
  iconFill?: string;
}

const tabs: SideTab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Games',  icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'clubs',   label: 'Clubs',  icon: 'groups' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

// Owner labels track the owner screen each tab opens (App.tsx): home → the
// owner dashboard, games → "Bookings", nearby → "Venues" ops map.
const ownerTabs: SideTab[] = [
  { id: 'home',    label: 'Home',     icon: 'home' },
  { id: 'games',   label: 'Bookings', icon: 'calendar' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'nearby',  label: 'Venues',   icon: 'map_pin' },
  { id: 'clubs',   label: 'Clubs',    icon: 'groups' },
  { id: 'profile', label: 'Profile',  icon: 'user' },
];

// Organizer tabs — the organizer console home lives on the "Organize" tab.
const organizerTabs: SideTab[] = [
  { id: 'home',    label: 'Organize', icon: 'trophy' },
  { id: 'games',   label: 'Games',    icon: 'calendar' },
  { id: 'nearby',  label: 'Nearby',   icon: 'map_pin' },
  { id: 'clubs',   label: 'Clubs',    icon: 'groups' },
  { id: 'profile', label: 'Profile',  icon: 'user' },
];

export function Sidebar({ activeTab, onTabPress, onCreate, canCreate, isLoggedIn, onBack, canGoBack, onOpenMessages, onOpenPricing, pricingActive = false, showTournaments = true, isOwner = false, isOrganizer = false }: SidebarProps) {
  const currentUser = useAuthStore((s) => s.user);
  const unreadMessages = useMessageStore((s) => s.unread);
  const roleTabs = isOwner ? ownerTabs : isOrganizer ? organizerTabs : tabs;
  const visibleTabs = roleTabs.filter((t) => t.id !== 'tournaments' || showTournaments);
  const showOwnerPricing = userHasPermission(currentUser, 'owner.access') && onOpenPricing;
  const footName = currentUser?.displayName ?? 'Guest';
  const footSub = currentUser
    ? currentUser.skillLevel != null
      ? `DUPR ${currentUser.skillLevel}`
      : currentUser.skillLevelLabel ?? roleLabel(currentUser)
    : 'Browsing as guest';
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Icon name="paddle" size={20} />
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
          const isActive = activeTab === t.id && !(t.id === 'nearby' && pricingActive);
          // Guests see the "You" tab as "Login" - tapping it sends them to sign in.
          const label = t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
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
            </div>
          );
        })}
        {isLoggedIn && onOpenMessages && (
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
      </nav>

      <button className="side-create disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreate} disabled={!canCreate}>
        <Icon name="plus" size={18} /> Create game
      </button>

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <Avatar src={currentUser?.avatarUrl} name={footName} size={36} />
        <div className="meta">
          <div className="name">{footName}</div>
          <div className="sub">{footSub}</div>
        </div>
      </div>
    </aside>
  );
}
