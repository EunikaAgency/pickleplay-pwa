import { useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';

interface GameFilterSheetProps {
  open: boolean;
  onClose: () => void;
}

export function GameFilterSheet({ open, onClose }: GameFilterSheetProps) {
  const [skill, setSkill] = useState('3.0–3.5');
  const [distance, setDistance] = useState(5);
  const [when, setWhen] = useState('any');
  const [gameType, setGameType] = useState('Doubles');

  const reset = () => {
    setSkill('Any');
    setDistance(5);
    setWhen('any');
    setGameType('Doubles');
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter games"
      subtitle="Find your perfect match"
      height="74dvh"
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" fullWidth className="flex-1" onClick={reset}>
            Reset
          </Button>
          <Button variant="dark" fullWidth className="flex-[2]" onClick={onClose}>
            Show 24 games
          </Button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">When</div>
        <div className="flex gap-2 flex-wrap">
          {['any', 'tonight', 'tomorrow', 'weekend', 'next-week'].map((o) => (
            <Chip key={o} selected={when === o} onClick={() => setWhen(o)}>
              {o[0].toUpperCase() + o.slice(1).replace('-', ' ')}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Your skill level</div>
      </div>
      <div className="time-grid">
        {['Any', 'Beginner', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+'].map((s) => (
          <button key={s} className={`time-pick ${skill === s ? 'active' : ''}`} onClick={() => setSkill(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="field mt-[18px]">
        <div className="lbl">Max distance · {distance} mi</div>
        <input
          type="range"
          min="1"
          max="25"
          value={distance}
          onChange={(e) => setDistance(+e.target.value)}
          className="w-full [accent-color:var(--primary)]"
        />
        <div className="flex justify-between text-[11px] text-[var(--muted)] font-bold">
          <span>1 mi</span>
          <span>25 mi</span>
        </div>
      </div>

      <div className="field">
        <div className="lbl">Game type</div>
        <div className="flex gap-2">
          {['Doubles', 'Singles', 'Open Play'].map((t) => (
            <Chip key={t} selected={gameType === t} onClick={() => setGameType(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Features</div>
        <div className="flex gap-2 flex-wrap">
          {['Beginner friendly', 'Indoor', 'Has openings', 'Verified host', 'Free'].map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
