import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { FormTierPicker } from '../../shared/components/forms/FormTierPicker';
import { duprForTier, skillTiers, type SkillTier } from '../../shared/lib/skillTiers';
import { useAuthStore } from '../../shared/lib/authStore';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [tier, setTier] = useState<SkillTier['id'] | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Remember onboarding on the account (so the user is never re-onboarded),
  // saving the skill tier they picked when there is one, then leave the flow.
  // `completeOnboarding` is best-effort, so we always proceed via onComplete.
  const finish = async (chosenTier: SkillTier['id'] | null) => {
    if (finishing) return;
    setFinishing(true);
    const tierName = chosenTier ? skillTiers.find((t) => t.id === chosenTier)?.name : undefined;
    await completeOnboarding(
      chosenTier ? { skillLevel: duprForTier(chosenTier), skillLevelLabel: tierName } : undefined,
    );
    onComplete();
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocation('Austin, TX');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocation('Your current location');
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 6000 },
    );
  };

  return (
    <div className="scroll flex flex-col pt-[calc(28px+env(safe-area-inset-top))] pb-[calc(28px+env(safe-area-inset-bottom))] bg-[radial-gradient(900px_500px_at_90%_-10%,rgba(0,64,224,0.18),transparent_60%),radial-gradient(600px_400px_at_0%_110%,rgba(193,241,0,0.25),transparent_60%),var(--bg)]">
      <div className="px-5 flex flex-col flex-1 min-h-0">
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-[5px] rounded-[3px] transition-all duration-300 ease-out ${
                s <= step ? 'w-7 bg-[var(--lime)]' : 'w-2 bg-[var(--surface-3)]'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-center py-6">
        {step === 1 && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[var(--lime)] text-[var(--lime-ink)] inline-flex items-center justify-center shadow-[var(--shadow-fab)] mb-2">
              <Icon name="paddle" size={40} />
            </div>
            <h1 className="hd-1">Welcome to PickleBallers</h1>
            <p className="t-sm max-w-[320px]">
              The easiest way to find games, meet players, and organize play near you.
            </p>
            <Button fullWidth onClick={() => setStep(2)}>
              Get started <Icon name="forward" size={16} />
            </Button>
            <button onClick={() => finish(null)} disabled={finishing} className="text-[13px] text-[var(--muted)] font-bold disabled:opacity-60">
              Skip setup
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--primary-tint)] text-[var(--primary)] inline-flex items-center justify-center mb-3">
                <Icon name="location" size={36} />
              </div>
              <h1 className="hd-1">Where do you play?</h1>
              <p className="t-sm max-w-[320px] mx-auto mt-2">
                We'll show you courts and games near you. You can change this any time.
              </p>
            </div>

            <Button
              variant="outline"
              fullWidth
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={16} />
                  </span>
                  Locating…
                </>
              ) : (
                <>
                  <Icon name="navigate" size={16} />
                  Use my current location
                </>
              )}
            </Button>

            <div className="searchbar m-0!">
              <Icon name="location" size={16} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or zip code"
              />
            </div>

            <Button
              fullWidth
              onClick={() => setStep(3)}
              disabled={!location.trim()}
            >
              Continue <Icon name="forward" size={16} />
            </Button>
            <button onClick={() => setStep(3)} className="text-[13px] text-[var(--muted)] font-bold">
              I'll add this later
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--coral-soft)] text-[var(--coral)] inline-flex items-center justify-center mb-3">
                <Icon name="star" size={36} />
              </div>
              <h1 className="hd-1">How would you describe your game?</h1>
              <p className="t-sm max-w-[340px] mx-auto mt-2">
                Pick the tier that sounds like you. We'll match you with the right games — you can change it any time.
              </p>
            </div>

            <FormTierPicker value={tier} onChange={setTier} />

            <button
              type="button"
              onClick={() => setDuprOpen(true)}
              className="inline-flex items-center gap-1.5 text-[var(--primary)] font-bold text-[13px] self-center"
            >
              <Icon name="help" size={14} /> What does this mean?
            </button>

            <Button
              fullWidth
              onClick={() => finish(tier)}
              disabled={!tier || finishing}
            >
              {finishing ? (
                <>
                  <span className="inline-flex animate-spin">
                    <Icon name="spinner" size={18} />
                  </span>
                  Setting up…
                </>
              ) : (
                <>
                  <Icon name="bolt" size={18} /> Let's play!
                </>
              )}
            </Button>
            <button onClick={() => finish(tier)} disabled={finishing} className="text-[13px] text-[var(--muted)] font-bold self-center disabled:opacity-60">
              I'll pick later
            </button>
          </div>
        )}
        </div>
      </div>

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
