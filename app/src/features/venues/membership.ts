// Venue membership plans + helpers (kept out of the sheet component so the
// component file only exports components — react-refresh / vertical-slice convention,
// mirroring venueFilters.ts).
//
// These are the default subscription tiers every venue offers — generic (work for
// any venue), prices render in the venue's currency. The plan id the player picks
// is stored as the VenueMember `tier`. Joining/cancelling persists server-side via
// joinVenueMembership/leaveVenueMembership (CourtDetailsScreen) — it surfaces in the
// owner's Members tab and applies the venue's member discount at checkout. (Per-plan
// perks like "20% off" are still illustrative; the actual discount is the venue's
// single memberDiscountPercent.)

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  /** Compact cadence shown after the price, e.g. "mo". */
  cadence: string;
  /** Long cadence shown under the price, e.g. "billed monthly". */
  cadenceLabel: string;
  tagline: string;
  perks: string[];
  /** The recommended plan — highlighted with a "Popular" badge. */
  featured?: boolean;
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 299,
    cadence: 'mo',
    cadenceLabel: 'billed monthly',
    tagline: 'Play more, pay less — month to month.',
    perks: ['10% off every court booking', 'Member-only booking slots', 'Cancel anytime'],
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: 799,
    cadence: '3 mo',
    cadenceLabel: 'billed every 3 months',
    tagline: 'Our most popular plan.',
    featured: true,
    perks: [
      '20% off every court booking',
      'Priority booking up to 14 days ahead',
      '1 free open-play session each month',
      'Bring a guest at the member rate',
    ],
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 2499,
    cadence: 'yr',
    cadenceLabel: 'billed yearly',
    tagline: 'Best value for regulars.',
    perks: [
      '30% off every court booking',
      'Priority booking up to 30 days ahead',
      '4 free open-play sessions each month',
      'Free equipment rental',
      'Invites to members-only events',
    ],
  },
];

export function planById(id: string | null | undefined): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((p) => p.id === id);
}
