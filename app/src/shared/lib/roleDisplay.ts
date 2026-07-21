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

/** The role NAME to show on badges — `primaryRole` plus the partner plans the
 *  user is actively paying for. Coach/organizer are no longer account roles
 *  (see api's partner-roles-to-subscriptions), so a live subscription would
 *  otherwise still read as "Player" on the profile pill and the sidebar.
 *
 *  Label-only: navigation, screens and gating all keep using `primaryRole` /
 *  `userHasPermission`, so a subscriber's sidebar and functions are unchanged.
 *  A ranked account role (admin/moderator/owner/staff) outranks a plan — their
 *  badge shouldn't be demoted by buying a subscription. */
export function displayRole(user: AppUser): Role {
  const role = primaryRole(user);
  if (role !== 'player') return role;
  if (user.organizerSubscriptionActive) return 'organizer';
  if (user.coachSubscriptionActive) return 'coach';
  return role;
}

/** Per-venue partner badge chips — "Coach at Quezon Smash Club", "Organiser at
 *  Makati Sports Hub". Duplicates (same role + venue) are collapsed. */
export function partnerBadges(user: AppUser): Array<{ role: string; venueName: string; color: string }> {
  const seen = new Set<string>();
  const badges: Array<{ role: string; venueName: string; color: string }> = [];
  for (const p of user.partnerRoles ?? []) {
    const key = `${p.role}|${p.venueId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = ROLE_META[p.role as Role];
    badges.push({
      role: p.role,
      venueName: p.venueName,
      color: meta?.color ?? '#6B7280',
    });
  }
  return badges;
}
