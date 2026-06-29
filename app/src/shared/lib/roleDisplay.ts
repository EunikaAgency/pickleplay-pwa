import type { AppUser, Role } from './permissions';

/** Roles ranked most→least significant, so a multi-role user shows their top hat. */
export const ROLE_RANK: Role[] = ['admin', 'moderator', 'owner', 'staff', 'organizer', 'coach', 'player'];

/** Per-role label + accent colour for the profile badges (avatar pill + role pill).
 *  Shared by the player ProfileScreenV2 and the owner OwnerProfileScreen so both
 *  render the same role chrome — keep them from drifting apart. */
export const ROLE_META: Record<Role, { label: string; color: string }> = {
  admin: { label: 'Admin', color: '#EF4444' },
  moderator: { label: 'Moderator', color: '#F59E0B' },
  owner: { label: 'Owner', color: '#8B5CF6' },
  staff: { label: 'Staff', color: '#7C3AED' },
  organizer: { label: 'Organizer', color: '#3355FF' },
  coach: { label: 'Coach', color: '#0EA5E9' },
  player: { label: 'Player', color: '#5C9E00' },
};

/** The user's most significant role, for the profile badge. */
export function primaryRole(user: AppUser): Role {
  const roles = user.roles?.length ? user.roles : [user.roleDefault];
  return ROLE_RANK.find((r) => roles.includes(r)) ?? 'player';
}
