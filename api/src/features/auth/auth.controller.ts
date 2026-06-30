import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from './auth.model.js';
import { Venue, VenueStaff } from '../venues/venues.model.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../../shared/lib/jwt.js';
import { resolveRolePermissions } from '../../shared/lib/permissions.js';

// Public self-registration is limited to these four roles. admin/moderator are
// assigned only by an existing admin and are intentionally NOT accepted here —
// the enum rejects them with a 400 before any user is created.
export const REGISTERABLE_ROLES = ['player', 'coach', 'owner', 'organizer'] as const;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(100),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  role: z.enum(REGISTERABLE_ROLES).default('player'),
  phone: z.string().max(20).optional(),
  homeCityId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  skillLevel: z.coerce.number().optional(),
  skillLevelLabel: z.string().max(20).optional(),
  bio: z.string().max(2000).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  skillLevel: z.string().optional(),
  skillLevelLabel: z.string().max(20).optional(),
  modePreference: z.enum(['player', 'owner', 'coach', 'organizer']).optional(),
  homeCityId: z.string().optional(),
  bio: z.string().optional(),
  privacySetting: z.enum(['public', 'private', 'friends']).optional(),
  gcashNumber: z.string().max(20).optional(),
  hasOnboarded: z.boolean().optional(),
  avatarUrl: z.string().max(1000).optional(),
  preferences: z.object({
    notifications: z.object({
      gameReminders: z.boolean().optional(),
      chatMessages: z.boolean().optional(),
      announcements: z.boolean().optional(),
    }).optional(),
    units: z.enum(['km', 'mi']).optional(),
    searchRadiusKm: z.number().min(1).max(200).optional(),
  }).optional(),
});

function getUserRoles(user: { roleDefault?: string | null }) {
  const roles = new Set<string>();
  if (user.roleDefault) roles.add(user.roleDefault);
  if (!roles.size) roles.add('player');
  return [...roles];
}

// Does this user manage any venue — owns one OR is active staff on one? Drives
// the app's venue-management console entry for staff (who hold no owner role).
async function userManagesVenues(userId: any): Promise<boolean> {
  const [ownsOne, staffsOne] = await Promise.all([
    Venue.exists({ ownerUserId: userId, deletedAt: null }),
    VenueStaff.exists({ userId, status: 'active' }),
  ]);
  return !!(ownsOne || staffsOne);
}

async function authUserPayload(user: any) {
  const roles = getUserRoles(user);
  const permissions = resolveRolePermissions(roles);
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    roleDefault: user.roleDefault,
    role: user.roleDefault || 'player',
    roles,
    permissions,
    coachId: user.coachId,
    managedCoachId: user.managedCoachId,
    parentOwnerUserId: user.parentOwnerUserId ?? null,
    isActive: user.isActive !== false,
    modePreference: user.modePreference,
    phone: user.phone,
    skillLevel: user.skillLevel,
    skillLevelLabel: user.skillLevelLabel,
    homeCityId: user.homeCityId,
    bio: user.bio,
    isVerified: user.isVerified,
    privacySetting: user.privacySetting,
    gcashNumber: user.gcashNumber,
    hasOnboarded: user.hasOnboarded ?? false,
    preferences: {
      notifications: {
        gameReminders: user.preferences?.notifications?.gameReminders ?? true,
        chatMessages: user.preferences?.notifications?.chatMessages ?? true,
        announcements: user.preferences?.notifications?.announcements ?? true,
      },
      units: user.preferences?.units ?? 'km',
      searchRadiusKm: user.preferences?.searchRadiusKm ?? 10,
    },
    managesVenues: await userManagesVenues(user._id),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function tokenPayloadFor(user: any) {
  const roles = getUserRoles(user);
  return {
    sub: user._id.toString(),
    email: user.email,
    role: user.roleDefault || 'player',
    roles,
    permissions: resolveRolePermissions(roles),
    // Carried in the JWT so effectiveOwnerId() can scope a staff member to their
    // owner's resources without a DB lookup on every request. Omitted otherwise.
    ...(user.parentOwnerUserId ? { parentOwnerId: user.parentOwnerUserId.toString() } : {}),
  };
}

export async function register(c: any) {
  const body = registerSchema.parse(await c.req.json());
  const existing = await User.findOne({ email: body.email });
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409);
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    email: body.email, passwordHash, displayName: body.displayName,
    firstName: body.firstName || null, lastName: body.lastName || null,
    roleDefault: body.role,
    phone: body.phone || undefined,
    homeCityId: body.homeCityId || undefined,
    skillLevel: body.skillLevel,
    skillLevelLabel: body.skillLevelLabel || undefined,
    bio: body.bio || undefined,
    isVerified: false,
  });
  const tokenPayload = tokenPayloadFor(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload), signRefreshToken(tokenPayload),
  ]);
  return c.json({ data: { accessToken, refreshToken, user: await authUserPayload(user) } }, 201);
}

export async function login(c: any) {
  const body = loginSchema.parse(await c.req.json());
  const user = await User.findOne({ email: body.email });
  if (!user || !user.passwordHash) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401);
  }
  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401);
  }
  // A deactivated account (e.g. a staff member an owner removed) can authenticate
  // with the right password but must not be allowed to obtain a session.
  if (user.isActive === false) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'This account has been deactivated' } }, 403);
  }
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  const tokenPayload = tokenPayloadFor(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload), signRefreshToken(tokenPayload),
  ]);
  return c.json({ data: { accessToken, refreshToken, user: await authUserPayload(user) } });
}

export async function refresh(c: any) {
  const body = refreshSchema.parse(await c.req.json());
  let payload;
  try { payload = await verifyToken(body.refreshToken); } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } }, 401);
  }
  if (payload.type !== 'refresh') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token type' } }, 401);
  }
  const user = await User.findById(payload.sub);
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, 401);
  }
  const tokenPayload = tokenPayloadFor(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload), signRefreshToken(tokenPayload),
  ]);
  return c.json({ data: { accessToken, refreshToken } });
}

export async function logout(c: any) {
  return c.json({ data: { message: 'Logged out successfully' } });
}

export async function getMe(c: any) {
  const tokenUser = c.get('user');
  const user = await User.findById(tokenUser.sub);
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ data: await authUserPayload(user) });
}

export async function updateMe(c: any) {
  const tokenUser = c.get('user');
  const body = updateProfileSchema.parse(await c.req.json());
  // Flatten `preferences` to dot-paths so a partial update merges into the
  // existing sub-document instead of replacing it (e.g. toggling one
  // notification must not wipe the others or the saved units).
  const { preferences, ...rest } = body;
  const update: Record<string, unknown> = { ...rest };
  if (preferences) {
    if (preferences.notifications) {
      for (const [key, value] of Object.entries(preferences.notifications)) {
        if (value !== undefined) update[`preferences.notifications.${key}`] = value;
      }
    }
    if (preferences.units !== undefined) update['preferences.units'] = preferences.units;
    if (preferences.searchRadiusKm !== undefined) update['preferences.searchRadiusKm'] = preferences.searchRadiusKm;
  }
  const user = await User.findByIdAndUpdate(tokenUser.sub, update, { new: true });
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ data: await authUserPayload(user) });
}
