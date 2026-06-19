import { Icon } from '../ui/Icon';
import { NotificationBadge } from '../ui/NotificationBadge';
import type { TabId } from '../../lib/navigation';

interface TabBarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  /** Kept for prop-parity with the desktop Sidebar (which still has the create FAB); the TabBar no longer renders it. */
  onCreate?: () => void;
  canCreate?: boolean;
  isLoggedIn: boolean;
  /** Owners get the v2.1-skinned bar (flat, lime active-dot) with labels that
   *  match the owner screens each tab opens, instead of the player labels. */
  isOwner?: boolean;
}

type Tab = { id: TabId; label: string; icon: string; iconFill?: string };

const tabs: Tab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Games',  icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'clubs',   label: 'Clubs',  icon: 'groups',   iconFill: 'groups_fill' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

// Owner labels track the owner screen each tab opens (App.tsx): home → the
// owner dashboard, games → "Your courts", nearby → "Your venues" ops map.
const ownerTabs: Tab[] = [
  { id: 'home',    label: 'Home',     icon: 'home' },
  { id: 'games',   label: 'Bookings', icon: 'calendar' },
  { id: 'clubs',   label: 'Clubs',    icon: 'groups' },
  { id: 'nearby',  label: 'Venues',   icon: 'map_pin' },
  { id: 'profile', label: 'Profile',  icon: 'user' },
];

export function TabBar({ activeTab, onTabPress, isLoggedIn, isOwner = false }: TabBarProps) {
  const items = isOwner ? ownerTabs : tabs;
  return (
    <nav className={`tabbar${isOwner ? ' tabbar--owner' : ''}`} aria-label="Primary navigation">
      {items.map((t) => {
        const isActive = activeTab === t.id;
        // Guests see the "You" tab as "Login" — tapping it sends them to sign in.
        const label = t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
        // Owner bar follows the v2.1 design: outline icons + colour/dot for the
        // active tab (no filled-icon swap).
        const iconName = !isOwner && isActive ? (t.iconFill ?? t.icon) : t.icon;
        return (
          <button
            key={t.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabPress(t.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="relative inline-flex">
              <Icon name={iconName} size={22} />
              {/* Live unread badge on the "You" tab (notifications live under profile). */}
              {t.id === 'profile' && isLoggedIn && <NotificationBadge className="-top-1.5 -right-2" />}
            </span>
            {label && <span className="label">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
