
interface GameFiltersScreenProps {
  onBack: () => void;
}

const FILTER_SECTIONS = [
  {
    title: 'Skill Level',
    options: ['All', 'Beginner', 'Intermediate', 'Advanced'],
    active: 'All',
  },
  {
    title: 'Game Type',
    options: ['All', 'Singles', 'Doubles', 'Open Play'],
    active: 'All',
  },
  {
    title: 'Day',
    options: ['Any', 'Today', 'Tomorrow', 'This Week', 'This Weekend'],
    active: 'Any',
  },
  {
    title: 'Time of Day',
    options: ['Any', 'Morning (6-12)', 'Afternoon (12-5)', 'Evening (5-10)'],
    active: 'Any',
  },
  {
    title: 'Distance',
    options: ['Any', 'Under 1 mi', 'Under 5 mi', 'Under 10 mi', 'Under 25 mi'],
    active: 'Any',
  },
];

export function GameFiltersScreen({ onBack }: GameFiltersScreenProps) {
  const chipShadow = {
    boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)',
  } as const;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Scroll Area */}
      <div className="scrollbar-none flex-1 overflow-y-auto">
        {/* Header */}
        <header className="py-8 flex items-center justify-between sticky top-0 bg-white px-5">
          <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">
            Filter Games
          </h1>

          <button className="text-label-sm font-bold text-primary transition-opacity hover:opacity-70">
            Reset
          </button>
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-col px-5 pb-36 pt-5">
          

          {/* Sections */}
          <div className="space-y-8">
            {FILTER_SECTIONS.map((section) => (
              <section key={section.title} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-headline-sm text-on-surface">
                    {section.title}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-3">
                  {section.options.map((option) => {
                    const isActive = option === section.active;

                    return (
                      <button
                        key={option}
                        style={chipShadow}
                        className={` min-h-[44px] rounded-full border px-5 py-2.5 text-body-md font-bold transition-all active:scale-95
                          ${
                            isActive
                              ? 'border-transparent bg-secondary-container text-on-secondary-container'
                              : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant'
                          }
                        `}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>

      {/* Bottom Action */}
      <div
        className=" fixed bottom-0 left-0 right-0 z-50 border-t border-surface-container-high bg-surface-container-lowest/85 px-5 pb-6 pt-4 backdrop-blur-md"
        style={chipShadow}
      >
        <div className="mx-auto max-w-xl">
          <button
            onClick={onBack}
            className=" h-12 w-full rounded-full bg-secondary-container font-heading text-body-lg font-bold text-on-secondary-container transition-all active:scale-95"
            style={{
              boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)',
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}