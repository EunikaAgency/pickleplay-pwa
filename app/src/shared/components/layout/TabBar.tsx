import { Icon } from '../ui/Icon';
import type { TabId } from '../../lib/navigation';
import { useMessageStore } from '../../lib/messageStore';

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
  /** Organizers get organizer-specific labels (Organize instead of Today, etc.). */
  isOrganizer?: boolean;
  /** The Tournament tab is a player surface — owners/admins don't get it. */
  showTournaments?: boolean;
  /** Whether the Social (Clubs + Friends) tab is offered. Hidden from staff —
   *  a delegated work account runs the owner's courts, it doesn't socialise. */
  showSocial?: boolean;
  /** Admins aren't venue owners — the owner "Venues" (nearby) tab is hidden. */
  isAdmin?: boolean;
}

type Tab = { id: TabId; label: string; icon: string; iconFill?: string };

const tabs: Tab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Play',   icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'social',  label: 'Social', icon: 'groups',   iconFill: 'groups_fill' },
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'profile', label: 'Profile', icon: 'user',     iconFill: 'user_fill' },
];

// Owner labels track the owner screen each tab opens (App.tsx): home → the
// owner dashboard, games → "Your courts", nearby → "Your venues" ops map.
const ownerTabs: Tab[] = [
  { id: 'home',    label: 'Home',     icon: 'home' },
  { id: 'booking', label: 'Bookings', icon: 'calendar' },
  { id: 'tournaments', label: 'Tournament', icon: 'trophy' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  { id: 'nearby',  label: 'Venues',   icon: 'map_pin' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'profile', label: 'Profile',  icon: 'user' },
];

// Organizer tabs — home opens the organizer hub ("Organize").
const organizerTabs: Tab[] = [
  { id: 'home',    label: 'Organize', icon: 'trophy' },
  { id: 'games',   label: 'Games',    icon: 'calendar' },
  { id: 'nearby',  label: 'Nearby',   icon: 'map_pin' },
  { id: 'social',  label: 'Social',   icon: 'groups' },
  { id: 'profile', label: 'Profile',  icon: 'user' },
];

export function TabBar({ activeTab, onTabPress, isLoggedIn, isOwner = false, isOrganizer = false, showTournaments = true, showSocial = true, isAdmin = false }: TabBarProps) {
  const roleTabs = isOwner ? ownerTabs : isOrganizer ? organizerTabs : tabs;
  const items = roleTabs
    .filter((t) => t.id !== 'tournaments' || showTournaments)
    .filter((t) => t.id !== 'social' || showSocial)
    // Admins don't run venues — drop the owner "Venues" (nearby) tab. They also
    // don't need Play or Profile — the admin console covers everything.
    .filter((t) => t.id !== 'nearby' || !isAdmin)
    .filter((t) => t.id !== 'games' || !isAdmin)
    .filter((t) => t.id !== 'profile' || !isAdmin);
  const unreadMessages = useMessageStore((s) => s.unread);
  return (
    <nav className={`tabbar${isOwner || isOrganizer ? ' tabbar--owner' : ''}`} aria-label="Primary navigation">
      {items.map((t) => {
        const isActive = activeTab === t.id;
        // Guests see the "Profile" and "Messages" tabs as "Login" — tapping sends them to sign in.
        const label = (t.id === 'profile' || t.id === 'messages') && !isLoggedIn ? 'Login' : t.label;
        // Owner bar follows the v2.1 design: outline icons + colour/dot for the
        // active tab (no filled-icon swap).
        const iconName = (!isOwner && !isOrganizer) && isActive ? (t.iconFill ?? t.icon) : t.icon;
        return (
          <button
            key={t.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabPress(t.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* The unread-notification badge lives on the header bell (see the
             *  owner home/profile bells), matching the player chrome — not on
             *  this tab. */}
            <span className="tab-icon-wrap">
              <Icon name={iconName} size={22} />
              {t.id === 'messages' && unreadMessages > 0 && (
                <span className="tab-unread-badge" aria-label={`${unreadMessages} unread messages`}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </span>
            {label && <span className="label">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
