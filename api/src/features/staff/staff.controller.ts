import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../auth/auth.model.js';
import { hasPermission, resolveRolePermissions, effectiveOwnerId } from '../../shared/lib/permissions.js';

// Staff accounts. A staff member is a `User` with roleDefault:'staff' and a
// `parentOwnerUserId` pointing at the owner who created it. The account itself
// grants NO automatic venue access — staff must be explicitly added to individual
// venues through the per-venue Staff tab, which creates VenueStaff rows.
// parentOwnerUserId is kept only so listStaff can find the owner's staff.
// Only owners and admins (holders of owner.staff.manage) reach these endpoints.

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(100),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  // Admins only: which owner this staff account belongs to. Owners always create
  // staff under themselves and this field is ignored for them.
  ownerUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

/** Permissions an owner is allowed to toggle for a staff sub-account. */
export const STAFF_GRANTABLE_PERMISSIONS = [
  'owner.bookings.manage',
  'owner.pricing.manage',
  'owner.analytics.view',
  'owner.venues.manage',
] as const;

const updateStaffSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  // Reset the staff member's password.
  password: z.string().min(6).max(128).optional(),
  // Activate / deactivate. A deactivated staff member can't log in.
  isActive: z.boolean().optional(),
  // Extra permissions the owner grants this staff member, on top of the base
  // staff-role set. Only STAFF_GRANTABLE_PERMISSIONS are accepted; anything else
  // is silently dropped. Pass an empty array to clear all grants.
  grantedPermissions: z.array(z.string()).optional(),
});

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function serializeStaff(u: any) {
  return {
    id: u._id,
    email: u.email,
    displayName: u.displayName,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    avatarUrl: u.avatarUrl ?? null,
    isActive: u.isActive !== false,
    parentOwnerUserId: u.parentOwnerUserId ?? null,
    grantedPermissions: u.grantedPermissions ?? [],
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? null,
  };
}

/** Is this user id a venue owner (resolves owner.access from their role)? */
async function isOwnerUser(userId: string): Promise<boolean> {
  const u = await User.findById(userId).select('roleDefault isActive').lean();
  if (!u || (u as any).isActive === false) return false;
  return resolveRolePermissions([(u as any).roleDefault]).includes('owner.access');
}

// Create a staff sub-account. Owner → under themselves; admin → under a specified
// owner (or, if omitted, themselves).
export async function createStaff(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'owner.staff.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Staff management permission required' } }, 403);
  }
  const body = createStaffSchema.parse(await c.req.json());

  const isAdmin = hasPermission(user, 'admin.users.manage');
  const parentOwnerUserId = isAdmin && body.ownerUserId ? body.ownerUserId : user.sub;
  if (!(await isOwnerUser(parentOwnerUserId))) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Staff can only be created for a venue owner' } }, 400);
  }

  const existing = await User.findOne({ email: body.email }).select('_id').lean();
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const staff = await User.create({
    email: body.email,
    passwordHash,
    displayName: body.displayName,
    firstName: body.firstName || null,
    lastName: body.lastName || null,
    roleDefault: 'staff',
    parentOwnerUserId,
    isActive: true,
    isVerified: false,
  });
  return c.json({ data: serializeStaff(staff.toObject()) }, 201);
}

// List the staff accounts for an owner. Owner → their own; admin → may pass
// ?ownerUserId to view a specific owner's team.
export async function listStaff(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'owner.staff.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Staff management permission required' } }, 403);
  }
  const isAdmin = hasPermission(user, 'admin.users.manage');
  const requestedOwner = c.req.query('ownerUserId');
  const ownerId = isAdmin && requestedOwner && OBJECT_ID.test(requestedOwner)
    ? requestedOwner
    : effectiveOwnerId(user);
  const rows = await User.find({ parentOwnerUserId: ownerId, roleDefault: 'staff' })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return c.json({ data: rows.map(serializeStaff) });
}

// Load a staff row and confirm the requester is allowed to manage it (the
// creating owner, or an admin). Returns the Mongoose doc on success, or an error
// Response the handler should return as-is.
async function loadManageableStaff(c: any): Promise<{ staff: any } | { error: Response }> {
  const user = c.get('user');
  if (!hasPermission(user, 'owner.staff.manage')) {
    return { error: c.json({ error: { code: 'FORBIDDEN', message: 'Staff management permission required' } }, 403) };
  }
  const id = c.req.param('id');
  const staff = OBJECT_ID.test(id) ? await User.findById(id) : null;
  if (!staff || staff.roleDefault !== 'staff') {
    return { error: c.json({ error: { code: 'NOT_FOUND', message: 'Staff member not found' } }, 404) };
  }
  const isAdmin = hasPermission(user, 'admin.users.manage');
  if (!isAdmin && staff.parentOwnerUserId?.toString() !== effectiveOwnerId(user)) {
    return { error: c.json({ error: { code: 'FORBIDDEN', message: 'You can only manage your own staff' } }, 403) };
  }
  return { staff };
}

export async function updateStaff(c: any) {
  const body = updateStaffSchema.parse(await c.req.json());
  const loaded = await loadManageableStaff(c);
  if ('error' in loaded) return loaded.error;
  const { staff } = loaded;
  if (body.displayName !== undefined) staff.displayName = body.displayName;
  if (body.firstName !== undefined) staff.firstName = body.firstName || null;
  if (body.lastName !== undefined) staff.lastName = body.lastName || null;
  if (body.isActive !== undefined) staff.isActive = body.isActive;
  if (body.password !== undefined) staff.passwordHash = await bcrypt.hash(body.password, 12);
  if (body.grantedPermissions !== undefined) {
    // Only keep entries the owner is allowed to grant; silently drop unknowns.
    const allowed = new Set<string>(STAFF_GRANTABLE_PERMISSIONS);
    staff.grantedPermissions = (body.grantedPermissions as string[]).filter((p) => allowed.has(p));
  }
  await staff.save();
  return c.json({ data: serializeStaff(staff.toObject()) });
}

// Remove the staff account outright — the login is deleted, not just disabled.
// Scoped to a staff sub-account (roleDefault:'staff'), so this can only ever
// delete an account the owner created here, never a regular user.
export async function removeStaff(c: any) {
  const loaded = await loadManageableStaff(c);
  if ('error' in loaded) return loaded.error;
  const { staff } = loaded;
  await User.deleteOne({ _id: staff._id });
  return c.json({ data: { message: 'Staff member removed', id: staff._id } });
}
