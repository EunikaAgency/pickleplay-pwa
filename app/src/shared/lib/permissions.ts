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
  'owner.venues.manage',
  'owner.bookings.manage',
  'owner.analytics.view',
  'owner.games.view',
  'owner.market.view',
  'owner.reviews.manage',
  'owner.coaches.manage',
  'owner.tournaments.manage',
  'owner.notifications.view',
  'organizer.access',
  'organizer.games.manage',
  'organizer.events.manage',
  'organizer.tournaments.manage',
  'organizer.brackets.manage',
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
  'player.clubs.moderate',
  'player.profile.manage',
  'player.venues.locate',
  'player.tournaments.join',
  'player.bookings.create',
  'player.venues.checkin',
  'player.search.use',
  'user.notifications.manage',
  'user.messages.send',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];
export type Role = 'admin' | 'moderator' | 'owner' | 'organizer' | 'coach' | 'player';

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
  'player.profile.manage',
  'player.venues.locate',
  'player.tournaments.join',
  'player.bookings.create',
  'player.venues.checkin',
  'player.search.use',
  'user.notifications.manage',
  'user.messages.send',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  player: PLAYER_PERMISSIONS,
  coach: [...PLAYER_PERMISSIONS, 'coach.profile.manage', 'coach.venues.view', 'coach.applications.manage'],
  owner: [
    ...PLAYER_PERMISSIONS,
    'owner.access',
    'owner.venues.create',
    'owner.venues.manage',
    'owner.bookings.manage',
    'owner.analytics.view',
    'owner.games.view',
    'owner.market.view',
    'owner.reviews.manage',
    'owner.coaches.manage',
    'owner.tournaments.manage',
    'owner.notifications.view',
  ],
  organizer: [
    ...PLAYER_PERMISSIONS,
    'organizer.access',
    'organizer.games.manage',
    'organizer.events.manage',
    'organizer.tournaments.manage',
    'organizer.brackets.manage',
  ],
  moderator: ['admin.access', 'admin.moderation.manage', 'admin.reports.view', 'player.clubs.create', 'player.clubs.join', 'player.clubs.post', 'player.clubs.react'],
  admin: [...ALL_PERMISSIONS],
};

export interface AppUser {
  id: string;
  displayName: string;
  /** Optional profile display fields, populated from the API user payload. */
  firstName?: string;
  avatarUrl?: string;
  skillLevel?: number;
  skillLevelLabel?: string;
  bio?: string;
  /** Whether the user has finished (or skipped) first-run onboarding. */
  hasOnboarded?: boolean;
  roleDefault: Role;
  roles: Role[];
  permissions: Permission[];
}

/** First name for greetings; falls back to the first word of displayName. */
export function firstNameOf(user: AppUser | null | undefined): string | null {
  if (!user) return null;
  const first = user.firstName?.trim() || user.displayName?.trim().split(/\s+/)[0];
  return first || null;
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
