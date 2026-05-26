import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { DuprExplainerSheet } from '../components/ui/DuprExplainerSheet';
import { skillTiers, type SkillTier } from '../lib/skillTiers';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [skillTierId, setSkillTierId] = useState<SkillTier['id'] | null>(null);
  const [duprSheetOpen, setDuprSheetOpen] = useState(false);
  const cardShadow = { boxShadow: 'var(--shadow-card)' } as const;

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocation('Austin, TX');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        // Mock: we don't reverse-geocode, just stamp a friendly value
        setLocation('Your current location');
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { timeout: 6000 },
    );
  };

  const canContinueLocation = location.trim().length > 0;
  const canFinish = skillTierId !== null;

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12 text-center">

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${s <= step ? 'bg-primary w-8' : 'bg-surface-container-high w-2'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="w-full space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-4">
              <Icon name="sports_tennis" size={40} filled className="text-on-secondary-container" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Welcome to PickleBallers</h1>
            <p className="text-body-md text-on-surface-variant max-w-xs mx-auto">
              The easiest way to find pickleball games, meet players, and organize play near you.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ boxShadow: 'var(--shadow-button)' }}
            >
              Get Started
              <Icon name="arrow_forward" size={20} />
            </button>
            <button onClick={onComplete} className="text-primary font-bold text-body-md hover:underline">
              Skip setup
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="location_on" size={40} className="text-primary" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Where do you play?</h1>
            <p className="text-body-md text-on-surface-variant max-w-xs mx-auto">
              We'll show you courts and games near your area. You can change this any time.
            </p>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-full border border-primary bg-surface-container-lowest text-primary font-heading text-body-md font-bold active:scale-95 transition-all hover:bg-primary/5 disabled:opacity-50"
            >
              <Icon name={locating ? 'sync' : 'my_location'} size={20} className={locating ? 'animate-spin' : undefined} />
              {locating ? 'Locating…' : 'Use my current location'}
            </button>

            <div className="flex items-center gap-3 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
              <div className="flex-1 h-px bg-outline-variant" />
              or enter manually
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            <div className="relative">
              <Icon name="location_on" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or zip code"
                className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                style={cardShadow}
              />
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!canContinueLocation}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              style={{ boxShadow: 'var(--shadow-button)' }}
            >
              Continue
              <Icon name="arrow_forward" size={20} />
            </button>
            <button
              onClick={() => setStep(3)}
              className="text-on-surface-variant font-bold text-label-sm hover:text-primary"
            >
              I'll add this later
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="w-full space-y-5">
            <div className="mx-auto w-20 h-20 rounded-full bg-tertiary-container flex items-center justify-center mb-2">
              <Icon name="star" size={40} filled className="text-on-tertiary-container" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">How would you describe your game?</h1>
            <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
              Pick the tier that sounds most like you. We use it to match you with the right games — you can change it any time.
            </p>

            <div className="space-y-2.5 text-left">
              {skillTiers.map((tier) => {
                const isActive = skillTierId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSkillTierId(tier.id)}
                    aria-pressed={isActive}
                    className={`w-full flex items-start gap-3 rounded-[14px] p-4 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? 'border-2 border-primary bg-primary/5'
                        : 'border border-outline-variant bg-surface-container-lowest hover:border-primary/40'
                    }`}
                    style={isActive ? cardShadow : undefined}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isActive ? 'border-primary bg-primary' : 'border-outline-variant'
                      }`}
                    >
                      {isActive && <Icon name="check" size={14} className="text-on-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-heading text-body-lg font-bold text-on-surface">{tier.name}</span>
                        <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                          {tier.dupr}
                        </span>
                      </div>
                      <p className="text-body-md text-on-surface-variant">{tier.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setDuprSheetOpen(true)}
              className="inline-flex items-center gap-1.5 text-primary font-bold text-body-md hover:underline"
            >
              <Icon name="help" size={18} />
              What does this mean?
            </button>

            <button
              onClick={onComplete}
              disabled={!canFinish}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              style={{ boxShadow: 'var(--shadow-button)' }}
            >
              Let's Play!
              <Icon name="bolt" size={20} />
            </button>
            <button
              onClick={onComplete}
              className="text-on-surface-variant font-bold text-label-sm hover:text-primary"
            >
              I'll pick later
            </button>
          </div>
        )}

      </main>

      <DuprExplainerSheet open={duprSheetOpen} onClose={() => setDuprSheetOpen(false)} />
    </div>
  );
}
