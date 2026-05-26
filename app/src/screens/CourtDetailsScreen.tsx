import { Icon } from '../components/ui/Icon';

interface CourtDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  courtId?: string;
}

export function CourtDetailsScreen({ onNavigate }: CourtDetailsScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        {/* Hero Image */}
        <div className="relative h-56 md:h-72">
          <img
            alt="Court"
            className="h-full w-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsL986uwrjRnAFPLVZTE71SgRlgtERnWB_O-_u-mg4qaddBohUzg2f9di6EjSOELb6gOdw5hpL_oiC_o8ZrPChGext6DF4-_g10CoLCaIMBtZ1oDYsDm-Q89VmI4GCI4qum9HaYOx0PQN98F1AJfvJh0jZUfJpE5qf_wdLWBpxpdg4Q0O9J_lQlCGuXKu6RCm-me0mSj6T7miyRvXid9yuUZHJgdgUeLXoT18Lf6wzh6Z3ZM0VQGmIKAHPEmkQ69DWo8kMreU1"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-4 left-5">
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-white">Austin Smash Center</h1>
            <p className="text-white/80 text-body-md flex items-center gap-1">
              <Icon name="location_on" size={16} />
              1200 Willow St, Austin, TX
            </p>
          </div>
          <button className="absolute top-4 right-4 rounded-full bg-surface-container-lowest p-2 text-error shadow-md transition-all active:scale-90">
            <Icon name="favorite" size={20} filled />
          </button>
        </div>

        <main className="mx-auto max-w-7xl px-5 pt-6 space-y-6">
          {/* Quick Info Chips */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-4 py-1.5 font-bold text-label-sm">Indoor</span>
            <span className="rounded-full bg-secondary-container text-on-secondary-container px-4 py-1.5 font-bold text-label-sm">6 Courts</span>
            <span className="rounded-full bg-surface-container-high text-on-surface-variant px-4 py-1.5 font-bold text-label-sm">Public Access</span>
            <span className="rounded-full bg-surface-container-high text-on-surface-variant px-4 py-1.5 font-bold text-label-sm">Concrete Surface</span>
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-3 gap-3">
            <button className="flex flex-col items-center gap-1 bg-surface-container-lowest rounded-[12px] p-4 active:scale-95 transition-transform" style={cardShadow} onClick={() => window.open('https://maps.google.com', '_blank')}>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="directions" size={24} />
              </div>
              <span className="font-bold text-label-sm">Directions</span>
            </button>
            <button className="flex flex-col items-center gap-1 bg-surface-container-lowest rounded-[12px] p-4 active:scale-95 transition-transform" style={cardShadow} onClick={() => onNavigate('games')}>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="calendar_today" size={24} />
              </div>
              <span className="font-bold text-label-sm">Schedule</span>
            </button>
            <button className="flex flex-col items-center gap-1 bg-surface-container-lowest rounded-[12px] p-4 active:scale-95 transition-transform" style={cardShadow}>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="chat" size={24} />
              </div>
              <span className="font-bold text-label-sm">Chat</span>
            </button>
          </div>

          {/* Amenities */}
          <section>
            <h2 className="font-heading text-headline-md text-on-surface mb-3">Amenities</h2>
            <div className="grid grid-cols-2 gap-2">
              {['Restrooms', 'Pro Shop', 'Coffee Bar', 'Lighted Courts', 'Water Fountain', 'Seating'].map((amenity) => (
                <div key={amenity} className="flex items-center gap-2 bg-surface-container-lowest rounded-[12px] p-3" style={cardShadow}>
                  <Icon name="check_circle" size={18} filled className="text-secondary" />
                  <span className="text-body-md text-on-surface">{amenity}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Upcoming Games at this Court */}
          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="font-heading text-headline-md text-on-surface">Games This Week</h2>
              <button className="font-bold text-primary text-label-sm hover:underline" onClick={() => onNavigate('games')}>See All</button>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Morning Doubles Mixer', date: 'Tomorrow, 9:00 AM', spots: '4 spots left' },
                { title: 'Saturday Mix-In', date: 'Sat, 9:00 AM', spots: '8 spots left' },
                { title: 'Beginner Clinic', date: 'Sun, 2:00 PM', spots: '2 spots left' },
              ].map((game) => (
                <div
                  key={game.title}
                  className="flex items-center justify-between bg-surface-container-lowest rounded-[12px] p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  style={cardShadow}
                  onClick={() => onNavigate('game-details', { id: '1' })}
                >
                  <div>
                    <h3 className="font-heading text-body-lg font-semibold">{game.title}</h3>
                    <p className="text-body-md text-on-surface-variant">{game.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-label-sm font-bold text-secondary">{game.spots}</span>
                    <Icon name="chevron_right" size={20} className="text-outline" />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
