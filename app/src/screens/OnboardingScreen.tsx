import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { DuprExplainerSheet } from '../components/ui/DuprExplainerSheet';
import { FormTierPicker } from '../components/forms/FormTierPicker';
import type { SkillTier } from '../lib/skillTiers';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [tier, setTier] = useState<SkillTier['id'] | null>(null);
  const [duprOpen, setDuprOpen] = useState(false);

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
    <div
      className="scroll"
      style={{
        paddingTop: 'calc(28px + env(safe-area-inset-top))',
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(900px 500px at 90% -10%, rgba(0,64,224,0.18), transparent 60%), radial-gradient(600px 400px at 0% 110%, rgba(193,241,0,0.25), transparent 60%), var(--bg)',
      }}
    >
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                height: 5,
                borderRadius: 3,
                width: s <= step ? 28 : 8,
                background: s <= step ? 'var(--lime)' : 'var(--surface-3)',
                transition: 'all .3s ease',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: 'var(--lime)',
                color: 'var(--lime-ink)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-fab)',
                marginBottom: 8,
              }}
            >
              <Icon name="paddle" size={40} />
            </div>
            <h1 className="hd-1">Welcome to PickleBallers</h1>
            <p className="t-sm" style={{ maxWidth: 320 }}>
              The easiest way to find games, meet players, and organize play near you.
            </p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setStep(2)}>
              Get started <Icon name="forward" size={16} />
            </button>
            <button onClick={onComplete} style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
              Skip setup
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'var(--primary-tint)',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Icon name="location" size={36} />
              </div>
              <h1 className="hd-1">Where do you play?</h1>
              <p className="t-sm" style={{ maxWidth: 320, margin: '8px auto 0' }}>
                We'll show you courts and games near you. You can change this any time.
              </p>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="btn-primary outline"
              style={{ margin: 0, width: '100%' }}
            >
              {locating ? (
                <>
                  <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
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
            </button>

            <div className="searchbar" style={{ margin: 0 }}>
              <Icon name="location" size={16} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or zip code"
              />
            </div>

            <button
              className="btn-primary"
              style={{ margin: 0, width: '100%' }}
              onClick={() => setStep(3)}
              disabled={!location.trim()}
            >
              Continue <Icon name="forward" size={16} />
            </button>
            <button onClick={() => setStep(3)} style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
              I'll add this later
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'var(--coral-soft)',
                  color: 'var(--coral)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Icon name="star" size={36} />
              </div>
              <h1 className="hd-1">How would you describe your game?</h1>
              <p className="t-sm" style={{ maxWidth: 340, margin: '8px auto 0' }}>
                Pick the tier that sounds like you. We'll match you with the right games — you can change it any time.
              </p>
            </div>

            <FormTierPicker value={tier} onChange={setTier} />

            <button
              type="button"
              onClick={() => setDuprOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: 13,
                alignSelf: 'center',
              }}
            >
              <Icon name="help" size={14} /> What does this mean?
            </button>

            <button
              className="btn-primary"
              style={{ margin: 0, width: '100%' }}
              onClick={onComplete}
              disabled={!tier}
            >
              <Icon name="bolt" size={18} /> Let's play!
            </button>
            <button onClick={onComplete} style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, alignSelf: 'center' }}>
              I'll pick later
            </button>
          </div>
        )}
      </div>

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
