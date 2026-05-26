import { Icon } from '../components/ui/Icon';

interface ClubsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

const myClubs = [
  {
    id: '1', name: 'Neon Smashers', icon: 'bolt', iconBg: 'bg-secondary-container text-on-secondary-container',
    tags: ['Competitive', '3 Events'],
  },
  {
    id: '2', name: 'Downtown Volleys', icon: 'groups', iconBg: 'bg-primary-container text-on-primary-container',
    tags: ['Social', 'Friendly'],
  },
];

const discoverClubs = [
  {
    id: '3', name: 'Paddle Pirates', rating: 4.9, distance: '1.2 miles away',
    tags: ['Morning Play', 'Beginner Friendly'],
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuuT43qFNYevw9MppmlcHg-Tv8RxCbdKUNu_a4-wYrCGXNUyns5FZyPhcNyUxpdcMjjSc0FOr4OSQdBOLrNJM32uIQFCAXRS2IsaSXMHli_V6c5ZAGlBdTspl6f1bA9QxukVvhiBsdAd3J87CTZRVCzj0n3yA6POpIRW_a2hAqS2iHuZPHQJ3zf1HCa7wjlkTLqydFsjHFKMP8QcC_RfTOpP4dYleCeep9SEhCwQMj9ZvGyPbQi-ATkQkDjix8v6Ob3SesuScj',
  },
  {
    id: '4', name: 'The Dink Den', rating: 4.7, distance: '0.5 miles away',
    tags: ['Indoor Courts', 'All Levels'],
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpfByT3q1YIF8lrRviwwRuL72MUO9nxSSrm_zzAA-UMCRtNWmMPJvsXtOm-gjNjoU9mULcsmHPtZJFw-bmPf4iT6HFrBvkN8jkcCapuLNdW-wyz2PUJ4c2K51n1bLqJcdgRc9R0c_gODV0tFxy-zXj0ondBthKQ6F42osmjp9z-atPbsTNGNniFjchTaJrVzK5ifLMQdJKlYD9B4QecTiuYPvCLgWiTPDwSI9RiW97N4sFK0l63Ojd3A6oCowgt_Ad7aWEJKsu',
  },
  {
    id: '5', name: 'Ace Alliance', rating: 5.0, distance: '2.4 miles away',
    tags: ['Night Play', 'Intermediate'],
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDH2BwrS1NRnoklgmWDysHFOLQLpjx4qbkqaUyjf30Xl3H0np4zVDJEhp9rM_mryyU9_jYmZb-f717tI-7RA2ZqglT36CPUyY5GFT9mOO6vhEnd802aMNwTDcj80N6-Pb-_viRilU1U4EkujEI7np02h_XbB-DvH82fHB9uVjB57j8AU5WvUYzktS67KEF6RNlh5WO1l5-1pWs6LlFC4cxFD2lyKL7X7nUHeMdNXXN9QuONxAF9syiitCxdQ88nziNVJ58Eq7XK',
  },
];

