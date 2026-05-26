import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';

interface CreateClubScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
}

export function CreateClubScreen({ onNavigate, onBack }: CreateClubScreenProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [skillMin, setSkillMin] = useState('all');
  const [skillMax, setSkillMax] = useState('all');
  const [submitted, setSubmitted] = useState(false);
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-6">
          <Icon name="check_circle" size={48} filled className="text-on-secondary-container" />
        </div>
        <h2 className="font-heading text-headline-lg mb-2">Club Created!</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-xs">Your new club is live. Start inviting members!</p>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => onNavigate('club-details', { id: 'new' })}
            className="flex-1 bg-secondary-container text-on-secondary-container h-12 rounded-full font-bold active:scale-95 transition-all"
          >
            View Club
          </button>
          <button
            onClick={() => onBack()}
            className="flex-1 bg-primary text-on-primary h-12 rounded-full font-bold active:scale-95 transition-all"
          >
            Invite Members
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 pb-28 space-y-6">

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-2 rounded-full transition-all ${s <= step ? 'bg-primary w-8' : 'bg-surface-container-high w-2'}`} />
            ))}
          </div>
          <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-center">
            {step === 1 ? 'Name Your Club' : step === 2 ? 'Club Details' : 'Review & Create'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-1">
                  <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">CLUB NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Neon Smashers"
                    required
                    className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                    style={cardShadow}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">DESCRIPTION</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's your club about?"
                    rows={4}
                    className="w-full p-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md resize-none"
                    style={cardShadow}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1">
                  <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">VISIBILITY</label>
                  <div className="flex rounded-[12px] bg-surface-container-high p-1" style={cardShadow}>
                    <button type="button" onClick={() => setVisibility('public')} className={`flex-1 rounded-full py-2.5 text-center font-heading text-body-md font-bold transition-colors ${visibility === 'public' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>Public</button>
                    <button type="button" onClick={() => setVisibility('private')} className={`flex-1 rounded-full py-2.5 text-center font-heading text-body-md font-bold transition-colors ${visibility === 'private' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>Private</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MIN SKILL</label>
                    <select value={skillMin} onChange={(e) => setSkillMin(e.target.value)} className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none" style={cardShadow}>
                      {['all','1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All Levels' : s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MAX SKILL</label>
                    <select value={skillMax} onChange={(e) => setSkillMax(e.target.value)} className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none" style={cardShadow}>
                      {['all','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5+'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All Levels' : s}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="bg-surface-container-lowest rounded-[12px] p-5 space-y-4" style={cardShadow}>
                <div>
                  <p className="text-label-sm text-on-surface-variant font-bold">CLUB NAME</p>
                  <p className="font-heading text-headline-md">{name || '—'}</p>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant font-bold">DESCRIPTION</p>
                  <p className="text-body-md text-on-surface">{description || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-bold">VISIBILITY</p>
                    <p className="text-body-md font-bold text-on-surface capitalize">{visibility}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-bold">SKILL RANGE</p>
                    <p className="text-body-md font-bold text-on-surface">{skillMin === 'all' ? 'All' : skillMin} — {skillMax === 'all' ? 'All' : skillMax}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button type="button" onClick={() => setStep(step - 1)} className="flex-1 bg-surface-container-high text-on-surface-variant h-12 rounded-full font-bold active:scale-95 transition-all">
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={step === 1 && !name}
                className="flex-1 bg-secondary-container text-on-secondary-container h-12 rounded-full font-heading text-body-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-105 disabled:opacity-50"
                style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
              >
                {step === 3 ? 'Create Club' : 'Next'}
                <Icon name={step === 3 ? 'bolt' : 'arrow_forward'} size={20} />
              </button>
            </div>
          </form>

        </main>
      </div>
    </div>
  );
}
