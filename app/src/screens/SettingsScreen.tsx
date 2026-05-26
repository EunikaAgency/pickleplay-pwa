import { Icon } from '../components/ui/Icon';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const settingsSections = [
  {
    title: 'Account',
    items: [
      { id: 'edit-profile', label: 'Edit Profile', icon: 'account_circle' },
      { id: 'notifications', label: 'Notification Preferences', icon: 'notifications' },
      { id: 'privacy', label: 'Privacy & Security', icon: 'security' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'help', label: 'Help & Support', icon: 'help' },
      { id: 'about', label: 'About PickleBaller', icon: 'info' },
    ],
  },
];

export function SettingsScreen({ onLogout, onNavigate }: SettingsScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 pb-28 space-y-6">

          {settingsSections.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-headline-md text-on-surface mb-2">{section.title}</h2>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-[12px] cursor-pointer active:scale-[0.98] transition-transform group"
                    style={cardShadow}
                    onClick={() => onNavigate(item.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Icon name={item.icon} size={20} />
                      </div>
                      <span className="text-body-md font-semibold">{item.label}</span>
                    </div>
                    <Icon name="chevron_right" size={20} className="text-outline group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-4 mt-6 text-error font-bold hover:opacity-80 transition-opacity active:scale-95"
          >
            <Icon name="logout" size={24} />
            <span className="text-body-lg font-bold">Sign Out</span>
          </button>

        </main>
      </div>
    </div>
  );
}