export function ClubsScreen({ onNavigate }: ClubsScreenProps) {
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-7xl px-5 pt-6 pb-28 space-y-8">

          {/* My Clubs Section */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <h2 className="font-heading text-headline-md text-primary">My Clubs</h2>
              <button className="text-primary font-bold text-label-sm uppercase tracking-wider hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myClubs.map((club) => (
                <div
                  key={club.id}
                  className="bg-surface-container-lowest rounded-[12px] p-5 flex items-center gap-4 group cursor-pointer active:scale-[0.98] transition-transform"
                  style={cardShadow}
                  onClick={() => onNavigate('club-details', { id: club.id })}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${club.iconBg}`}>
                    <Icon name={club.icon} size={28} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading text-headline-md text-on-surface">{club.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {club.tags.map((tag) => (
                        <span key={tag} className="bg-primary/10 text-primary px-3 py-0.5 rounded-full text-label-sm">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <Icon name="chevron_right" size={24} className="text-outline group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          </section>

          {/* Discover Nearby Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Icon name="explore" size={24} className="text-tertiary" />
              <h2 className="font-heading text-headline-md text-on-surface">Discover Nearby</h2>
            </div>

            {/* Featured Large Card */}
            <div
              className="relative w-full overflow-hidden rounded-2xl mb-6 group"
              style={cardShadow}
            >
              {/* Responsive image */}
              <div className="aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]">
                <img
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2EV0cyvMuMekUO2psqDEYAa9JTukNhSQhzsydF-lFuYEYIAcjvT5Khag839z2lIaH0OXPNIJdlBxOPcAKXNSGt2AZsYyFC3K-DDEgejV9HibLfSX8FVvmS83AgHtZnlLzveAQVxLZHesRPppGR7smLzogzDz0uOaz1Lspa4ND6jwuXKj1tH56uGQutiWcYOCxoDAhzJXMXu9kvSwfTw30UqVEG6vD70cktuEnRZ7FRpXCf17_iAz8Z9ni2NQt_mV7Y5XgF7nz"
                  alt="The Kitchen Kings Club"
                />
              </div>


              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-4 sm:p-6 md:p-8">
                
                {/* Badge */}
                <span className="bg-secondary-container text-on-secondary-container w-fit px-3 py-1 rounded-full font-bold text-xs sm:text-sm mb-3">
                  FEATURED CLUB
                </span>

                {/* Title */}
                <h3 className="font-heading text-2xl sm:text-4xl text-white mb-2 leading-tight">
                  The Kitchen Kings
                </h3>

                {/* Description */}
                <p className="text-white/80 text-sm sm:text-base md:text-lg max-w-xl mb-5">
                  The city's largest community for competitive and casual play.
                  12 courts, pro coaches, and weekly mixers.
                </p>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                  <button className="bg-secondary-container text-on-secondary-container px-6 h-11 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all w-full sm:w-auto">
                    Join Club
                  </button>

                  <button className="bg-white/20 backdrop-blur-md text-white border border-white/40 px-6 h-11 rounded-full font-bold hover:bg-white/30 active:scale-95 transition-all w-full sm:w-auto">
                    Explore
                  </button>
                </div>
              </div>
            </div>

            {/* Grid of Club Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {discoverClubs.map((club) => (
                <div
                  key={club.id}
                  className="bg-surface-container-lowest rounded-[12px] overflow-hidden group cursor-pointer"
                  style={cardShadow}
                  onClick={() => onNavigate('club-details', { id: club.id })}
                >
                  <div className="h-40 overflow-hidden relative">
                    <img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={club.img} />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                      <Icon name="star" size={14} filled className="text-tertiary" />
                      <span className="text-label-sm font-bold">{club.rating}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="font-heading text-headline-md text-on-surface mb-1">{club.name}</h4>
                    <p className="text-on-surface-variant text-body-md mb-4 flex items-center gap-1">
                      <Icon name="location_on" size={16} />
                      {club.distance}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {club.tags.map((tag) => (
                        <span key={tag} className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full text-label-sm">{tag}</span>
                      ))}
                    </div>
                    <button className="w-full bg-primary text-white h-12 rounded-full font-bold hover:bg-primary-container transition-colors">Join Club</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Start a Club CTA */}
          <section className="bg-secondary-container rounded-[12px] p-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <Icon name="sports_tennis" size={200} filled />
            </div>
            <div className="relative z-10 text-center md:text-left">
              <h2 className="font-heading text-headline-lg text-on-secondary-container mb-2">Can't find the perfect club?</h2>
              <p className="text-on-secondary-fixed-variant text-body-lg max-w-md">Start your own community and invite your friends to play together!</p>
            </div>
            <button
              className="relative z-10 bg-on-secondary-container text-secondary-fixed px-10 h-12 rounded-full font-bold text-headline-md active:scale-95 transition-all"
              style={cardShadow}
              onClick={() => onNavigate('create-club')}
            >
              Start a Club
            </button>
          </section>

        </main>
      </div>
    </div>
  );
}
