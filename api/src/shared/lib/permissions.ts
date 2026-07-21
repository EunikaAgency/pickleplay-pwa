export const ALL_PERMISSIONS = [
  'admin.access',
  'admin.users.manage',
  'admin.venues.manage',
  'admin.bookings.manage',
  'admin.moderation.manage',
  'admin.reports.view',
  'admin.settings.manage',
  'owner.access',
  'owner.venues.create',
  'owner.venues.claim',
  'owner.venues.manage',
  'owner.bookings.manage',
  'owner.pricing.manage',
  'owner.analytics.view',
  'owner.reports.view',
  'owner.games.view',
  'owner.market.view',
  'owner.reviews.manage',
  'owner.coaches.manage',
  'owner.tournaments.manage',
  'owner.notifications.view',
  'owner.staff.manage',
  'owner.inventory.view',
  'owner.inventory.create',
  'owner.inventory.update',
  'owner.inventory.archive',
  'owner.inventory.export',
  'organizer.access',
  'organizer.games.manage',
  'organizer.events.manage',
  'organizer.tournaments.manage',
  'organizer.brackets.manage',
  'coach.access',
  'coach.profile.manage',
  'coach.venues.view',
  'coach.applications.manage',
  'player.dashboard.access',
  'player.games.create',
  'player.games.manage',
  'player.games.invite',
  'player.games.chat',
  'player.clubs.create',
  'player.clubs.join',
  'player.clubs.post',
  'player.clubs.react',
  'player.clubs.chat',
  'player.clubs.moderate',
  'player.profile.manage',
  'player.venues.locate',
  'player.tournaments.join',
  'player.tournaments.chat',
  'player.bookings.create',
  'player.venues.checkin',
  'player.search.use',
  'player.payments.view',
  'user.notifications.manage',
  'user.messages.send',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];
export type Role = 'admin' | 'moderator' | 'owner' | 'staff' | 'organizer' | 'coach' | 'player';

// Player capabilities any "acts-like-a-player" role may carry. These do NOT
// include dashboard access — that is gated separately so non-player roles
// (owner, organizer) can still create games/clubs without being handed the
// player dashboard. Keep aligned with the web copy in
// web/src/features/auth/permissions.js.
const PLAYER_BASE_PERMISSIONS: Permission[] = [
  'player.games.create',
  'player.games.manage',
  'player.games.invite',
  'player.games.chat',
  'player.clubs.create',
  'player.clubs.join',
  'player.clubs.post',
  'player.clubs.react',
  'player.clubs.chat',
  'player.profile.manage',
  'player.venues.locate',
  'player.tournaments.join',
  'player.tournaments.chat',
  'player.bookings.create',
  'player.venues.checkin',
  'player.search.use',
  'player.payments.view',
  'user.notifications.manage',
  'user.messages.send',
];

// Full player role = the player dashboard + the base capabilities.
const PLAYER_PERMISSIONS: Permission[] = ['player.dashboard.access', ...PLAYER_BASE_PERMISSIONS];

