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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < 3) setStep(step + 1);
    else setSubmitted(true);
  };

  const back = () => (step > 1 ? setStep(step - 1) : onBack());

  if (submitted) {
    return (
      <div
        className="scroll safe-top safe-bottom"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 999,
            background: 'var(--lime)',
            color: 'var(--lime-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            boxShadow: 'var(--shadow-fab)',
          }}
        >
          <Icon name="check" size={42} />
        </div>
        <h2 className="hd-1" style={{ marginBottom: 6 }}>Club created!</h2>
        <p className="t-sm" style={{ maxWidth: 320 }}>Your new club is live. Start inviting members.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, width: '100%', maxWidth: 360 }}>
          <button className="btn-primary outline" style={{ margin: 0, width: '100%', flex: 1 }} onClick={() => onNavigate('club-details', { id: 'new' })}>
            View club
          </button>
          <button className="btn-primary dark" style={{ margin: 0, width: '100%', flex: 1 }} onClick={() => onBack()}>
            Invite members
          </button>
        </div>
      </div>
    );
  }

  const titles = ['Name your club', 'Club details', 'Review & create'];

  return (
    <div className="scroll" style={{ paddingBottom: 100, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={back}
          aria-label={step === 1 ? 'Close' : 'Back'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={step === 1 ? 'close' : 'back'} size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="t-eyebrow">Step {step} of 3</div>
          <div className="hd-2" style={{ marginTop: 2 }}>{titles[step - 1]}</div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / 3) * 100}%`, background: 'var(--lime)', borderRadius: 2 }} />
        </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" className={`time-pick ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>🌍 Public</button>
                <button type="button" className={`time-pick ${visibility === 'private' ? 'active' : ''}`} onClick={() => setVisibility('private')}>🔒 Private</button>
              </div>
            </div>

            <div className="field">
              <div className="lbl">Skill range</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
          <div className="about-card" style={{ margin: '0 20px' }}>
            <div>
              <div className="t-eyebrow">Club name</div>
              <div className="hd-3" style={{ marginTop: 4 }}>{name || '—'}</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="t-eyebrow">Description</div>
              <p style={{ marginTop: 4 }}>{description || '—'}</p>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="t-eyebrow">Visibility</div>
                <div className="hd-3" style={{ marginTop: 4, textTransform: 'capitalize' }}>{visibility}</div>
              </div>
              <div>
                <div className="t-eyebrow">Skill range</div>
                <div className="hd-3" style={{ marginTop: 4 }}>
                  {skillMin === 'all' ? 'All' : skillMin} – {skillMax === 'all' ? 'All' : skillMax}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="app-action-bar">
          <button
            type="submit"
            disabled={step === 1 && !name}
            className="btn-primary"
            style={{ margin: 0, width: '100%' }}
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
          </button>
        </div>
      </form>
    </div>
  );
}
