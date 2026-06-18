import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import type { TabId } from '../../lib/navigation';
import { useAuthStore } from '../../lib/authStore';

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
  { id: 'nearby',  label: 'Nearby', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'clubs',   label: 'Clubs',  icon: 'groups' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

export function Sidebar({ activeTab, onTabPress, onCreate, canCreate, isLoggedIn, onBack, canGoBack, onOpenMessages }: SidebarProps) {
  const currentUser = useAuthStore((s) => s.user);
  const footName = currentUser?.displayName ?? 'Guest';
  const footSub = currentUser
    ? currentUser.skillLevel != null
      ? `DUPR ${currentUser.skillLevel}`
      : currentUser.skillLevelLabel ?? 'Player'
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
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          // Guests see the "You" tab as "Login" — tapping it sends them to sign in.
          const label = t.id === 'profile' && !isLoggedIn ? 'Login' : t.label;
          return (
            <button
              key={t.id}
              className={`side-tab ${isActive ? 'active' : ''}`}
              onClick={() => onTabPress(t.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="ico">
                <Icon name={isActive ? (t.iconFill ?? t.icon) : t.icon} size={20} />
              </span>
              {label}
            </button>
          );
        })}
        {isLoggedIn && onOpenMessages && (
          <button className="side-tab" onClick={onOpenMessages}>
            <span className="ico">
              <Icon name="chat" size={20} />
            </span>
            Messages
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
