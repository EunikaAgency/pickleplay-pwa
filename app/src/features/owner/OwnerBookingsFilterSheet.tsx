import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Button } from '../../shared/components/ui/Button';
import { Chip } from '../../shared/components/ui/Chip';
import { Icon } from '../../shared/components/ui/Icon';
import { locationLine, venueImage, venueTags } from '../../shared/lib/venueDisplay';
import type { ApiVenue } from '../../shared/lib/api';

export type SortBy = 'date' | 'booked';
export type StatusFilter = 'all' | 'pending_approval' | 'confirmed' | 'cancelled';

const CARD_GRADIENT = 'linear-gradient(135deg, #0040e0, #6c83ff)';

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'date', label: 'Play date' },
  { id: 'booked', label: 'Recently booked' },
];
const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'confirmed', label: 'Complete' },
  { id: 'cancelled', label: 'Cancelled' },
];

interface OwnerBookingsFilterSheetProps {
  open: boolean;
  onClose: () => void;
  venues: ApiVenue[];
  venueFilter: string;
  onVenueChange: (venueId: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  /** Reset everything in the sheet to defaults. */
  onReset: () => void;
  /** Count of bookings matching the current selection — shown on the apply button. */
  resultCount: number;
}

// A selectable venue card, styled like the player Nearby list rows (.court-row).
function VenueOption({ venue, selected, onSelect }: { venue: ApiVenue; selected: boolean; onSelect: () => void }) {
  const img = venueImage(venue);
  const tags = venueTags(venue).slice(0, 3);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`court-row ${selected ? 'bg-[var(--lime-soft)] border-[0.5px] border-[rgba(193,241,0,0.5)]' : 'bg-[var(--surface-2)] border-[0.5px] border-transparent'}`}
    >
      <div
        className="img flex items-center justify-center text-white overflow-hidden"
        style={img ? { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: CARD_GRADIENT }}
      >
        {!img && <Icon name="paddle" size={24} />}
      </div>
      <div className="body">
        <div className="title">{venue.displayName}</div>
        <div className="row1">
          {locationLine(venue) || '—'}
          <span className="opacity-50">·</span>
          {venue.courtCount ?? 0} court{venue.courtCount === 1 ? '' : 's'}
        </div>
        {tags.length > 0 && (
          <div className="tags">
            {tags.map((t) => (
              <span key={t} className="t">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-[var(--primary)] text-white' : 'border-[1.5px] border-[var(--hairline)] text-transparent'}`}>
        <Icon name="check" size={15} />
      </div>
    </button>
  );
}

// Filters for the owner bookings inbox: sort order, status, and a venue picker.
// Lives in a bottom sheet so it stays out of the way until opened (the When
// buckets are the primary inline tabs on the screen).
export function OwnerBookingsFilterSheet({
  open, onClose, venues, venueFilter, onVenueChange, status, onStatusChange, sortBy, onSortChange, onReset, resultCount,
}: OwnerBookingsFilterSheetProps) {
  const totalCourts = venues.reduce((sum, v) => sum + (v.courtCount ?? 0), 0);
  const allSelected = venueFilter === 'all';
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filter & sort"
      subtitle="Order your bookings and narrow them down."
      sheetClassName="sheet-anim-height"
      flushFooter
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" fullWidth className="flex-1" onClick={onReset}>
            Reset
          </Button>
          <Button variant="dark" fullWidth className="flex-[2]" onClick={onClose}>
            Show {resultCount} booking{resultCount === 1 ? '' : 's'}
          </Button>
        </div>
      }
    >
      <div className="field">
        <div className="lbl">Sort by</div>
        <div className="flex gap-2 flex-wrap">
          {SORT_OPTIONS.map((o) => (
            <Chip key={o.id} selected={sortBy === o.id} onClick={() => onSortChange(o.id)}>{o.label}</Chip>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="lbl">Status</div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((o) => (
            <Chip key={o.id} selected={status === o.id} onClick={() => onStatusChange(o.id)}>{o.label}</Chip>
          ))}
        </div>
      </div>

      {venues.length > 1 && (
        <div className="field">
          <div className="lbl">Venue</div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onVenueChange('all')}
              aria-pressed={allSelected}
              className={`court-row ${allSelected ? 'bg-[var(--lime-soft)] border-[0.5px] border-[rgba(193,241,0,0.5)]' : 'bg-[var(--surface-2)] border-[0.5px] border-transparent'}`}
            >
              <div className="img flex items-center justify-center text-white" style={{ background: CARD_GRADIENT }}>
                <Icon name="storefront" size={24} />
              </div>
              <div className="body">
                <div className="title">All venues</div>
                <div className="row1">
                  {venues.length} venue{venues.length === 1 ? '' : 's'}
                  <span className="opacity-50">·</span>
                  {totalCourts} court{totalCourts === 1 ? '' : 's'}
                </div>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${allSelected ? 'bg-[var(--primary)] text-white' : 'border-[1.5px] border-[var(--hairline)] text-transparent'}`}>
                <Icon name="check" size={15} />
              </div>
            </button>

            {venues.map((v) => (
              <VenueOption key={v.id} venue={v} selected={venueFilter === v.id} onSelect={() => onVenueChange(v.id)} />
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
