import { Icon } from '../../shared/components/ui/Icon';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { Button } from '../../shared/components/ui/Button';

interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = [
  {
    icon: 'paddle',
    title: 'Skill-matched games',
    body: 'Filter by DUPR range so the rally lasts longer than the warm-up — beginner to 4.0+.',
  },
  {
    icon: 'groups',
    title: 'Friendly local players',
    body: 'Verified organizers, player profiles, and a community-first vibe.',
  },
  {
    icon: 'location',
    title: 'Courts in your pocket',
    body: 'Every court near you with amenities, photos, ratings, and walking distance.',
  },
];

const STEPS = [
  { number: '1', title: 'Tell us where you play', body: 'Set your home court and skill level. 30 seconds.' },
  { number: '2', title: "Browse tonight's games", body: 'Open games within 10 miles, filtered by date and level.' },
  { number: '3', title: 'Tap to join', body: 'Reserve a spot, message the organizer, show up ready.' },
];

export function LandingScreen({ onGetStarted, onSignIn }: LandingScreenProps) {
  return (
    <div
      className="scroll bg-[radial-gradient(900px_500px_at_10%_-10%,rgba(0,64,224,0.18),transparent_60%),radial-gradient(700px_400px_at_100%_100%,rgba(193,241,0,0.25),transparent_60%),var(--bg)]"
    >
      <header
        className="marketing-header flex items-center justify-between sticky top-0 z-10 px-5 pb-3 pt-[calc(16px+env(safe-area-inset-top))] bg-[rgba(246,247,251,0.85)] backdrop-blur-[16px] backdrop-saturate-[180%] [-webkit-backdrop-filter:blur(16px)_saturate(180%)]"
      >
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-[10px] bg-[var(--lime)] text-[var(--lime-ink)] inline-flex items-center justify-center">
            <Icon name="paddle" size={18} />
          </span>
          <span className="font-heading font-semibold text-[17px] text-[var(--ink)]">PickleBallers</span>
        </div>
        <button onClick={onSignIn} className="text-[13px] font-bold text-[var(--primary)]">
          Sign in
        </button>
      </header>

      <section className="marketing-hero px-5 pt-5 pb-2">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] font-heading font-semibold text-[11px] tracking-[0.6px] uppercase">
            For recreational players
          </span>
          <h1 className="hd-display mt-3 text-[32px] leading-[1.1]">
            Find your next pickleball game in two taps.
          </h1>
          <p className="t-body mt-3">
            Discover open games near you, meet players at your skill level, and turn your local courts into a community.
          </p>

          <div className="mt-[18px] flex flex-col gap-2.5">
            <Button fullWidth onClick={onGetStarted}>
              Get started — it's free <Icon name="forward" size={16} />
            </Button>
            <Button variant="outline" fullWidth onClick={onSignIn}>
              I have an account
            </Button>
          </div>
          <p className="t-sm mt-2.5">No credit card. Works on iOS, Android, and the web.</p>
        </div>

        {/* Hero visual */}
        <div className="marketing-visual relative mt-6 rounded-[28px] overflow-hidden min-h-[220px] bg-[linear-gradient(135deg,var(--primary)_0%,#6c83ff_100%)] shadow-[var(--shadow-pop)]">
          <div className="absolute -right-5 -bottom-5 opacity-95">
            <CourtIllustration width={200} />
          </div>
          <div className="relative p-5 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-2 h-2 rounded-full bg-[#ff5a4d] shadow-[0_0_0_4px_rgba(255,90,77,0.25)]" />
              <span className="text-[11px] font-extrabold tracking-[0.6px] uppercase opacity-90">
                Live in 12 cities
              </span>
            </div>
            <h2 className="font-heading font-semibold text-[24px] mt-2.5 max-w-[70%]">
              Tonight: 12 open games near you
            </h2>
            <p className="mt-2 text-[13px] opacity-90 max-w-[70%]">
              From beginner mix-ins to competitive doubles.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="marketing-section px-4 pt-8">
        <div className="text-center mb-4">
          <span className="t-eyebrow">Why PickleBallers</span>
          <h2 className="hd-1 mt-1.5">Everything you need to play more.</h2>
        </div>
        <div className="marketing-grid-3 flex flex-col gap-2.5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[18px] p-4 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)]"
            >
              <div className="w-11 h-11 rounded-[14px] bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                <Icon name={f.icon} size={20} />
              </div>
              <h3 className="hd-3 mt-2.5">{f.title}</h3>
              <p className="t-sm mt-1">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="marketing-section px-4 pt-8">
        <div className="text-center mb-4">
          <span className="t-eyebrow">How it works</span>
          <h2 className="hd-1 mt-1.5">Get into a game tonight.</h2>
        </div>
        <div className="marketing-grid-3 flex flex-col gap-2.5">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className="flex gap-3.5 p-4 rounded-[18px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)]"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--ink)] text-white inline-flex items-center justify-center font-heading font-semibold shrink-0">
                {s.number}
              </div>
              <div>
                <h3 className="hd-3">{s.title}</h3>
                <p className="t-sm mt-1">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="marketing-cta px-4 pt-9 pb-6">
        <div className="marketing-cta-card relative overflow-hidden rounded-3xl text-white text-center px-5 py-6 bg-[linear-gradient(135deg,var(--primary)_0%,#6c83ff_90%)] shadow-[var(--shadow-pop)]">
          <h2 className="font-heading font-semibold text-[22px]">Ready to hit the courts?</h2>
          <p className="mt-2 text-[13px] opacity-90">Beginners welcome — no commitment.</p>
          <Button className="mt-3.5 mx-auto" onClick={onGetStarted}>
            Get started <Icon name="forward" size={16} />
          </Button>
        </div>
      </section>

      <footer className="px-5 pt-2 pb-8 text-center text-[var(--muted)] text-[11px]">
        <p className="font-bold tracking-[0.4px]">FIND GAMES · MEET PLAYERS · PLAY PICKLEBALL</p>
      </footer>
    </div>
  );
}
