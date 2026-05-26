import { Icon } from '../components/ui/Icon';

interface GameFiltersScreenProps {
  onBack: () => void;
}

export function GameFiltersScreen({ onBack }: GameFiltersScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">

          <div className="flex items-center justify-between">
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Filter Games</h1>
            <button className="text-primary font-bold text-label-sm hover:underline">Reset</button>
          </div>

          {/* Skill Level */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Skill Level</h3>
            <div className="flex flex-wrap gap-2">
              {['All', 'Beginner', 'Intermediate', 'Advanced'].map((skill) => (
                <button key={skill} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${skill === 'All' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {skill}
                </button>
              ))}
            </div>
          </section>

          {/* Game Type */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Game Type</h3>
            <div className="flex flex-wrap gap-2">
              {['All', 'Singles', 'Doubles', 'Open Play'].map((type) => (
                <button key={type} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${type === 'All' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {type}
                </button>
              ))}
            </div>
          </section>

          {/* Day */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Day</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Today', 'Tomorrow', 'This Week', 'This Weekend'].map((day) => (
                <button key={day} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${day === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {day}
                </button>
              ))}
            </div>
          </section>

          {/* Time of Day */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Time of Day</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Morning (6-12)', 'Afternoon (12-5)', 'Evening (5-10)'].map((time) => (
                <button key={time} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${time === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {time}
                </button>
              ))}
            </div>
          </section>

          {/* Distance */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Distance</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Under 1 mi', 'Under 5 mi', 'Under 10 mi', 'Under 25 mi'].map((dist) => (
                <button key={dist} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${dist === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {dist}
                </button>
              ))}
            </div>
          </section>

        </main>
      </div>

      {/* Fixed Bottom */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/80 backdrop-blur-md px-5 py-6 z-50 border-t border-surface-container-high" style={cardShadow}>
        <button
          onClick={onBack}
          className="w-full h-12 bg-secondary-container text-on-secondary-container rounded-full font-heading text-body-lg font-bold active:scale-95 transition-all"
          style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
