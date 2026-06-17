import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import type { Navigate } from '../../shared/lib/navigation';
import { createClub } from '../../shared/lib/api';

interface CreateClubScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function CreateClubScreen({ onNavigate, onBack }: CreateClubScreenProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) { setStep(step + 1); return; }
    setSubmitting(true);
    setError(null);
    try {
      const club = await createClub({ name: name.trim(), description: description.trim() || undefined, visibility });
      setCreatedRef(club.slug || club.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your club. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => (step > 1 ? setStep(step - 1) : onBack());

  if (createdRef) {
    return (
      <CompletionScreen
        icon="check"
        title="Club created!"
        description="Your new club is live. Open it to make the first post and invite members."
        actions={[
          // `replace` drops the finished wizard from the back stack so Back from
          // the club page doesn't re-open the create-club flow.
          { label: 'View club', variant: 'dark', onClick: () => onNavigate('club-details', { id: createdRef }, { replace: true }) },
          { label: 'Done', variant: 'outline', onClick: onBack },
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
              <input className="control" placeholder="e.g. Neon Smashers" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </div>
            <div className="field">
              <div className="lbl">Description</div>
              <textarea className="control" rows={4} placeholder="What's your club about?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="field">
            <div className="lbl">Visibility</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`time-pick ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>🌍 Public</button>
              <button type="button" className={`time-pick ${visibility === 'private' ? 'active' : ''}`} onClick={() => setVisibility('private')}>🔒 Private</button>
            </div>
            <div className="t-sm mt-2 px-1">
              {visibility === 'public' ? 'Anyone can find and join this club.' : 'People request to join; you approve them.'}
            </div>
          </div>
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
            <div className="mt-3.5">
              <div className="t-eyebrow">Visibility</div>
              <div className="hd-3 mt-1 capitalize">{visibility}</div>
            </div>
          </div>
        )}

        {error && <div className="px-5 mt-3 t-sm text-[var(--coral)] font-bold">{error}</div>}

        <div className="app-action-bar">
          <Button type="submit" fullWidth disabled={(step === 1 && !name.trim()) || submitting}>
            {step === 3 ? (
              submitting ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Creating…</> : <><Icon name="bolt" size={18} /> Create club</>
            ) : (
              <>Continue <Icon name="forward" size={16} /></>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
