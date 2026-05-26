import { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Chip } from '../ui/Chip';

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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary outline" style={{ margin: 0, width: '100%', flex: 1 }} onClick={reset}>
            Reset
          </button>
          <button className="btn-primary dark" style={{ margin: 0, width: '100%', flex: 2 }} onClick={onClose}>
            Show 24 games
          </button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">When</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <div className="field" style={{ marginTop: 18 }}>
        <div className="lbl">Max distance · {distance} mi</div>
        <input
          type="range"
          min="1"
          max="25"
          value={distance}
          onChange={(e) => setDistance(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
          <span>1 mi</span>
          <span>25 mi</span>
        </div>
      </div>

      <div className="field">
        <div className="lbl">Game type</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Doubles', 'Singles', 'Open Play'].map((t) => (
            <Chip key={t} selected={gameType === t} onClick={() => setGameType(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Features</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Beginner friendly', 'Indoor', 'Has openings', 'Verified host', 'Free'].map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
