import { Icon } from '../components/ui/Icon';

interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const features = [
  {
    icon: 'sports_tennis',
    title: 'Skill-matched games',
    body: 'Filter by DUPR range so the rally lasts longer than the warm-up. From "still learning to keep score" to competitive 4.0+ play.',
  },
  {
    icon: 'group',
    title: 'Friendly local players',
    body: 'Verified organizers, player profiles, and a community-first tone — built for people who just want a good game.',
  },
  {
    icon: 'location_on',
    title: 'Courts in your pocket',
    body: 'Every public court near you, with amenities, photos, ratings, and walking distance — right on the map.',
  },
];

const steps = [
  { number: '1', title: 'Tell us where you play', body: 'Set your home court and skill level — 30 seconds, no commitment.' },
  { number: '2', title: 'Browse tonight’s games', body: 'Open games within 10 miles, filtered by date, level, and format.' },
  { number: '3', title: 'Tap to join', body: 'Reserve a spot, message the organizer, and show up ready to play.' },
];

export function LandingScreen({ onGetStarted, onSignIn }: LandingScreenProps) {
  return (
    <div className="w-full min-w-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between bg-background/90 px-5 py-3 backdrop-blur md:px-10 md:py-5"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2">
            <Icon name="sports_tennis" size={28} filled className="text-primary" />
            <span className="font-heading text-headline-md font-bold text-primary">PickleBallers</span>
          </div>
          <button
            onClick={onSignIn}
            className="text-body-md font-bold text-primary hover:underline active:scale-95 transition"
          >
            Sign in
          </button>
        </header>

        {/* Hero */}
        <section className="px-5 py-8 md:flex md:items-center md:gap-12 md:px-10 md:py-16">
          <div className="md:flex-1 md:max-w-xl">
            <span className="inline-block rounded-full bg-secondary-container/50 px-3 py-1 text-label-sm font-bold tracking-wider uppercase text-on-secondary-container">
              For recreational players
            </span>
            <h1 className="mt-4 font-heading text-[28px] leading-[1.15] font-bold text-on-surface sm:text-[32px] md:text-[44px] md:leading-[1.1]">
              Find your next pickleball game in two taps.
            </h1>
            <p className="mt-4 text-body-lg text-on-surface-variant">
              Discover open games near you, meet players at your skill level, and turn your local courts into a community — all in one mobile-first app.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onGetStarted}
                className="h-12 rounded-full bg-secondary-container px-6 font-heading text-body-lg font-bold text-on-secondary-container active:scale-95 transition hover:brightness-105"
                style={{ boxShadow: 'var(--shadow-cta)' }}
              >
                Get started — it's free
              </button>
              <button
                onClick={onSignIn}
                className="h-12 rounded-full border border-outline-variant bg-surface-container-lowest px-6 font-heading text-body-lg font-bold text-primary active:scale-95 transition hover:bg-surface-container-low"
              >
                I have an account
              </button>
            </div>
            <p className="mt-3 text-label-sm text-on-surface-variant">
              No credit card. Works on iOS, Android, and the web.
            </p>

            {/* Trust strip */}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 opacity-70">
              <div className="flex items-center gap-1.5">
                <Icon name="groups" size={16} />
                <span className="text-label-sm font-bold tracking-wider uppercase">10K+ players</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="verified" size={16} />
                <span className="text-label-sm font-bold tracking-wider uppercase">Verified organizers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="install_mobile" size={16} />
                <span className="text-label-sm font-bold tracking-wider uppercase">Installable PWA</span>
              </div>
            </div>
          </div>

          {/* Hero visual — stacked game cards on a gradient panel */}
          <div className="relative mt-10 mx-auto aspect-[4/5] w-full max-w-md md:mt-0 md:mx-0 md:flex-1 md:aspect-square">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-primary via-primary-container to-primary/80" />
            <div className="absolute inset-0 rounded-[28px] opacity-10">
              <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-white" />
              <div className="absolute -bottom-8 -right-8 h-56 w-56 rounded-full bg-white" />
            </div>

            {/* Floating game cards */}
            <div className="absolute inset-6 flex flex-col gap-3">
              <div
                className="rounded-[16px] bg-surface-container-lowest p-4 rotate-[-2deg]"
                style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-bold text-on-secondary-container">3.0 – 3.5</span>
                  <span className="text-label-sm font-bold text-on-surface-variant">TONIGHT · 6:30 PM</span>
                </div>
                <h3 className="mt-2 font-heading text-body-lg font-bold text-on-surface">Friday Night Dinks</h3>
                <div className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <Icon name="location_on" size={14} />
                  <span>Riverside Courts · 1.2 mi</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-primary-container" />
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-secondary-container" />
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-tertiary-container" />
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-label-sm font-bold text-on-surface">+2</div>
                  </div>
                  <span className="text-label-sm font-bold text-primary">5 / 8 spots</span>
                </div>
              </div>

              <div
                className="rounded-[16px] bg-surface-container-lowest p-4 rotate-[1.5deg] ml-6"
                style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm font-bold text-on-tertiary-container">BEGINNERS</span>
                  <span className="text-label-sm font-bold text-on-surface-variant">SAT · 9:00 AM</span>
                </div>
                <h3 className="mt-2 font-heading text-body-lg font-bold text-on-surface">Saturday Sunrise Social</h3>
                <div className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <Icon name="location_on" size={14} />
                  <span>Westside Community Park · 2.4 mi</span>
                </div>
              </div>

              <div
                className="rounded-[16px] bg-surface-container-lowest p-4 rotate-[-1deg] mr-4"
                style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-sm font-bold text-on-primary-container">4.0+</span>
                  <span className="text-label-sm font-bold text-on-surface-variant">SUN · 5:00 PM</span>
                </div>
                <h3 className="mt-2 font-heading text-body-lg font-bold text-on-surface">Competitive Ladder Match</h3>
                <div className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <Icon name="location_on" size={14} />
                  <span>Eastside Indoor Club · 3.1 mi</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-5 py-12 md:px-10 md:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-label-sm font-bold uppercase tracking-wider text-primary">Why PickleBallers</span>
            <h2 className="mt-2 font-heading text-[24px] leading-[1.2] font-bold text-on-surface sm:text-[28px] md:text-headline-xl">
              Everything you need to play more pickleball.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[16px] bg-surface-container-lowest p-6 border border-outline-variant/30"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/60">
                  <Icon name={f.icon} size={24} filled className="text-on-secondary-container" />
                </div>
                <h3 className="mt-4 font-heading text-headline-md font-bold text-on-surface">{f.title}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-surface-container-low/60 px-5 py-12 md:px-10 md:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-label-sm font-bold uppercase tracking-wider text-primary">How it works</span>
            <h2 className="mt-2 font-heading text-[24px] leading-[1.2] font-bold text-on-surface sm:text-[28px] md:text-headline-xl">
              Get into a game tonight.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.number} className="flex flex-col items-center text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-heading text-headline-md font-bold text-on-primary">
                  {s.number}
                </div>
                <h3 className="mt-4 font-heading text-headline-md font-bold text-on-surface">{s.title}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 py-12 md:px-10 md:py-20">
          <div
            className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary via-primary-container to-primary p-8 text-center md:p-16"
            style={{ boxShadow: 'var(--shadow-cta)' }}
          >
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
              <div className="absolute -top-10 -left-10 h-72 w-72 rounded-full bg-white" />
              <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white" />
            </div>
            <div className="relative">
              <h2 className="font-heading text-[26px] leading-[1.15] font-bold text-on-primary sm:text-[30px] md:text-headline-xl">
                Ready to hit the courts?
              </h2>
              <p className="mt-3 text-body-lg text-on-primary/90 max-w-lg mx-auto">
                Join the players already using PickleBallers to find their next game — beginners welcome, no commitment.
              </p>
              <button
                onClick={onGetStarted}
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-secondary-container px-8 font-heading text-body-lg font-bold text-on-secondary-container active:scale-95 transition hover:brightness-105"
                style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}
              >
                Get started
                <Icon name="arrow_forward" size={20} />
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-outline-variant/50 px-5 py-8 md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Icon name="sports_tennis" size={20} filled className="text-primary" />
              <span className="font-heading text-body-md font-bold text-primary">PickleBallers</span>
              <span className="text-label-sm text-on-surface-variant">· Find games. Meet players. Play pickleball.</span>
            </div>
            <div className="flex flex-wrap gap-4 text-label-sm font-bold text-on-surface-variant">
              <a href="#" className="hover:text-primary">Privacy</a>
              <a href="#" className="hover:text-primary">Terms</a>
              <a href="#" className="hover:text-primary">Community guidelines</a>
              <a href="#" className="hover:text-primary">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
