import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import { AMENITY_OPTIONS, MIN_DISTANCE_MI, MAX_DISTANCE_MI, makeDefaultFilters, type VenueFilters } from './venueFilters';

interface NearbyFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: VenueFilters;
  onChange: (next: VenueFilters) => void;
  /** Count of courts matching the current filters — shown on the apply button. */
  resultCount: number;
  /** Whether the user has shared their location (enables the distance cap). */
  located: boolean;
}

export function NearbyFilterSheet({ open, onClose, filters, onChange, resultCount, located }: NearbyFilterSheetProps) {
  const toggleAmenity = (key: string) => {
    const amenities = new Set(filters.amenities);
    if (amenities.has(key)) amenities.delete(key);
    else amenities.add(key);
    onChange({ ...filters, amenities });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter courts"
      subtitle="Pick your kind of court."
      height="74dvh"
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" fullWidth className="flex-1" onClick={() => onChange(makeDefaultFilters())}>
            Reset
          </Button>
          <Button variant="dark" fullWidth className="flex-[2]" onClick={onClose}>
            Show {resultCount} court{resultCount === 1 ? '' : 's'}
          </Button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">Court type</div>
        <div className="flex gap-2 flex-wrap">
          {(['All', 'Indoor', 'Outdoor'] as const).map((o) => (
            <Chip key={o} selected={filters.courtType === o} onClick={() => onChange({ ...filters, courtType: o })}>
              {o}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Price</div>
        <div className="flex gap-2 flex-wrap">
          {(['Any', 'Free', 'Paid'] as const).map((o) => (
            <Chip key={o} selected={filters.price === o} onClick={() => onChange({ ...filters, price: o })}>
              {o}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Open play</div>
        <div className="flex gap-2 flex-wrap">
          <Chip selected={filters.openPlay} onClick={() => onChange({ ...filters, openPlay: !filters.openPlay })}>
            Hosts games / open play
          </Chip>
        </div>
      </div>

      <div className="field">
        <div className="lbl">Within {filters.maxDistanceMi} mi</div>
        <input
          type="range"
          min={MIN_DISTANCE_MI}
          max={MAX_DISTANCE_MI}
          value={filters.maxDistanceMi}
          onChange={(e) => onChange({ ...filters, maxDistanceMi: +e.target.value })}
          className="w-full [accent-color:var(--primary)]"
        />
        <div className="flex justify-between text-[11px] text-[var(--muted)] font-bold">
          <span>{MIN_DISTANCE_MI} mi</span>
          <span>{MAX_DISTANCE_MI} mi</span>
        </div>
        <div className="mt-1 text-[11px] text-[var(--muted)] font-semibold">
          {located
            ? 'Showing courts within this radius of you.'
            : 'Tap “Near me” to use your location and this radius.'}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Amenities</div>
        <div className="flex gap-2 flex-wrap">
          {AMENITY_OPTIONS.map((a) => (
            <Chip key={a.key} selected={filters.amenities.has(a.key)} onClick={() => toggleAmenity(a.key)}>
              {a.label}
            </Chip>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
