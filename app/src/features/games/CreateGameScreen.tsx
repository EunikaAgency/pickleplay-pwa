import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { ProgressBar } from '../../shared/components/ui/ProgressBar';
import type { Navigate } from '../../shared/lib/navigation';

interface CreateGameScreenProps {
  onNavigate: Navigate;
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
      <CompletionScreen
        icon="check"
        title="Game posted!"
        description="Your game is live — players can now join."
        actions={[
          { label: 'View game', variant: 'outline', onClick: () => onNavigate('game-details', { id: 'new' }) },
          { label: 'Invite players', variant: 'dark', onClick: () => onNavigate('invite-players', { id: 'new' }) },
        ]}
      />
    );
  }

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={back}
        backIcon={step === 0 ? 'close' : 'back'}
        eyebrow={`Step ${step + 1} of ${totalSteps}`}
        title={TITLE_BY_STEP[step]}
      />

      <div className="px-5 pb-4">
        <ProgressBar value={(step + 1) / totalSteps} />
      </div>

      {step === 0 && (
        <>
          <div className="field">
            <div className="lbl">Game type</div>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((o) => (
                <button
                  key={o.v}
                  className={`time-pick flex flex-col items-center gap-1 p-3.5! ${type === o.v ? 'active' : ''}`}
                  onClick={() => setType(o.v)}
                >
                  <div>{o.label}</div>
                  <div className="text-[11px] font-semibold opacity-70">{o.sub}</div>
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

          <div className="field mt-4">
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

          <div className="field mt-4">
            <div className="lbl">Start time</div>
          </div>
          <div className="time-grid">
            {TIMES.map((t) => (
              <button key={t} className={`time-pick ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="field mt-4">
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
            <div className="flex flex-col gap-2">
              {COURTS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCourt(c.name)}
                  className={`time-pick text-left px-4! py-3.5! flex items-center gap-3 ${
                    court === c.name ? 'bg-[var(--ink)]! text-white!' : 'bg-[var(--surface)]! text-[var(--ink)]!'
                  }`}
                >
                  <Icon name="location" size={18} />
                  <div className="flex-1">
                    <div className="font-heading font-semibold text-[14px]">{c.name}</div>
                    <div className="text-[11px] opacity-70 font-semibold">{c.meta}</div>
                  </div>
                  {court === c.name && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Spots available · {spots}</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSpots((s) => Math.max(2, s - 1))}
                className="w-11 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] flex items-center justify-center"
              >
                <Icon name="minus" size={16} />
              </button>
              <div className="flex-1 text-center font-heading font-semibold text-[28px] text-[var(--ink)]">
                {spots}
              </div>
              <button
                onClick={() => setSpots((s) => Math.min(16, s + 1))}
                className="w-11 h-11 rounded-xl bg-[var(--ink)] text-white flex items-center justify-center"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Visibility</div>
            <div className="grid grid-cols-2 gap-2">
              <button className={`time-pick ${vis === 'public' ? 'active' : ''}`} onClick={() => setVis('public')}>🌍 Public</button>
              <button className={`time-pick ${vis === 'invite' ? 'active' : ''}`} onClick={() => setVis('invite')}>🔒 Invite only</button>
            </div>
          </div>
        </>
      )}

      <div className="app-action-bar">
        <Button fullWidth onClick={next}>
          {step === totalSteps - 1 ? (
            <>
              <Icon name="bolt" size={18} /> Post game
            </>
          ) : (
            <>
              Continue <Icon name="forward" size={16} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
