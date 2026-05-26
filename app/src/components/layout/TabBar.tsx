import { Icon } from '../ui/Icon';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'nearby', label: 'Nearby', icon: 'location_on' },
  { id: 'games', label: 'Games', icon: 'sports_tennis' },
  { id: 'clubs', label: 'Clubs', icon: 'group' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export function TabBar({ activeTab, onTabPress }: TabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around bg-surface-container-lowest px-2 pb-4 pt-2 rounded-t-[24px]"
      style={{ boxShadow: '0 -4px 20px -4px rgba(0, 64, 224, 0.1)' }}
    >
      {tabs.map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabPress(id)}
            className={`flex flex-col items-center justify-center px-4 py-1 rounded-full transition-all duration-200 active:scale-90
              ${isActive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
          >
            <Icon name={icon} size={22} filled={isActive} weight={isActive ? 600 : 400} />
            <span className="text-label-sm mt-0.5">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
