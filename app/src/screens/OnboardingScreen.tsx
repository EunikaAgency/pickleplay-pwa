import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <main className="flex flex-1 flex-col justify-center px-5 py-12 mx-auto w-full max-w-md">

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 rounded-full transition-all ${s <= step ? 'bg-primary w-8' : 'bg-surface-container-high w-2'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-4">
              <Icon name="sports_tennis" size={40} filled className="text-on-secondary-container" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Welcome to PicklePlay</h1>
            <p className="text-body-md text-on-surface-variant max-w-xs mx-auto">
              The easiest way to find pickleball games, meet players, and organize play near you.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
            >
              Get Started
              <Icon name="arrow_forward" size={20} />
            </button>
            <button onClick={onComplete} className="text-primary font-bold text-body-md hover:underline">Skip for now</button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="location_on" size={40} className="text-primary" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Where do you play?</h1>
            <p className="text-body-md text-on-surface-variant max-w-xs mx-auto">
              We'll show you courts and games near your area.
            </p>
            <div className="relative">
              <Icon name="location_on" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your city or zip code"
                className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-[16px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                style={cardShadow}
              />
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
            >
              Continue
              <Icon name="arrow_forward" size={20} />
            </button>
            <button onClick={onComplete} className="text-primary font-bold text-body-md hover:underline">Skip for now</button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-tertiary-container flex items-center justify-center mb-4">
              <Icon name="star" size={40} filled className="text-on-tertiary-container" />
            </div>
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Your skill level?</h1>
            <p className="text-body-md text-on-surface-variant max-w-xs mx-auto">
              This helps us match you with the right games and players.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {['1.0-2.0','2.5-3.0','3.5-4.0','4.5+'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSkillLevel(level)}
                  className={`h-12 rounded-[16px] font-bold text-body-md transition-all active:scale-95 ${
                    skillLevel === level
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'
                  }`}
                  style={skillLevel === level ? { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } : undefined}
                >
                  {level}
                </button>
              ))}
            </div>
            <button
              onClick={onComplete}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
            >
              Let's Play!
              <Icon name="bolt" size={20} />
            </button>
            <button onClick={onComplete} className="text-primary font-bold text-body-md hover:underline">Skip for now</button>
          </div>
        )}

      </main>
    </div>
  );
}
