import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { Toast } from '../../shared/components/ui/Toast';
import { Chip } from '../../shared/components/ui/Chip';
import { FormField } from '../../shared/components/forms/FormField';
import { FormSelect } from '../../shared/components/forms/FormSelect';
import { OwnerSection } from './OwnerSection';
import { updateVenue, type OwnerVenueDetail } from '../../shared/lib/api';

interface ListingEditorTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  reload: () => void;
}

// Amenity booleans. Keys match the API venue document (and the web ListingEditor).
const AMENITIES: { key: keyof OwnerVenueDetail; label: string }[] = [
  { key: 'hasCourtRental', label: 'Court rental' },
  { key: 'hasOpenPlay', label: 'Open play' },
  { key: 'hasCoaching', label: 'Coaching' },
  { key: 'isBeginnerFriendly', label: 'Beginner friendly' },
  { key: 'hasParking', label: 'Parking' },
  { key: 'hasToilets', label: 'Toilets' },
  { key: 'hasShowers', label: 'Showers' },
  { key: 'hasFoodBeverage', label: 'Food & beverage' },
  { key: 'hasAc', label: 'Air conditioning' },
  { key: 'hasLighting', label: 'Lighting' },
  { key: 'hasSeating', label: 'Seating' },
  { key: 'hasPaddleRental', label: 'Paddle rental' },
  { key: 'hasProShop', label: 'Pro shop' },
];

const IO_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];

const str = (v: unknown) => (v == null ? '' : String(v));

