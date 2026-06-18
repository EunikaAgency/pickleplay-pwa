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
}

type Tab = { id: TabId; label: string; icon: string; iconFill?: string };

const tabs: Tab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Games',  icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'clubs',   label: 'Clubs',  icon: 'groups',   iconFill: 'groups_fill' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

export function TabBar({ activeTab, onTabPress, isLoggedIn }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Primary navigation">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        // Guests see the "You" tab as "Login" — tapping it sends them to sign in.
        const label = t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
        return (
          <button
            key={t.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabPress(t.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="relative inline-flex">
              <Icon name={isActive ? (t.iconFill ?? t.icon) : t.icon} size={22} />
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
