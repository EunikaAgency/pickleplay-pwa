import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface CreateGameScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
}

const TYPES = [
  { v: 'singles', label: 'Singles', sub: '1 vs 1' },
  { v: 'doubles', label: 'Doubles', sub: '2 vs 2' },
  { v: 'open',    label: 'Open',    sub: 'Mix-in' },
] as const;

const SKILLS = ['Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+', 'Open'];
const WHEN   = ['Tonight', 'Tomorrow', 'This weekend', 'Next week', 'Custom', 'Recurring'];
const TIMES  = ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM'];
const COURTS = [
  { name: 'Riverside Courts', meta: '1.2 mi · Public' },
  { name: 'Central Hub',      meta: '0.8 mi · Indoor' },
  { name: 'The Pickle Lodge', meta: '4.1 mi · Club' },
];

const TITLE_BY_STEP = ['What kind of game?', 'When are you playing?', 'Where & who?'];

export function CreateGameScreen({ onNavigate, onBack }: CreateGameScreenProps) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [type, setType] = useState<typeof TYPES[number]['v']>('doubles');
  const [skill, setSkill] = useState('3.0–3.5');
  const [when, setWhen] = useState('Tonight');
  const [time, setTime] = useState('6:30 PM');
  const [court, setCourt] = useState(COURTS[0].name);
  const [spots, setSpots] = useState(4);
  const [vis, setVis] = useState<'public' | 'invite'>('public');

  const totalSteps = 3;
  const back = () => (step > 0 ? setStep((s) => s - 1) : onBack());
  const next = () => (step < totalSteps - 1 ? setStep((s) => s + 1) : setDone(true));

  if (done) {
    return (
      <div className="scroll safe-top safe-bottom" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
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
        <h2 className="hd-1" style={{ marginBottom: 6 }}>Game posted!</h2>
        <p className="t-sm" style={{ maxWidth: 320 }}>Your game is live — players can now join.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, width: '100%', maxWidth: 360 }}>
          <button className="btn-primary outline" style={{ margin: 0, width: '100%', flex: 1 }} onClick={() => onNavigate('game-details', { id: 'new' })}>
            View game
          </button>
          <button className="btn-primary dark" style={{ margin: 0, width: '100%', flex: 1 }} onClick={() => onNavigate('invite-players', { id: 'new' })}>
            Invite players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ paddingBottom: 100, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      {/* Header */}
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={back}
          aria-label={step === 0 ? 'Close' : 'Back'}
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
          <Icon name={step === 0 ? 'close' : 'back'} size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="t-eyebrow">Step {step + 1} of {totalSteps}</div>
          <div className="hd-2" style={{ marginTop: 2 }}>{TITLE_BY_STEP[step]}</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${((step + 1) / totalSteps) * 100}%`,
              background: 'var(--lime)',
              transition: 'width .3s ease',
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {step === 0 && (
        <>
          <div className="field">
            <div className="lbl">Game type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {TYPES.map((o) => (
                <button
                  key={o.v}
                  className={`time-pick ${type === o.v ? 'active' : ''}`}
                  onClick={() => setType(o.v)}
                  style={{ flexDirection: 'column', padding: 14, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <div>{o.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Skill level (DUPR)</div>
          </div>
          <div className="time-grid">
            {SKILLS.map((s) => (
              <button key={s} className={`time-pick ${skill === s ? 'active' : ''}`} onClick={() => setSkill(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <div className="lbl">Game name (optional)</div>
            <input className="control" placeholder="e.g. Friday Night Dinks" />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="field">
            <div className="lbl">When</div>
          </div>
          <div className="time-grid">
            {WHEN.map((s) => (
              <button key={s} className={`time-pick ${when === s ? 'active' : ''}`} onClick={() => setWhen(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <div className="lbl">Start time</div>
          </div>
          <div className="time-grid">
            {TIMES.map((t) => (
              <button key={t} className={`time-pick ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <div className="lbl">Duration</div>
          </div>
          <div className="time-grid">
            {['1 hr', '1.5 hr', '2 hr', '3 hr'].map((d) => (
              <button key={d} className={`time-pick ${d === '2 hr' ? 'active' : ''}`}>{d}</button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="field">
            <div className="lbl">Court</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COURTS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCourt(c.name)}
                  className="time-pick"
                  style={{
                    textAlign: 'left',
                    background: court === c.name ? 'var(--ink)' : 'var(--surface)',
                    color: court === c.name ? 'white' : 'var(--ink)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Icon name="location" size={18} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{c.meta}</div>
                  </div>
                  {court === c.name && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Spots available · {spots}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setSpots((s) => Math.max(2, s - 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '0.5px solid var(--hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="minus" size={16} />
              </button>
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  fontSize: 28,
                  color: 'var(--ink)',
                }}
              >
                {spots}
              </div>
              <button
                onClick={() => setSpots((s) => Math.min(16, s + 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--ink)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Visibility</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className={`time-pick ${vis === 'public' ? 'active' : ''}`} onClick={() => setVis('public')}>🌍 Public</button>
              <button className={`time-pick ${vis === 'invite' ? 'active' : ''}`} onClick={() => setVis('invite')}>🔒 Invite only</button>
            </div>
          </div>
        </>
      )}

      <div className="app-action-bar">
        <button
          onClick={next}
          className="btn-primary"
          style={{ margin: 0, width: '100%' }}
        >
          {step === totalSteps - 1 ? (
            <>
              <Icon name="bolt" size={18} /> Post game
            </>
          ) : (
            <>
              Continue <Icon name="forward" size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
