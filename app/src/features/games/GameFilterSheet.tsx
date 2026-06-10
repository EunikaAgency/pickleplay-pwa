import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import {
  type GameFilters, makeDefaultGameFilters,
  WHEN_OPTIONS, SKILL_OPTIONS, TYPE_OPTIONS,
} from './gameFilters';

interface GameFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: GameFilters;
  onChange: (next: GameFilters) => void;
  /** How many games currently match — shown on the apply button. */
  resultCount: number;
}

export function GameFilterSheet({ open, onClose, value, onChange, resultCount }: GameFilterSheetProps) {
  const set = (patch: Partial<GameFilters>) => onChange({ ...value, ...patch });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter games"
      subtitle="Find your perfect match"
      height="74dvh"
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" fullWidth className="flex-1" onClick={() => onChange(makeDefaultGameFilters())}>
            Reset
          </Button>
          <Button variant="dark" fullWidth className="flex-[2]" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'game' : 'games'}
          </Button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">When</div>
        <div className="flex gap-2 flex-wrap">
          {WHEN_OPTIONS.map((o) => (
            <Chip key={o.value} selected={value.when === o.value} onClick={() => set({ when: o.value })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Skill level</div>
      </div>
      <div className="time-grid">
        {SKILL_OPTIONS.map((s) => (
          <button key={s} className={`time-pick ${value.skill === s ? 'active' : ''}`} onClick={() => set({ skill: s })}>
            {s}
          </button>
        ))}
      </div>

      <div className="field mt-[18px]">
        <div className="lbl">Game type</div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_OPTIONS.map((t) => (
            <Chip key={t.value} selected={value.gameType === t.value} onClick={() => set({ gameType: t.value })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Availability</div>
        <div className="flex gap-2 flex-wrap">
          <Chip selected={value.openings} onClick={() => set({ openings: !value.openings })}>
            Has open spots
          </Chip>
        </div>
      </div>
    </BottomSheet>
  );
}
