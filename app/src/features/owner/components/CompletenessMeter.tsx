import { Icon } from '../../../shared/components/ui/Icon';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import type { OwnerVenueDetail } from '../../../shared/lib/api';

export interface CompletenessCheck {
  label: string;
  done: boolean;
}

// "Complete your listing" checklist. Mirrors the web CompletenessMeter; callers
// pass `extra` checks for sub-resources they've already loaded (courts, hours,
// FAQs) so the meter reflects the whole listing.
function computeChecks(v: OwnerVenueDetail, extra: CompletenessCheck[]): CompletenessCheck[] {
  const has = (x: unknown) => x != null && x !== '' && !(Array.isArray(x) && x.length === 0);
  const anyAmenity = [
    v.hasOpenPlay, v.hasCoaching, v.hasCourtRental, v.isBeginnerFriendly,
    v.hasParking, v.hasToilets, v.hasShowers, v.hasFoodBeverage, v.hasAc,
    v.hasLighting, v.hasSeating, v.hasPaddleRental, v.hasProShop,
  ].some(Boolean);

  return [
    { label: 'One-line summary', done: has(v.oneLineSummary) },
    { label: 'Full description', done: has(v.description) },
    { label: 'Contact phone', done: has(v.phonePrimary) || has(v.phone) },
    { label: 'Contact email', done: has(v.email) },
    { label: 'Website', done: has(v.website) },
    { label: 'Map pin set', done: has(v.lat) && has(v.lng) },
    { label: 'Pricing from', done: has(v.priceFrom) },
    { label: 'At least one amenity', done: anyAmenity },
    { label: 'Highlights / best-for', done: has(v.bestFor) || has(v.whatPlayersLike) || has(v.amenityChips) },
    { label: 'Hero photo', done: has(v.mainImageUrl) || has(v.image) },
    ...extra,
  ];
}

export function CompletenessMeter({ venue, extra = [] }: { venue: OwnerVenueDetail; extra?: CompletenessCheck[] }) {
  const checks = computeChecks(venue, extra);
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <div className="hd-3">Listing completeness</div>
        <div className="font-heading font-semibold text-[20px] tabular-nums text-[var(--ink)]">{pct}%</div>
      </div>
      <div className="mt-3">
        <ProgressBar value={done / checks.length} />
      </div>
      <div className="t-sm mt-2">{done} of {checks.length} complete — a fuller listing converts more players.</div>
      <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-2 text-[13px] ${c.done ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
            {c.done ? (
              <Icon name="check" size={16} className="text-[var(--primary)] shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full border-[1.5px] border-[var(--surface-3)] shrink-0" />
            )}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
