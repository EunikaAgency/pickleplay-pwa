import { Icon } from '../ui/Icon';

interface SidebarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onCreate: () => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'nearby', label: 'Nearby', icon: 'location_on' },
  { id: 'games', label: 'Games', icon: 'sports_tennis' },
  { id: 'clubs', label: 'Clubs', icon: 'group' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export function Sidebar({ activeTab, onTabPress, onCreate }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex md:w-60 lg:w-72 shrink-0 flex-col border-r border-outline-variant/40 bg-surface-container-lowest p-5"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2 px-2">
        <Icon name="sports_tennis" size={28} filled className="text-primary" />
        <span className="font-heading text-headline-md font-bold text-primary">PickleBallers</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {tabs.map(({ id, label, icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabPress(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-md font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                ${isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Icon name={icon} size={22} filled={isActive} weight={isActive ? 600 : 400} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Create CTA */}
      <button
        onClick={onCreate}
        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 font-heading text-body-md font-bold text-on-primary transition active:scale-95 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ boxShadow: 'var(--shadow-fab)' }}
      >
        <Icon name="add" size={20} weight={600} />
        <span>New game</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer tagline */}
      <div className="px-2 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant/70">
        Find games. Meet players.
      </div>
    </aside>
  );
}
