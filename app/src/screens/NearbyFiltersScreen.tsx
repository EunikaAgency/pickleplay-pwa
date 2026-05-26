
interface NearbyFiltersScreenProps {
  onBack: () => void;
}

export function NearbyFiltersScreen({ onBack }: NearbyFiltersScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">

          <div className="flex items-center justify-between">
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Filter Courts</h1>
            <button className="text-primary font-bold text-label-sm hover:underline">Reset</button>
          </div>

          {/* Court Type */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Court Type</h3>
            <div className="flex flex-wrap gap-2">
              {['All', 'Indoor', 'Outdoor'].map((type) => (
                <button key={type} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${type === 'All' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {type}
                </button>
              ))}
            </div>
          </section>

          {/* Access */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Access</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Public', 'Membership', 'Fee Required'].map((access) => (
                <button key={access} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${access === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {access}
                </button>
              ))}
            </div>
          </section>

          {/* Court Count */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Number of Courts</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', '1-2', '3-6', '7-12', '12+'].map((count) => (
                <button key={count} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${count === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {count}
                </button>
              ))}
            </div>
          </section>

          {/* Surface */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Surface</h3>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Concrete', 'Asphalt', 'Acrylic', 'Wood'].map((surface) => (
                <button key={surface} className={`rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 ${surface === 'Any' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'}`} style={cardShadow}>
                  {surface}
                </button>
              ))}
            </div>
          </section>

          {/* Amenities */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {['Restrooms', 'Lighted', 'Pro Shop', 'Water Fountain', 'Seating', 'Parking'].map((amenity) => (
                <button key={amenity} className="rounded-full px-5 py-2.5 font-bold text-body-md transition-all active:scale-95 bg-surface-container-lowest text-on-surface-variant border border-outline-variant" style={cardShadow}>
                  {amenity}
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
          Show Results
        </button>
      </div>
    </div>
  );
}