// Coach / organiser capabilities. These are NOT account roles any more: every
// partner is a `player` whose partner surfaces are unlocked by a live PAID
// subscription (features/partner-subscriptions) — see SUBSCRIPTION_PERMISSIONS
// below. The lists stay here because the legacy `coach`/`organizer` entries in
// ROLE_PERMISSIONS still seed the DB Role collection (and per-venue partner
// badges still record a `coach`/`organizer` grant), so the two must not drift.
const COACH_PERMISSIONS: Permission[] = ['coach.access', 'coach.profile.manage', 'coach.venues.view', 'coach.applications.manage'];
const ORGANIZER_PERMISSIONS: Permission[] = ['organizer.access', 'organizer.games.manage', 'organizer.events.manage', 'organizer.tournaments.manage', 'organizer.brackets.manage'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  player: PLAYER_PERMISSIONS,
  // Coaches can also act as players, so they inherit the full player set
  // (including player.dashboard.access).
  coach: [...PLAYER_PERMISSIONS, ...COACH_PERMISSIONS],
  // Owners run a separate console and must NOT receive player.dashboard.access
  // by default — they only get the player base capabilities.
  owner: [
    ...PLAYER_BASE_PERMISSIONS,
    'owner.access',
    'owner.venues.create',
    'owner.venues.claim',
    'owner.venues.manage',
    'owner.bookings.manage',
    'owner.pricing.manage',
    'owner.analytics.view',
    'owner.reports.view',
    'owner.games.view',
    'owner.market.view',
    'owner.reviews.manage',
    'owner.coaches.manage',
    'owner.tournaments.manage',
    'owner.notifications.view',
    'owner.staff.manage',
    'owner.inventory.view',
    'owner.inventory.create',
    'owner.inventory.update',
    'owner.inventory.archive',
    'owner.inventory.export',
  ],
  // A delegated sub-account an owner (or admin) creates. Staff run the owner
  // console for ALL of their creating owner's venues, bookings, and clubs (scoped
  // server-side by parentOwnerUserId → effectiveOwnerId), but cannot create more
  // staff (owner.staff.manage), nor create/claim new venues, nor open the
  // cross-venue revenue report at /owner/reports (owner.reports.view), nor set
  // the rates players are charged at /owner/pricing (owner.pricing.manage), nor
  // see per-venue revenue/analytics (owner.analytics.view — the 16 Jul meeting
  // ruled staff must NOT see revenue, so it's withheld too). Those stay the
  // owner's own actions. The operational owner.* set mirrors the owner role minus
  // those six keys. Staff still work bookings via the front desk and calendar.
  staff: [
    ...PLAYER_BASE_PERMISSIONS,
    'owner.access',
    'owner.venues.manage',
    'owner.bookings.manage',
    'owner.games.view',
    'owner.market.view',
    'owner.reviews.manage',
    'owner.coaches.manage',
    'owner.tournaments.manage',
    'owner.notifications.view',
    'owner.inventory.view',
    'owner.inventory.create',
    'owner.inventory.update',
    'owner.inventory.archive',
    'owner.inventory.export',
  ],
  organizer: [
    ...PLAYER_BASE_PERMISSIONS,
    'player.dashboard.access',  // organisers are players too — can apply to more venues
    ...ORGANIZER_PERMISSIONS,
  ],
  moderator: ['admin.access', 'admin.moderation.manage', 'admin.reports.view', 'player.clubs.create', 'player.clubs.join', 'player.clubs.post', 'player.clubs.react', 'player.clubs.chat'],
  admin: [...ALL_PERMISSIONS],
};

/**
 * What a LIVE partner subscription unlocks, on top of whatever the account's
 * role already grants. This is now the only way a user holds `coach.*` /
 * `organizer.*`: subscribing is what buys the capability, and letting the term
 * lapse takes it away — no role changes hands in either direction.
 */
export const SUBSCRIPTION_PERMISSIONS: Record<'coach' | 'organizer', Permission[]> = {
  coach: COACH_PERMISSIONS,
  organizer: ORGANIZER_PERMISSIONS,
};

