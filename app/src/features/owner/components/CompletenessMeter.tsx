import { Icon } from '../../../shared/components/ui/Icon';
import { ProgressBar } from '../../../shared/components/ui/ProgressBar';
import type { OwnerVenueDetail } from '../../../shared/lib/api';

export interface CompletenessCheck {
  label: string;
  done: boolean;
  // Which editor tab fixes this item. Used to deep-link an incomplete check
  // straight to the right tab (e.g. "Hero photo" → Photos).
  tab: string;
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
    { label: 'One-line summary', done: has(v.oneLineSummary), tab: 'listing' },
    { label: 'Full description', done: has(v.description), tab: 'listing' },
    { label: 'Contact phone', done: has(v.phonePrimary) || has(v.phone), tab: 'listing' },
    { label: 'Contact email', done: has(v.email), tab: 'listing' },
    { label: 'Website', done: has(v.website), tab: 'listing' },
    { label: 'Map pin set', done: has(v.lat) && has(v.lng), tab: 'location' },
    { label: 'Pricing from', done: has(v.priceFrom), tab: 'listing' },
    { label: 'At least one amenity', done: anyAmenity, tab: 'listing' },
    { label: 'Highlights / best-for', done: has(v.bestFor) || has(v.whatPlayersLike) || has(v.amenityChips), tab: 'listing' },
    { label: 'Hero photo', done: has(v.mainImageUrl) || has(v.image), tab: 'photos' },
    ...extra,
  ];
}

export function CompletenessMeter({
  venue,
  extra = [],
  onJump,
}: {
  venue: OwnerVenueDetail;
  extra?: CompletenessCheck[];
  // When provided, every incomplete check becomes a tappable nudge that opens the
  // editor tab which fixes it. Without it the meter stays a passive checklist.
  onJump?: (tab: string) => void;
}) {
  const checks = computeChecks(venue, extra);
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  // Surface the incomplete items first so the owner's eye lands on what's left.
  const ordered = [...checks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <div className="hd-3">Listing completeness</div>
        <div className="font-heading font-semibold text-[20px] tabular-nums text-[var(--ink)]">{pct}%</div>
      </div>
      <div className="mt-3">
        <ProgressBar value={done / checks.length} />
      </div>
      <div className="t-sm mt-2">
        {done === checks.length
          ? 'All set — your listing is complete. 🎉'
          : `${done} of ${checks.length} complete — tap anything unfinished to fix it.`}
      </div>
      <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {ordered.map((c) => {
          const Tick = c.done ? (
            <Icon name="check" size={16} className="text-[var(--primary)] shrink-0" />
          ) : (
            <span className="w-4 h-4 rounded-full border-[1.5px] border-[var(--surface-3)] shrink-0" />
          );
          // Done → plain row. Incomplete + onJump → a tappable nudge to its tab.
          if (c.done || !onJump) {
            return (
              <li key={c.label} className={`flex items-center gap-2 text-[13px] ${c.done ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                {Tick}
                {c.label}
              </li>
            );
          }
          return (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => onJump(c.tab)}
                className="w-full flex items-center gap-2 text-[13px] text-left text-[var(--ink)] rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
              >
                {Tick}
                <span className="flex-1 min-w-0 truncate">{c.label}</span>
                <span className="t-sm text-[var(--primary)] font-bold inline-flex items-center gap-0.5 shrink-0">
                  Add <Icon name="chevron" size={14} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
