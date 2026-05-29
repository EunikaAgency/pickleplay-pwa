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
  'owner.reviews.manage',
  'organizer.access',
  'organizer.games.manage',
  'organizer.events.manage',
  'coach.profile.manage',
  'player.dashboard.access',
  'player.games.create',
  'player.clubs.create',
  'player.profile.manage',
  'user.notifications.manage',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];
export type Role = 'admin' | 'moderator' | 'owner' | 'organizer' | 'coach' | 'player';

const PLAYER_PERMISSIONS: Permission[] = [
  'player.dashboard.access',
  'player.games.create',
  'player.clubs.create',
  'player.profile.manage',
  'user.notifications.manage',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  player: PLAYER_PERMISSIONS,
  coach: [...PLAYER_PERMISSIONS, 'coach.profile.manage'],
  owner: [
    ...PLAYER_PERMISSIONS,
    'owner.access',
    'owner.venues.create',
    'owner.venues.manage',
    'owner.reviews.manage',
  ],
  organizer: [
    ...PLAYER_PERMISSIONS,
    'organizer.access',
    'organizer.games.manage',
    'organizer.events.manage',
  ],
  moderator: ['admin.access', 'admin.moderation.manage', 'admin.reports.view'],
  admin: [...ALL_PERMISSIONS],
};

export interface AppUser {
  id: string;
  displayName: string;
  roleDefault: Role;
  roles: Role[];
  permissions: Permission[];
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

export function createAppUser(role: Role = 'player'): AppUser {
  const roles = [role];
  return {
    id: 'demo-user',
    displayName: 'Riley Pickler',
    roleDefault: role,
    roles,
    permissions: resolveRolePermissions(roles),
  };
}

export function userHasPermission(user: AppUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
