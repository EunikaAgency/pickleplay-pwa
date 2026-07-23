// Pickleballers API — The full-seed pipeline, as data.
//
// WHY THIS FILE EXISTS
// Seeding used to be eleven standalone `tsx` scripts run by hand, in an order
// that lived only in people's heads (CSV import before users, users before the
// scripts that look owners up by a hardcoded email, and so on). Getting it wrong
// produces a half-populated database that looks fine until a screen is empty.
//
// The order below is the dependency chain, written down once. Both consumers —
// the admin console (`features/data-ops`) and the CLI (`run-pipeline.ts`) —
// read THIS array, so the dashboard can never drift from the terminal.
//
// Each step runs as its own child process (`tsx <script>`): every one of these
// files ends in `mongoose.disconnect()` + `process.exit(0)`, so importing them
// into a running server would tear down the shared connection and kill the API.

export interface SeedStep {
  /** Stable id the client sends back to run a subset. */
  key: string;
  label: string;
  /** Path relative to the api root. */
  script: string;
  args?: string[];
  /** Reaches the public internet — will fail on an offline host. */
  network?: boolean;
  /** Why the step sits at this position; shown in the admin console. */
  why: string;
}

export const SEED_PIPELINE: SeedStep[] = [
  {
    key: 'import',
    label: 'Import real venue + coach data',
    script: 'src/shared/db/import-real-data.ts',
    why: 'The base directory from real-data/handoff/*.csv — cities, venues, venue hours, courts, coaches, pricing. Everything downstream references these rows.',
  },
  {
    key: 'users',
    label: 'Seed dummy users',
    script: 'src/shared/db/seed-dummy-users.ts',
    network: true,
    why: 'Coach / owner / organizer / player accounts. Needs the Coach + Venue rows from the import, and fetches profiles from randomuser.me.',
  },
  {
    key: 'test-credentials',
    label: 'Restore documented test accounts',
    script: 'src/shared/db/restore-test-credentials.ts',
    why: 'Upserts the fixed accounts from web/TEST_CREDENTIALS.txt — the admin, and the two test owners whose emails are hardcoded in every step below.',
  },
  {
    key: 'batangas',
    label: 'Seed Batangas demo venues',
    script: 'src/shared/db/seed-batangas-venues.ts',
    why: '16 demo venues split 8/8 between the two test owners restored by the previous step.',
  },
  {
    key: 'dummy-data',
    label: 'Fill empty collections',
    script: 'src/shared/db/seed-dummy-data.ts',
    why: 'Seeds every collection that is still empty (~60 rows each), reusing the cities / venues / coaches / users above as foreign keys.',
  },
  {
    key: 'games',
    label: 'Seed a realistic week of games',
    script: 'src/shared/db/seed-realistic-games.ts',
    args: ['--apply'],
    why: 'Seeds the Game model the app actually reads (with a real host, court booking and roster) — not the retired OpenPlaySession the step above fills.',
  },
  {
    key: 'pricing-overrides',
    label: 'Seed owner pricing overrides',
    script: 'src/shared/db/seed-owner-pricing-overrides.ts',
    why: 'Per-day slot pricing across the two test owners’ venues, so the owner Pricing screen and the booking flow both have real rates.',
  },
  {
    key: 'shop-partners',
    label: 'Seed shop inventory + partner applications',
    script: 'src/shared/db/seed-owner-shop-partners.ts',
    why: 'Rental stock and coach/organizer applications behind the two owner-console screens that would otherwise be empty.',
  },
  {
    key: 'coach-subscribers',
    label: 'Seed coach subscribers',
    script: 'src/shared/db/seed-coach-subscribers.ts',
    why: 'Players with a complete address and an active coach partner-subscription — what the real subscribe flow produces, seeded.',
  },
  {
    key: 'partner-roles',
    label: 'Convert partner roles to subscriptions',
    script: 'src/shared/db/partner-roles-to-subscriptions.ts',
    why: 'Coach / organizer stopped being roles; this moves any seeded role grants onto the paid-subscription model the app gates on.',
  },
  {
    key: 'quick-logins',
    label: 'Align quick-login accounts',
    script: 'src/shared/db/align-quick-login-partners.ts',
    why: 'Gives each quick-login button exactly one plan, so a reviewer can open one partner surface at a time. Locked to TEST_ACCOUNTS in the app login screen.',
  },
  {
    key: 'receipts',
    label: 'Seed official receipts',
    script: 'src/shared/db/seed-official-receipts.ts',
    args: ['--apply'],
    why: 'Mints BIR receipts for bookings that already carry a Payment, so the owner Finance & Receipts screen has real data instead of its empty state.',
  },
];

export const SEED_STEP_KEYS = SEED_PIPELINE.map((s) => s.key);

/** Resolve a caller-supplied subset, preserving pipeline order. Unknown keys
 *  are returned separately so the caller can reject rather than silently skip. */
export function selectSteps(keys?: string[] | null): { steps: SeedStep[]; unknown: string[] } {
  if (!keys?.length) return { steps: SEED_PIPELINE, unknown: [] };
  const wanted = new Set(keys);
  const unknown = keys.filter((k) => !SEED_STEP_KEYS.includes(k));
  return { steps: SEED_PIPELINE.filter((s) => wanted.has(s.key)), unknown };
}
