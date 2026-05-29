import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import type { Navigate } from '../../shared/lib/navigation';

interface CreateClubScreenProps {
  onNavigate: Navigate;
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) setStep(step + 1);
    else setSubmitted(true);
  };

  const back = () => (step > 1 ? setStep(step - 1) : onBack());

  if (submitted) {
    return (
      <CompletionScreen
        icon="check"
        title="Club created!"
        description="Your new club is live. Start inviting members."
        actions={[
          { label: 'View club', variant: 'outline', onClick: () => onNavigate('club-details', { id: 'new' }) },
          { label: 'Invite members', variant: 'dark', onClick: () => onBack() },
        ]}
      />
    );
  }

  const titles = ['Name your club', 'Club details', 'Review & create'];

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={back}
        backIcon={step === 1 ? 'close' : 'back'}
        eyebrow={`Step ${step} of 3`}
        title={titles[step - 1]}
      />

      <div className="px-5 pb-4">
        <ProgressBar value={step / 3} />
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <>
            <div className="field">
              <div className="lbl">Club name</div>
              <input className="control" placeholder="e.g. Neon Smashers" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <div className="lbl">Description</div>
              <textarea className="control" rows={4} placeholder="What's your club about?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <div className="lbl">Visibility</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`time-pick ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>🌍 Public</button>
                <button type="button" className={`time-pick ${visibility === 'private' ? 'active' : ''}`} onClick={() => setVisibility('private')}>🔒 Private</button>
              </div>
            </div>

            <div className="field">
              <div className="lbl">Skill range</div>
              <div className="grid grid-cols-2 gap-2">
                <select className="control" value={skillMin} onChange={(e) => setSkillMin(e.target.value)}>
                  {['all', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'].map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All levels' : s}</option>
                  ))}
                </select>
                <select className="control" value={skillMax} onChange={(e) => setSkillMax(e.target.value)}>
                  {['all', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5+'].map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All levels' : s}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="about-card mx-5">
            <div>
              <div className="t-eyebrow">Club name</div>
              <div className="hd-3 mt-1">{name || '—'}</div>
            </div>
            <div className="mt-3.5">
              <div className="t-eyebrow">Description</div>
              <p className="mt-1">{description || '—'}</p>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div>
                <div className="t-eyebrow">Visibility</div>
                <div className="hd-3 mt-1 capitalize">{visibility}</div>
              </div>
              <div>
                <div className="t-eyebrow">Skill range</div>
                <div className="hd-3 mt-1">
                  {skillMin === 'all' ? 'All' : skillMin} – {skillMax === 'all' ? 'All' : skillMax}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="app-action-bar">
          <Button
            type="submit"
            fullWidth
            disabled={step === 1 && !name}
          >
            {step === 3 ? (
              <>
                <Icon name="bolt" size={18} /> Create club
              </>
            ) : (
              <>
                Continue <Icon name="forward" size={16} />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
