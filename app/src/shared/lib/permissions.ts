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
  'owner.analytics.view',
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

const PLAYER_PERMISSIONS: Permission[] = [
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

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  player: PLAYER_PERMISSIONS,
  coach: [...PLAYER_PERMISSIONS, 'coach.access', 'coach.profile.manage', 'coach.venues.view', 'coach.applications.manage'],
  owner: [
    ...PLAYER_PERMISSIONS,
    'owner.access',
    'owner.venues.create',
    'owner.venues.claim',
    'owner.venues.manage',
    'owner.bookings.manage',
    'owner.analytics.view',
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
  // A delegated sub-account an owner (or admin) creates — runs the owner console
  // for ALL of that owner's venues, bookings, and clubs (scoped server-side by
  // parentOwnerUserId). Mirrors the owner role minus owner.staff.manage and
  // owner.venues.create / owner.venues.claim (staff can't create staff or add new
  // venues to the owner's org). Keep in sync with api shared/lib/permissions.ts.
  staff: [
    ...PLAYER_PERMISSIONS,
    'owner.access',
    'owner.venues.manage',
    'owner.bookings.manage',
    'owner.analytics.view',
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
    ...PLAYER_PERMISSIONS,
    'organizer.access',
    'organizer.games.manage',
    'organizer.events.manage',
    'organizer.tournaments.manage',
    'organizer.brackets.manage',
  ],
  moderator: ['admin.access', 'admin.moderation.manage', 'admin.reports.view', 'player.clubs.create', 'player.clubs.join', 'player.clubs.post', 'player.clubs.react', 'player.clubs.chat'],
  admin: [...ALL_PERMISSIONS],
};

/**
 * Self-service account preferences (persisted on the user via `PATCH /me`).
 * Defined here next to `AppUser` so both `permissions.ts` and `api.ts` can share
 * it without a circular import (`api.ts` already imports from this module).
 */
export interface UserPreferences {
  notifications: {
    gameReminders: boolean;
    chatMessages: boolean;
    announcements: boolean;
  };
  units: 'km' | 'mi';
  /** Preferred default "Near me" radius (km), applied as the Nearby filter default. */
  searchRadiusKm: number;
}

/** Fallback used until the API user payload provides real preferences. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: { gameReminders: true, chatMessages: true, announcements: true },
  units: 'km',
  searchRadiusKm: 10,
};

/** Who can see the player's profile. Persisted on the account via `PATCH /me`. */
export type PrivacySetting = 'public' | 'friends' | 'private';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  /** Optional profile display fields, populated from the API user payload. */
  firstName?: string;
  avatarUrl?: string;
  skillLevel?: number;
  skillLevelLabel?: string;
  bio?: string;
  /** Postal address. Required before subscribing as a coach or organizer. */
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zipcode?: string;
  /** Whether the user has finished (or skipped) first-run onboarding. */
  hasOnboarded?: boolean;
  /** Account preferences (notification toggles + display units + search radius). */
  preferences: UserPreferences;
  /** Profile visibility (public / friends / private). */
  privacySetting?: PrivacySetting;
  roleDefault: Role;
  roles: Role[];
  permissions: Permission[];
  /** Per-venue partner badges ("Coach at <venue>", "Organiser at <venue>"). */
  partnerRoles: Array<{ role: string; venueId: string; venueName: string }>;
}

/** First name for greetings; falls back to the first word of displayName.
 *  Guards against corrupted seed data where firstName is set but unrelated to
 *  displayName (e.g. displayName "Oscar Walker" but firstName "Craig"). */
export function firstNameOf(user: AppUser | null | undefined): string | null {
  if (!user) return null;
  const displayFirst = user.displayName?.trim().split(/\s+/)[0];
  const first = user.firstName?.trim();
  // When firstName is set and looks like it genuinely belongs to the displayName
  // (case-insensitive substring), trust it. Otherwise fall back to the first word
  // of displayName — this catches seed-data mix-ups where the two fields drifted.
  if (first && displayFirst && first.length > 0) {
    const displayLower = user.displayName!.toLowerCase();
    if (displayLower.includes(first.toLowerCase())) return first;
    return displayFirst;
  }
  return first || displayFirst || null;
}

export function normalizeRole(role?: string | null): Role {
  return role && role in ROLE_PERMISSIONS ? (role as Role) : 'player';
}

export function resolveRolePermissions(roles: Array<Role | string | null | undefined>): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[normalizeRole(role)]) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

export function userHasPermission(user: AppUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
