import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import type { TabId } from '../../lib/navigation';

interface SidebarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  canCreate: boolean;
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
  { id: 'nearby',  label: 'Courts', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'clubs',   label: 'Clubs',  icon: 'groups' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

export function Sidebar({ activeTab, onTabPress, onCreate, canCreate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Icon name="paddle" size={20} />
        </span>
        <span className="brand-name">PickleBallers</span>
      </div>

      <nav className="flex flex-col gap-1">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
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
              {t.label}
            </button>
          );
        })}
      </nav>

      <button className="side-create disabled:cursor-not-allowed disabled:opacity-50" onClick={onCreate} disabled={!canCreate}>
        <Icon name="plus" size={18} /> Create game
      </button>

      <div className="sidebar-spacer" />

      <div className="sidebar-foot">
        <Avatar name="Riley Pickler" size={36} />
        <div className="meta">
          <div className="name">Riley Pickler</div>
          <div className="sub">DUPR 3.5 · Austin</div>
        </div>
      </div>
    </aside>
  );
}
