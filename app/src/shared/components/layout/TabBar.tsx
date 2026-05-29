import { Icon } from '../ui/Icon';
import type { TabId } from '../../lib/navigation';

interface TabBarProps {
  activeTab: TabId;
  onTabPress: (tab: TabId) => void;
  onCreate: () => void;
  canCreate: boolean;
}

type Tab =
  | { id: TabId; label: string; icon: string; iconFill?: string; isFab?: false }
  | { id: 'fab'; label: ''; icon: 'plus'; isFab: true };

const tabs: Tab[] = [
  { id: 'home',    label: 'Today',  icon: 'home',     iconFill: 'home_fill' },
  { id: 'games',   label: 'Games',  icon: 'calendar', iconFill: 'calendar_fill' },
  { id: 'fab',     label: '',       icon: 'plus',     isFab: true },
  { id: 'nearby',  label: 'Courts', icon: 'map_pin',  iconFill: 'map_pin_fill' },
  { id: 'profile', label: 'You',    icon: 'user',     iconFill: 'user_fill' },
];

export function TabBar({ activeTab, onTabPress, onCreate, canCreate }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Primary navigation">
      {tabs.map((t) => {
        if (t.isFab) {
          return (
            <button
              key="fab"
              className="fab disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCreate}
              disabled={!canCreate}
              aria-label="Create game"
            >
              <Icon name="plus" size={22} />
            </button>
          );
        }
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabPress(t.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={isActive ? (t.iconFill ?? t.icon) : t.icon} size={22} />
            {t.label && <span className="label">{t.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
