import { Icon } from '../components/ui/Icon';

interface ProfileScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onLogout: () => void;
}

const settingsItems = [
  { id: 'edit-profile', icon: 'account_circle', title: 'Account Settings', description: 'Manage your profile & info' },
  { id: 'settings', icon: 'security', title: 'Privacy & Security', description: 'Control your court visibility' },
  { id: 'settings', icon: 'help', title: 'Help & Support', description: 'Rules and platform guides' },
];

export function ProfileScreen({ onNavigate, onLogout }: ProfileScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-7xl px-5 pt-8">

          {/* Hero Profile Section */}
          <section className="flex flex-col items-center mb-10 text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-surface-container-lowest" style={cardShadow}>
                <img
                  alt="Profile"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC11Czoun2_lIi5sXUquwWrSH9zQHexFqKo-X4CDjUV4W0TL7Ht5NjTuHGxtUiIqAsPIlsUb6NFVrceAQUSshEaH2IvKc_VsIiCR3LjB3A1DBte9odfpGMbbh_Uts7mH-Cxzz2Xzpqx3BxZ7-TABXizUiXu13rRrLReBp2MpFNulK6pmDY5PFVwtMF3Bi904yH8k5L1bA7mpL9m42zbY-I9vMb3NYQo2KN7JxG9_ja4VPZJ1D0cBRvZLqConIzBzpJMdRFigaCD"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-secondary-container text-on-secondary-container px-4 py-1 rounded-full font-bold text-label-sm shadow-sm">
                3.5 DUPR
              </div>
            </div>
            <h2 className="font-heading text-headline-lg-mobile md:text-headline-lg mb-1">Riley Pickler</h2>
            <p className="text-on-surface-variant text-body-md italic mb-4">"The dink master."</p>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
              <div className="bg-surface-container-lowest rounded-[8px] p-4 flex flex-col items-center" style={cardShadow}>
                <span className="text-on-surface-variant font-bold text-label-sm uppercase tracking-wider mb-1">Games</span>
                <span className="font-heading text-headline-md text-primary">124</span>
              </div>
              <div className="bg-surface-container-lowest rounded-[8px] p-4 flex flex-col items-center" style={cardShadow}>
                <span className="text-on-surface-variant font-bold text-label-sm uppercase tracking-wider mb-1">Wins</span>
                <span className="font-heading text-headline-md text-secondary">82</span>
              </div>
              <div className="bg-surface-container-lowest rounded-[8px] p-4 flex flex-col items-center" style={cardShadow}>
                <span className="text-on-surface-variant font-bold text-label-sm uppercase tracking-wider mb-1">Losses</span>
                <span className="font-heading text-headline-md text-tertiary">42</span>
              </div>
            </div>
          </section>

          {/* Win Rate Progress Section */}
          <section className="bg-surface-container-lowest rounded-[16px] p-5 mb-8 max-w-2xl mx-auto" style={cardShadow}>
            <div className="flex justify-between items-end mb-3">
              <div>
                <h3 className="font-heading text-headline-md">Win Rate</h3>
                <p className="text-on-surface-variant text-body-md">You're crushing the courts!</p>
              </div>
              <span className="font-heading text-headline-lg-mobile text-secondary">66%</span>
            </div>
            <div className="w-full h-4 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-secondary-fixed rounded-full transition-all duration-1000 ease-out" style={{ width: '66%' }} />
            </div>
          </section>

          {/* Settings List */}
          <section className="max-w-2xl mx-auto space-y-3">
            {settingsItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-[16px] hover:bg-surface-container-high transition-colors cursor-pointer group"
                style={cardShadow}
                onClick={() => onNavigate(item.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center text-primary">
                    <Icon name={item.icon} size={28} />
                  </div>
                  <div>
                    <h4 className="text-body-lg font-bold">{item.title}</h4>
                    <p className="font-bold text-label-sm text-on-surface-variant">{item.description}</p>
                  </div>
                </div>
                <Icon name="chevron_right" size={24} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
              </div>
            ))}

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-4 mt-6 text-error font-bold hover:opacity-80 transition-opacity active:scale-95 transition-transform"
            >
              <Icon name="logout" size={24} />
              <span className="text-body-lg font-bold">Sign Out</span>
            </button>
          </section>

        </main>
      </div>
    </div>
  );
}