// A chip list you can add to / remove from — the app analog of the web TagInput.
function TagField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="field p-0!">
      <label className="lbl">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.length === 0 && <span className="t-sm">None yet.</span>}
        {value.map((t) => (
          <span key={t} className="chip active gap-1.5">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="control"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add and press Enter"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ListingEditorTab({ venue, venueId, reload }: ListingEditorTabProps) {
  const [form, setForm] = useState({
    displayName: str(venue.displayName),
    oneLineSummary: str(venue.oneLineSummary),
    description: str(venue.description),
    indoorOutdoor: str(venue.indoorOutdoor),
    surfaceType: str(venue.surfaceType),
    phone: str(venue.phonePrimary ?? venue.phone),
    email: str(venue.email),
    website: str(venue.website),
    bookingUrl: str(venue.bookingUrl),
    priceFrom: str(venue.priceFrom),
    peakPrice: str(venue.peakPrice),
    offPeakPrice: str(venue.offPeakPrice),
    openPlayPrice: str(venue.openPlayPrice),
    equipmentRentalPrice: str(venue.equipmentRentalPrice),
    priceNotes: str(venue.priceNotes),
  });
  const [amenities, setAmenities] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AMENITIES.map((a) => [a.key as string, Boolean(venue[a.key])] as [string, boolean])),
  );
  const [chips, setChips] = useState({
    bestFor: venue.bestFor ?? [],
    whatPlayersLike: venue.whatPlayersLike ?? [],
    amenityChips: venue.amenityChips ?? [],
    thingsToKnow: venue.thingsToKnow ?? [],
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus('idle');
  };

  const onSave = async () => {
    setStatus('saving');
    try {
      // courtCount is intentionally NOT sent — the API derives it from the
      // courts managed on the Courts tab.
      await updateVenue(venueId, { ...form, ...chips, ...amenities });
      setStatus('saved');
      reload();
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <OwnerSection title="Identity" icon="edit" description="How your venue appears across PickleBallers.">
        <div className="space-y-3.5">
          <FormField label="Venue name" value={form.displayName} maxLength={200} onChange={(e) => set('displayName')(e.target.value)} />
          <FormField
            label="One-line summary"
            hint="A short hook shown in search results."
            value={form.oneLineSummary}
            maxLength={255}
            onChange={(e) => set('oneLineSummary')(e.target.value)}
          />
          <div className="field p-0!">
            <label className="lbl">Description</label>
            <textarea className="control" rows={5} value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Indoor / outdoor" options={IO_OPTIONS} value={form.indoorOutdoor} onChange={(e) => set('indoorOutdoor')(e.target.value)} />
            <FormField label="Surface type" placeholder="hard, wood…" value={form.surfaceType} maxLength={50} onChange={(e) => set('surfaceType')(e.target.value)} />
          </div>
          <div className="field p-0!">
            <label className="lbl">Court count</label>
            <div className="control flex items-center text-[var(--muted)]">
              {Number(venue.courtCount) || 0} {Number(venue.courtCount) === 1 ? 'court' : 'courts'} · managed on the Courts tab
            </div>
          </div>
        </div>
      </OwnerSection>

      <OwnerSection title="Contact & booking" icon="message">
        <div className="space-y-3.5">
          <FormField label="Phone" value={form.phone} maxLength={20} onChange={(e) => set('phone')(e.target.value)} />
          <FormField label="Email" type="email" value={form.email} maxLength={255} onChange={(e) => set('email')(e.target.value)} />
          <FormField label="Website" placeholder="https://" value={form.website} onChange={(e) => set('website')(e.target.value)} />
          <FormField label="Booking link" hint="Where players reserve a court." placeholder="https://" value={form.bookingUrl} onChange={(e) => set('bookingUrl')(e.target.value)} />
        </div>
      </OwnerSection>

      <OwnerSection title="Pricing" icon="bolt" description="Display pricing in PHP — shown on your public page, not charged.">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From" placeholder="200" value={form.priceFrom} onChange={(e) => set('priceFrom')(e.target.value)} />
          <FormField label="Peak" value={form.peakPrice} onChange={(e) => set('peakPrice')(e.target.value)} />
          <FormField label="Off-peak" value={form.offPeakPrice} onChange={(e) => set('offPeakPrice')(e.target.value)} />
          <FormField label="Open play" value={form.openPlayPrice} onChange={(e) => set('openPlayPrice')(e.target.value)} />
          <FormField label="Equipment rental" value={form.equipmentRentalPrice} onChange={(e) => set('equipmentRentalPrice')(e.target.value)} />
        </div>
        <div className="field p-0! mt-3.5">
          <label className="lbl">Pricing notes</label>
          <textarea className="control" rows={2} value={form.priceNotes} onChange={(e) => set('priceNotes')(e.target.value)} />
        </div>
      </OwnerSection>

      <OwnerSection title="Amenities" icon="check" description="Tap what your venue offers.">
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const on = amenities[a.key as string];
            return (
              <Chip
                key={a.key as string}
                selected={on}
                onClick={() => {
                  setAmenities((m) => ({ ...m, [a.key as string]: !m[a.key as string] }));
                  setStatus('idle');
                }}
              >
                {on && <Icon name="check" size={12} />}
                {a.label}
              </Chip>
            );
          })}
        </div>
      </OwnerSection>

      <OwnerSection title="Highlights" icon="star" description="Curated chips shown on your listing.">
        <div className="space-y-3.5">
          <TagField label="Best for" value={chips.bestFor} onChange={(v) => { setChips((c) => ({ ...c, bestFor: v })); setStatus('idle'); }} />
          <TagField label="What players like" value={chips.whatPlayersLike} onChange={(v) => { setChips((c) => ({ ...c, whatPlayersLike: v })); setStatus('idle'); }} />
          <TagField label="Amenity chips" value={chips.amenityChips} onChange={(v) => { setChips((c) => ({ ...c, amenityChips: v })); setStatus('idle'); }} />
          <TagField label="Things to know" value={chips.thingsToKnow} onChange={(v) => { setChips((c) => ({ ...c, thingsToKnow: v })); setStatus('idle'); }} />
        </div>
      </OwnerSection>

      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold text-center">Couldn't save. Try again.</div>}
      <Button fullWidth onClick={onSave} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Saved</> : 'Save changes'}
      </Button>

      <Toast message="Listing saved" show={status === 'saved'} />
    </div>
  );
}
