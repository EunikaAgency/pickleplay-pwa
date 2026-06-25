import { useRef, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { CompletionScreen } from '../../../shared/components/ui/CompletionScreen';
import { createClub, updateClub, uploadClubMedia } from '../../../shared/lib/api';

interface Props extends V2ScreenChrome { onBack: () => void; }

export function CreateClubV2(props: Props) {
  const { onNavigate, onBack } = props;
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [memberLimit, setMemberLimit] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const pickCover = (file: File | null | undefined) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  const next = () => {
    if (step === 1 && !name.trim()) { setError('Please name your club.'); return; }
    setError(null);
    if (step < 3) setStep(step + 1); else void submit();
  };
  const prev = () => (step > 1 ? setStep(step - 1) : onBack());

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const limit = parseInt(memberLimit, 10);
      const club = await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        joinLimit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      });
      // A cover image needs the new club's id, so upload + attach after create (non-fatal).
      if (coverFile) {
        try {
          const url = await uploadClubMedia(club.id, coverFile);
          if (url) await updateClub(club.id, { coverImageUrl: url });
        } catch { /* club is still created, just without a cover */ }
      }
      setCreatedRef(club.slug || club.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your club. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdRef) {
    return (
      <CompletionScreen
        icon="check"
        title="Club created!"
        description="Your new club is live. Open it to make the first post and invite members."
        actions={[
          { label: 'View club', variant: 'dark', onClick: () => onNavigate('club-details', { id: createdRef }, { replace: true }) },
          { label: 'Done', variant: 'outline', onClick: onBack },
        ]}
      />
    );
  }

  const seg = (i: number) => `step-seg${step === i ? ' active' : step > i ? ' done' : ''}`;

  return (
    <V2Shell screen="v2-createclub" chrome={props} onBack={prev} hideTabBar hideFab>
      <div className="wizard-scroll">
        <div className="wizard-wrap">
          <div className="step active">
            <div className="step-header">
              <div className="step-bar">
                <div className={seg(1)} /><div className={seg(2)} /><div className={seg(3)} />
              </div>
              <p className="step-eyebrow">Step {step} of 3</p>
              <h1 className="step-heading">{step === 1 ? 'Name Your Club' : step === 2 ? 'Club Details' : 'Review & Create'}</h1>
              <p className="step-hint">
                {step === 1 ? 'Give your club a name your players will recognize.'
                  : step === 2 ? 'Set who can join, an optional cover photo, and a member limit.'
                    : 'Double-check everything before you create.'}
              </p>
            </div>

            <div className="step-body">
              {step === 1 && (
                <>
                  <div className="field-group">
                    <label className="field-label" htmlFor="club-name">Club Name</label>
                    <input className="field-input" id="club-name" type="text" placeholder="e.g. Neon Smashers" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
                    <span className="field-hint">Keep it short, fun, and memorable.</span>
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="club-desc">Description</label>
                    <textarea className="field-textarea" id="club-desc" placeholder="What's your club about? Skill level, vibe, schedule…" maxLength={280} value={description} onChange={(e) => setDescription(e.target.value)} />
                    <div className="field-footer">
                      <span className="field-hint">Optional — helps players decide to join.</span>
                      <span className="char-count">{description.length} / 280</span>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="section-card">
                    <p className="section-card-title">Visibility</p>
                    <div className="toggle-row" role="group" aria-label="Club visibility">
                      <button className={`toggle-opt${visibility === 'public' ? ' active' : ''}`} aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}>Public</button>
                      <button className={`toggle-opt${visibility === 'private' ? ' active' : ''}`} aria-pressed={visibility === 'private'} onClick={() => setVisibility('private')}>Private</button>
                    </div>
                    <p className="vis-hint">{visibility === 'public' ? 'Anyone can find and join this club.' : 'Only people you approve can join.'}</p>
                  </div>
                  <div className="section-card">
                    <p className="section-card-title">Cover photo — optional</p>
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
                    {coverPreview ? (
                      <div className="relative">
                        <img src={coverPreview} alt="" className="w-full h-32 object-cover rounded-xl" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/55 text-white text-[12px] font-bold">Change</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-24 rounded-xl border border-dashed border-[var(--field-border)] text-[var(--muted)] text-[13px] font-semibold">+ Add a cover photo</button>
                    )}
                  </div>
                  <div className="section-card">
                    <p className="section-card-title">Member limit — optional</p>
                    <input className="field-input" type="number" inputMode="numeric" min={1} placeholder="No limit" value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} />
                    <p className="vis-hint">Leave blank for unlimited members.</p>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="section-card">
                  <p className="section-card-title">Review</p>
                  <div className="perm-row"><div className="perm-label">Name</div><div className="perm-sub">{name || '—'}</div></div>
                  <div className="perm-row"><div className="perm-label">Visibility</div><div className="perm-sub">{visibility === 'public' ? 'Public' : 'Private'}</div></div>
                  <div className="perm-row"><div className="perm-label">Member limit</div><div className="perm-sub">{memberLimit.trim() ? memberLimit.trim() : 'Unlimited'}</div></div>
                  <div className="perm-row"><div className="perm-label">Cover photo</div><div className="perm-sub">{coverFile ? 'Added' : 'None'}</div></div>
                  {description && <div className="perm-row"><div className="perm-label">Description</div><div className="perm-sub">{description}</div></div>}
                </div>
              )}

              {error && <p className="vis-hint" style={{ color: 'var(--warning)' }} role="alert">{error}</p>}
            </div>

            <div className="wizard-footer">
              <button className="btn-prev" onClick={prev} disabled={submitting}>{step === 1 ? 'Cancel' : 'Prev'}</button>
              <button className="btn-next" onClick={next} disabled={submitting}>
                {step < 3 ? 'Next' : submitting ? 'Creating…' : 'Create Club'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
