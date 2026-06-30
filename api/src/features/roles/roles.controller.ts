import { z } from 'zod';
import { Role } from './roles.model.js';
import { User } from '../auth/auth.model.js';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOGUE,
  ROLE_PERMISSIONS,
  hasPermission,
  setRolePermissionsCache,
} from '../../shared/lib/permissions.js';

// ─── System role seed metadata ─────────────────────────────────────────────
// The 6 built-in roles are seeded from ROLE_PERMISSIONS (the code-defined map).
// This carries the human-facing label/description/order for each.
const SYSTEM_ROLE_META: Record<string, { label: string; description: string; sortOrder: number }> = {
  admin:     { label: 'Admin',       description: 'Full platform access.',                sortOrder: 10 },
  moderator: { label: 'Moderator',   description: 'Content moderation and reports only.', sortOrder: 20 },
  owner:     { label: 'Venue owner', description: 'Runs the venue-owner console.',        sortOrder: 30 },
  staff:     { label: 'Venue staff', description: "Manages an owner's venues, bookings and clubs.", sortOrder: 35 },
  organizer: { label: 'Organizer',   description: 'Creates and runs games and events.',   sortOrder: 40 },
  coach:     { label: 'Coach',       description: 'Coach profile plus player tools.',     sortOrder: 50 },
  player:    { label: 'Player',      description: 'Default member role.',                 sortOrder: 60 },
};

// Club capabilities every player-like role should carry. Backfilled onto the
// already-seeded role rows so the new Clubs feature works for existing installs
// without an admin toggling each one (insert-only seeding can't reach them).
const CLUB_PERMISSIONS = ['player.clubs.create', 'player.clubs.join', 'player.clubs.post', 'player.clubs.react', 'player.clubs.chat'];

const SYSTEM_PERMISSION_BACKFILLS: Record<string, string[]> = {
  // The admin role is the platform superuser — it must always hold *every*
  // permission, including ones introduced after the admin row was first seeded.
  // Insert-only seeding ($setOnInsert) can't reach the existing row, so backfill
  // the whole catalogue here. Deriving it from ALL_PERMISSIONS keeps admin in
  // lockstep automatically as new permissions are added — no edit needed here.
  admin: [...ALL_PERMISSIONS],
  // The owner console's bookings inbox, analytics/insights, games view, ops map,
  // and notifications ship as gated routes in both frontends — backfill them onto
  // already-seeded owner rows (insert-only seeding can't reach them) so existing
  // owners aren't locked out of the pages their role is meant to have.
  owner: [
    'owner.venues.claim',
    'owner.bookings.manage', 'owner.analytics.view', 'owner.games.view',
    'owner.market.view', 'owner.notifications.view',
    'owner.coaches.manage', 'owner.tournaments.manage', 'owner.staff.manage',
    'player.tournaments.join', 'player.games.invite', 'player.games.chat', 'user.messages.send', ...CLUB_PERMISSIONS,
  ],
  coach: ['coach.applications.manage', 'player.tournaments.join', 'player.games.invite', 'player.games.chat', 'user.messages.send', ...CLUB_PERMISSIONS],
  organizer: ['organizer.tournaments.manage', 'organizer.brackets.manage', 'player.tournaments.join', 'player.games.invite', 'player.games.chat', 'user.messages.send', ...CLUB_PERMISSIONS],
  player: ['player.tournaments.join', 'player.games.invite', 'player.games.chat', 'user.messages.send', ...CLUB_PERMISSIONS],
  moderator: [...CLUB_PERMISSIONS],
};

// ─── Cache / seed helpers (called from src/index.ts at startup) ─────────────

// Insert any missing system role. $setOnInsert means an existing row — and any
// admin edits to its permissions/label — is never overwritten on restart.
export async function seedSystemRoles(): Promise<void> {
  await Promise.all(
    Object.entries(ROLE_PERMISSIONS).map(([key, perms]) => {
      const meta = SYSTEM_ROLE_META[key];
      return Role.updateOne(
        { key },
        {
          $setOnInsert: {
            key,
            label: meta?.label ?? key,
            description: meta?.description ?? '',
            permissions: perms,
            isSystem: true,
            sortOrder: meta?.sortOrder ?? 100,
          },
        },
        { upsert: true },
      );
    }),
  );

  // Existing installs may have system role rows from before these permissions
  // were introduced. Backfill only the new feature flags needed for shipped
  // navigation/routes, without replacing any other admin-edited permissions.
  await Promise.all(
    Object.entries(SYSTEM_PERMISSION_BACKFILLS).map(([key, permissions]) =>
      Role.updateOne(
        { key },
        { $addToSet: { permissions: { $each: permissions } } },
      ),
    ),
  );
}

// Hydrate the in-memory role→permission map from the DB so resolveRolePermissions
// stays synchronous. Backfills any missing system key from the hardcoded map.
export async function loadRolePermissionsCache(): Promise<void> {
  const roles = await Role.find().lean();
  const map: Record<string, string[]> = {};
  for (const r of roles as any[]) map[r.key] = r.permissions ?? [];
  for (const [key, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (!map[key]) map[key] = perms;
  }
  setRolePermissionsCache(map as any);
}

// ─── Write guard ────────────────────────────────────────────────────────────
// Reads only need admin.access (requireAdmin). Writes need admin.settings.manage
// — moderators carry admin.access but must not edit roles.
export async function requireRoleAdmin(c: any, next: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.settings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Settings management permission required' } }, 403);
  }
  await next();
}

// ─── Validation ───────────────────────────────────────────────────────────
const permissionsSchema = z
  .array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]))
  .refine((arr) => new Set(arr).size === arr.length, { message: 'Duplicate permissions' });

// Roles are a fixed set (seeded as system roles). Only their label,
// description, and permissions are editable — key and isSystem are immutable,
// and roles are never created or deleted through the API.
const updateRoleSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema.optional(),
  // Venue ids linked to this role (used by the coach role's venue association).
  venues: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Per-role user counts (bucketed on User.roleDefault) ────────────────────
async function userCountsByRole(): Promise<Record<string, number>> {
  const rows = await User.aggregate([{ $group: { _id: '$roleDefault', n: { $sum: 1 } } }]);
  const counts: Record<string, number> = {};
  for (const r of rows as any[]) counts[r._id ?? 'player'] = (counts[r._id ?? 'player'] ?? 0) + r.n;
  return counts;
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function listRoles(c: any) {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ sortOrder: 1, key: 1 }).lean(),
    userCountsByRole(),
  ]);
  const data = (roles as any[]).map((r) => ({ ...r, id: r._id, userCount: counts[r.key] || 0 }));
  return c.json({ data, meta: { total: data.length } });
}

export async function listPermissions(c: any) {
  return c.json({ data: PERMISSION_CATALOGUE });
}

export async function updateRole(c: any) {
  const key = c.req.param('key');
  const role = await Role.findOne({ key });
  if (!role) return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404);

  const body = updateRoleSchema.parse(await c.req.json());

  // The admin role must always keep admin.access, or the platform locks itself out.
  if (key === 'admin' && body.permissions && !body.permissions.includes('admin.access')) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'The admin role must keep admin.access' } }, 400);
  }

  await Role.updateOne({ key }, body);
  await loadRolePermissionsCache();
  const updated = await Role.findOne({ key }).lean();
  return c.json({ data: { ...(updated as any), id: (updated as any)._id } });
}
