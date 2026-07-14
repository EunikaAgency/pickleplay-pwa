import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { CalendarDatePicker } from '../../shared/components/ui/CalendarDatePicker';
import { Chip } from '../../shared/components/ui/Chip';
import {
  type GameFilters, makeDefaultGameFilters,
  WHEN_OPTIONS, SKILL_OPTIONS, TYPE_OPTIONS, GENDER_OPTIONS, RADIUS_OPTIONS,
} from './gameFilters';

interface GameFilterSheetProps {
  open: boolean;
  onClose: () => void;
  value: GameFilters;
  onChange: (next: GameFilters) => void;
  /** How many plays currently match — shown on the apply button. */
  resultCount: number;
  /** Offer the distance filter. Off for surfaces with no location (the legacy v1
   *  screen), on for the Play tab once the user has shared theirs. */
  showRadius?: boolean;
  /** Narrow the play-type choices — the Events section holds no open-play games,
   *  so offering that option there guarantees an empty result. */
  typeOptions?: typeof TYPE_OPTIONS;
}

/** Today as YYYY-MM-DD in local time (not toISOString, which is UTC and would shift
 *  the day in a +offset timezone — the same rule the API's date fields follow). */
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GameFilterSheet({ open, onClose, value, onChange, resultCount, showRadius = false, typeOptions = TYPE_OPTIONS }: GameFilterSheetProps) {
  const set = (patch: Partial<GameFilters>) => onChange({ ...value, ...patch });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter plays"
      subtitle="Find your perfect match"
      height="74dvh"
      footer={
        <div className="flex gap-2.5">
          {/* Reset clears distance too — it is a filter here, not a preference. */}
          <Button variant="outline" fullWidth className="flex-1" onClick={() => onChange(makeDefaultGameFilters())}>
            Reset
          </Button>
          <Button variant="dark" fullWidth className="flex-[2]" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'play' : 'plays'}
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
        {value.when === 'custom' && (
          <div className="mt-3">
            {/* Past days are disabled: the feed only ever contains upcoming plays,
                so a past date could only ever return nothing. */}
            <CalendarDatePicker
              value={value.customDate ?? ''}
              min={todayYmd()}
              onChange={(ymd) => set({ customDate: ymd })}
            />
          </div>
        )}
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
        <div className="lbl">Play type</div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map((t) => (
            <Chip key={t.value} selected={value.gameType === t.value} onClick={() => set({ gameType: t.value })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field mt-[18px]">
        <div className="lbl">Who can play</div>
        <div className="flex gap-2 flex-wrap">
          {GENDER_OPTIONS.map((g) => (
            <Chip key={g.value} selected={value.genderPolicy === g.value} onClick={() => set({ genderPolicy: g.value })}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>

      {showRadius && (
        <div className="field">
          <div className="lbl">Distance</div>
          <div className="flex gap-2 flex-wrap">
            {RADIUS_OPTIONS.map((r) => (
              <Chip key={r.label} selected={value.radiusKm === r.value} onClick={() => set({ radiusKm: r.value })}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

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