/** Permissions granted by the plans a user is currently subscribed to. */
export function resolveSubscriptionPermissions(plans: Iterable<string>): Permission[] {
  const permissions = new Set<Permission>();
  for (const plan of plans) {
    for (const permission of SUBSCRIPTION_PERMISSIONS[plan as 'coach' | 'organizer'] ?? []) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

// Human-facing catalogue of every permission, grouped by domain. This is the
// source the admin Roles & Permissions page renders as a checkbox matrix.
// Keep it in lock-step with ALL_PERMISSIONS — one entry per string, same order.
export const PERMISSION_CATALOGUE: Array<{
  key: Permission;
  group: string;
  label: string;
  description: string;
}> = [
  { key: 'admin.access', group: 'Admin', label: 'Access admin dashboard', description: 'Sign in to the admin console.' },
  { key: 'admin.users.manage', group: 'Admin', label: 'Manage users', description: 'View and edit user accounts and their roles.' },
  { key: 'admin.venues.manage', group: 'Admin', label: 'Manage venues', description: 'Edit any venue and its owner links.' },
  { key: 'admin.bookings.manage', group: 'Admin', label: 'Manage bookings', description: 'View and adjust all bookings.' },
  { key: 'admin.moderation.manage', group: 'Admin', label: 'Moderate content', description: 'Action reviews, reports, claims, and edits.' },
  { key: 'admin.reports.view', group: 'Admin', label: 'View reports', description: 'See moderation and analytics reports.' },
  { key: 'admin.settings.manage', group: 'Admin', label: 'Manage system settings', description: 'Change platform settings, including roles & permissions.' },
  { key: 'owner.access', group: 'Owner', label: 'Access owner console', description: 'Sign in to the venue-owner console.' },
  { key: 'owner.venues.create', group: 'Owner', label: 'Create venues', description: 'List a brand-new venue.' },
  { key: 'owner.venues.claim', group: 'Owner', label: 'Claim a venue', description: 'Claim an existing unclaimed directory listing as its owner — submitted for admin review.' },
  { key: 'owner.venues.manage', group: 'Owner', label: 'Manage own venues', description: 'Edit venues they own.' },
  { key: 'owner.bookings.manage', group: 'Owner', label: 'Manage bookings', description: 'View, confirm, cancel, and mark paid bookings on owned venues.' },
  { key: 'owner.pricing.manage', group: 'Owner', label: 'Set court pricing', description: 'Open the pricing override grid at /owner/pricing and set the hourly rates players are charged. Withheld from staff sub-accounts.' },
  { key: 'owner.analytics.view', group: 'Owner', label: 'View venue analytics', description: 'See revenue, bookings, occupancy, and customer analytics for owned venues.' },
  { key: 'owner.reports.view', group: 'Owner', label: 'View business reports', description: 'Open the cross-venue revenue/KPI report at /owner/reports. Withheld from staff sub-accounts.' },
  { key: 'owner.games.view', group: 'Owner', label: 'View venue games', description: 'See games and court activity scheduled at owned venues.' },
  { key: 'owner.market.view', group: 'Owner', label: 'View venues map', description: 'See the owner venues map — your venues plotted with their live status (today’s bookings, pending approvals, occupancy).' },
  { key: 'owner.reviews.manage', group: 'Owner', label: 'Reply to reviews', description: 'Respond to reviews on owned venues.' },
  { key: 'owner.coaches.manage', group: 'Owner', label: 'Manage coach applications', description: 'Review, approve, and reject coach applications for owned venues.' },
  { key: 'owner.tournaments.manage', group: 'Owner', label: 'Manage tournament requests', description: 'Review, approve, and reject organizer tournament requests for owned venues.' },
  { key: 'owner.notifications.view', group: 'Owner', label: 'View owner notifications', description: 'See booking, game, and review activity on owned venues.' },
  { key: 'owner.staff.manage', group: 'Owner', label: 'Manage venue staff', description: 'Add and remove staff (managers, front-desk) on owned venues and assign each a role.' },
  { key: 'owner.inventory.view', group: 'Owner', label: 'View rental inventory', description: 'See the rental inventory list and item details.' },
  { key: 'owner.inventory.create', group: 'Owner', label: 'Create inventory items', description: 'Add new rental inventory items.' },
  { key: 'owner.inventory.update', group: 'Owner', label: 'Update inventory items', description: 'Edit existing rental inventory items.' },
  { key: 'owner.inventory.archive', group: 'Owner', label: 'Archive inventory items', description: 'Archive (soft-delete) rental inventory items.' },
  { key: 'owner.inventory.export', group: 'Owner', label: 'Export inventory CSV', description: 'Download the rental inventory as a CSV file.' },
  { key: 'organizer.access', group: 'Organizer', label: 'Access organizer tools', description: 'Sign in to organizer surfaces.' },
  { key: 'organizer.games.manage', group: 'Organizer', label: 'Manage games', description: 'Create and run open-play games.' },
  { key: 'organizer.events.manage', group: 'Organizer', label: 'Manage events', description: 'Create and run events / tournaments.' },
  { key: 'organizer.tournaments.manage', group: 'Organizer', label: 'Manage tournaments', description: 'Create tournaments and submit venue requests to owners.' },
  { key: 'organizer.brackets.manage', group: 'Organizer', label: 'Manage brackets', description: 'Build entrants, generate brackets, and enter match scores.' },
  { key: 'coach.access', group: 'Coach', label: 'Access coach dashboard', description: 'Sign in to the coach console.' },
  { key: 'coach.profile.manage', group: 'Coach', label: 'Manage coach profile', description: 'Edit their public coach profile.' },
  { key: 'coach.venues.view', group: 'Coach', label: 'View coach venues', description: 'See the venues linked to their coach profile.' },
  { key: 'coach.applications.manage', group: 'Coach', label: 'Apply to venues', description: 'Apply to coach at venues and track application status.' },
  { key: 'player.dashboard.access', group: 'Player', label: 'Access player dashboard', description: 'Use the player dashboard surface.' },
  { key: 'player.games.create', group: 'Player', label: 'Create games', description: 'Start open-play games as a player.' },
  { key: 'player.games.manage', group: 'Player', label: 'Manage own games', description: 'Edit, remove players from, or delete games they created.' },
  { key: 'player.games.invite', group: 'Player', label: 'Invite players to games', description: 'Search for players and invite them to a game they host.' },
  { key: 'player.games.chat', group: 'Player', label: 'Game chat', description: 'Read and post in the group chat of a game they host or joined.' },
  { key: 'player.clubs.create', group: 'Player', label: 'Create clubs', description: 'Start clubs / communities.' },
  { key: 'player.clubs.join', group: 'Player', label: 'Join clubs', description: 'Join a public club or request to join a private one.' },
  { key: 'player.clubs.post', group: 'Player', label: 'Post in clubs', description: 'Post and reply in the feed of clubs they belong to.' },
  { key: 'player.clubs.react', group: 'Player', label: 'React to club posts', description: 'Like posts and replies in club feeds.' },
  { key: 'player.clubs.chat', group: 'Player', label: 'Club chat', description: 'Read and post in the member group chat of a club they belong to.' },
  { key: 'player.clubs.moderate', group: 'Player', label: 'Moderate any club', description: 'Delete any post or remove members in any club (admin-level; hosts moderate their own club by ownership).' },
  { key: 'player.profile.manage', group: 'Player', label: 'Manage own profile', description: 'Edit their own player profile.' },
  { key: 'player.venues.locate', group: 'Player', label: 'Find nearby courts', description: 'Use your location to sort courts by distance.' },
  { key: 'player.tournaments.join', group: 'Player', label: 'Join tournaments', description: 'Register for tournaments and withdraw.' },
  { key: 'player.tournaments.chat', group: 'Player', label: 'Tournament chat', description: 'Read and post in the participant group chat of a tournament they are registered for.' },
  { key: 'player.bookings.create', group: 'Player', label: 'Book courts', description: 'Reserve a court at a venue and pay at checkout.' },
  { key: 'player.venues.checkin', group: 'Player', label: 'Check in at a court', description: 'Mark yourself present at a venue so others can see who is playing.' },
  { key: 'player.search.use', group: 'Player', label: 'Search across the app', description: 'Use global search to find courts, games, clubs, and players in one place.' },
  { key: 'player.payments.view', group: 'Player', label: 'View payment history', description: 'See your own payment history and spend report (court bookings and games).' },
  { key: 'user.notifications.manage', group: 'User', label: 'Manage notifications', description: 'Read and configure notifications.' },
  { key: 'user.messages.send', group: 'User', label: 'Send direct messages', description: 'Start conversations and message other players (e.g. a game organizer).' },
];

// Roles became data-defined (a Mongo `Role` collection) without making
// permission resolution async: the live role→permission map is cached in
// memory, hydrated from the DB at startup and after every role write. Until
// hydrated (cold start, tests, no DB) we fall back to the hardcoded
// ROLE_PERMISSIONS above, which is also the seed source. The roles feature owns
// the loader and calls setRolePermissionsCache() — this module never imports the
// Role model, so there's no import cycle.
let rolePermissionsCache: Record<string, Permission[]> | null = null;

export function setRolePermissionsCache(map: Record<string, Permission[]> | null): void {
  rolePermissionsCache = map;
}

export function getRolePermissionsMap(): Record<string, Permission[]> {
  return rolePermissionsCache ?? ROLE_PERMISSIONS;
}

export function normalizeRole(role?: string | null): Role {
  return role && role in getRolePermissionsMap() ? (role as Role) : 'player';
}

export function resolveRolePermissions(roles: Array<string | null | undefined>): Permission[] {
  const map = getRolePermissionsMap();
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of map[normalizeRole(role)] ?? []) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

export function hasPermission(
  user: { permissions?: string[]; role?: string; roles?: string[] } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  const permissions = user.permissions?.length
    ? user.permissions
    : resolveRolePermissions(user.roles?.length ? user.roles : [user.role]);
  return permissions.includes(permission);
}

// The owner whose resources a user can act on. For a staff sub-account this is
// the creating owner (`parentOwnerId`, carried in the JWT); for everyone else it
// is the user themselves. This is the single lever that lets a staff member
// manage all of their owner's venues/bookings/clubs without owning them: every
// "is this my resource?" check compares the resource's owner to this id rather
// than to `user.sub` directly. Returns null only for an absent user.
export function effectiveOwnerId(
  user: { sub?: string; parentOwnerId?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  if (user.parentOwnerId) return String(user.parentOwnerId);
  return user.sub ? String(user.sub) : null;
}

/**
 * The owner.* permissions an owner is allowed to toggle for a staff sub-account
 * via the staff Access dropdown. These are the only values accepted by
 * PATCH /staff/:id's `grantedPermissions` field.
 */
export const STAFF_GRANTABLE_PERMISSIONS = [
  'owner.bookings.manage',
  'owner.pricing.manage',
  'owner.analytics.view',
  'owner.venues.manage',
] as const;
