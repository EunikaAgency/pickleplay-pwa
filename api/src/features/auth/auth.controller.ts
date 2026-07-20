import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User, UserRole, PasswordResetToken, EmailVerificationToken } from './auth.model.js';
import { Venue, VenueStaff } from '../venues/venues.model.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../../shared/lib/jwt.js';
import { resolveRolePermissions } from '../../shared/lib/permissions.js';
import { getOAuthUrl, exchangeCode, isGmailConfigured, hasValidTokens, sendEmail, getStoredTokens } from '../../shared/lib/gmail.js';
import { passwordChangedEmail, passwordResetEmail, welcomeEmail } from '../../shared/lib/email-templates.js';
import { PartnerSubscription, expireLapsedSubscriptions } from '../partner-subscriptions/partner-subscriptions.model.js';

// Public self-registration is limited to player and owner. Everyone signs up as
// a player (or an owner); coach and organizer are NOT sign-up roles — they are
// earned per-venue by applying and being approved by that venue's owner (which
// grants the role via a UserRole record). admin/moderator remain admin-assigned.
// The enum rejects anything else with a 400 before any user is created.
export const REGISTERABLE_ROLES = ['player', 'owner'] as const;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(100),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  role: z.enum(REGISTERABLE_ROLES).default('player'),
  // Optional here, not required: `web` also registers through this endpoint and
  // doesn't collect a gender. The PWA's sign-up form is what requires one.
  gender: z.enum(['male', 'female']).optional(),
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
  // Optional to send, but there's no way to send a blank one — clearing an
  // already-set gender isn't a thing the profile editor offers.
  gender: z.enum(['male', 'female']).optional(),
  // `YYYY-MM-DD`. Empty string clears it — unlike gender, the profile editor
  // does let a user blank out an optional birthday.
  birthday: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
  skillLevel: z.string().optional(),
  skillLevelLabel: z.string().max(20).optional(),
  modePreference: z.enum(['player', 'owner', 'coach', 'organizer']).optional(),
  homeCityId: z.string().optional(),
  address1: z.string().max(200).optional(),
  address2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  zipcode: z.string().max(20).optional(),
  // Coordinates for the address above. Until now nothing wrote these — only a
  // seed script, with random values — while `/friends/suggestions` ranked
  // "people near you" off them.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
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

async function getUserRoles(user: { _id: any; roleDefault?: string | null }) {
  const roles = new Set<string>();
  if (user.roleDefault) roles.add(user.roleDefault);
  // Merge roles granted via per-venue partner applications (coach/organizer at a
  // venue). The UserRole table stores one row per grant; the unique index on
  // (userId, role, scopeType, scopeId) prevents duplicates.
  const grants = await UserRole.find({ userId: user._id }).select('role').lean();
  for (const g of grants as any[]) {
    if (g.role) roles.add(g.role);
  }
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
  const roles = await getUserRoles(user);
  const permissions = resolveRolePermissions(roles);
  // Build per-venue partner badges from venue-scoped UserRole grants (e.g.
  // "Coach at Quezon Smash Club"). These are what the app renders as role chips
  // on the player/owner profile.
  const venueGrants = (await UserRole.find({
    userId: user._id,
    scopeType: 'venue',
    scopeId: { $exists: true, $ne: null },
  }).select('role scopeId').lean()) as any[];
  const venueIds = [...new Set(venueGrants.map((g: any) => g.scopeId?.toString()).filter(Boolean))];
  const venueRows = venueIds.length
    ? await Venue.find({ _id: { $in: venueIds } }).select('displayName').lean()
    : [];
  const venueById = new Map((venueRows as any[]).map((v: any) => [v._id.toString(), v.displayName]));
  // Drop grants whose venue no longer exists (stale seed rows) instead of
  // rendering a row of "Unknown venue" badges, and collapse duplicates.
  const seenBadges = new Set<string>();
  const partnerRoles = venueGrants.flatMap((g: any) => {
    const venueId = g.scopeId?.toString();
    const venueName = venueById.get(venueId);
    if (!venueId || !venueName) return [];
    const key = `${g.role}|${venueId}`;
    if (seenBadges.has(key)) return [];
    seenBadges.add(key);
    return [{ role: g.role, venueId, venueName }];
  });

  // Live partner subscriptions. The app gates the "Become a coach" CTA on THIS,
  // not on the coach role — an approved venue application grants that role
  // without a subscription, and a lapsed subscription leaves it behind.
  await expireLapsedSubscriptions(user._id);
  const liveSubs = await PartnerSubscription.find({
    userId: user._id, status: 'active', expiresAt: { $gt: new Date() },
  }).select('plan').lean() as any[];
  const livePlans = new Set(liveSubs.map((s) => s.plan));

  return {
    coachSubscriptionActive: livePlans.has('coach'),
    organizerSubscriptionActive: livePlans.has('organizer'),
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
    partnerRoles,
    coachId: user.coachId,
    managedCoachId: user.managedCoachId,
    parentOwnerUserId: user.parentOwnerUserId ?? null,
    isActive: user.isActive !== false,
    modePreference: user.modePreference,
    phone: user.phone,
    gender: user.gender ?? null,
    birthday: user.birthday ?? null,
    skillLevel: user.skillLevel,
    skillLevelLabel: user.skillLevelLabel,
    homeCityId: user.homeCityId,
    address1: user.address1,
    address2: user.address2,
    city: user.city,
    province: user.province,
    zipcode: user.zipcode,
    lat: user.lat ?? null,
    lng: user.lng ?? null,
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

async function tokenPayloadFor(user: any) {
  const roles = await getUserRoles(user);
  return {
    sub: user._id.toString(),
    email: user.email,
    role: user.roleDefault || 'player',
    roles,
    permissions: resolveRolePermissions(roles),
    // Carried in the JWT so effectiveOwnerId() can scope a staff member to their
    // owner's resources without a DB lookup on every request. Omitted otherwise.
    // A staff sub-account inherits its owner's whole portfolio — per-venue
    // VenueStaff rows stay additive (they grant manager/front_desk to users who
    // are NOT the owner's staff), they are not the gate.
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
    gender: body.gender || undefined,
    phone: body.phone || undefined,
    homeCityId: body.homeCityId || undefined,
    skillLevel: body.skillLevel,
    skillLevelLabel: body.skillLevelLabel || undefined,
    bio: body.bio || undefined,
    isVerified: false,
  });
  const tokenPayload = await tokenPayloadFor(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload), signRefreshToken(tokenPayload),
  ]);

  // Send welcome email in the background (best-effort, non-blocking).
  if (isGmailConfigured() && hasValidTokens()) {
    const { html, text } = welcomeEmail({ name: body.displayName, role: body.role });
    sendEmail({ to: body.email, subject: `Welcome to PickleBallers, ${body.displayName}!`, body: text, html, userInfo: `${body.displayName} - ${body.role}` })
      .catch((err: Error) => console.error('[register] Welcome email failed:', err.message));
  }

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
  const tokenPayload = await tokenPayloadFor(user);
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
  const tokenPayload = await tokenPayloadFor(user);
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
  // A blank birthday means "clear it", which needs $unset — assigning '' would
  // leave an empty string that reads as a set-but-invalid date downstream.
  const unset: Record<string, ''> = {};
  if (rest.birthday === '') {
    delete update.birthday;
    unset.birthday = '';
  }
  if (preferences) {
    if (preferences.notifications) {
      for (const [key, value] of Object.entries(preferences.notifications)) {
        if (value !== undefined) update[`preferences.notifications.${key}`] = value;
      }
    }
    if (preferences.units !== undefined) update['preferences.units'] = preferences.units;
    if (preferences.searchRadiusKm !== undefined) update['preferences.searchRadiusKm'] = preferences.searchRadiusKm;
  }
  const user = await User.findByIdAndUpdate(
    tokenUser.sub,
    Object.keys(unset).length ? { $set: update, $unset: unset } : update,
    { new: true },
  );
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ data: await authUserPayload(user) });
}

// ── Password reset ────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128),
});

/** POST /auth/forgot-password — generates a reset token for the given email.
 *  Always returns 200 whether or not the email exists (prevents enumeration).
 *  In production the token would be emailed; in dev it's returned inline so
 *  the app can navigate directly to the reset screen. */
export async function forgotPassword(c: any) {
  const body = forgotPasswordSchema.parse(await c.req.json());
  const user = await User.findOne({ email: body.email });
  if (!user) {
    // Don't reveal whether the email exists.
    return c.json({ data: { message: 'If that email is registered, a reset link has been sent.' } });
  }

  // Expire any unused tokens for this user (one active reset at a time).
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await PasswordResetToken.create({ userId: user._id, token, expiresAt });

  // If Gmail OAuth is configured and authorized, send a real email.
  // Otherwise return the token inline so the app can skip the email step.
  let emailed = false;
  if (isGmailConfigured() && hasValidTokens()) {
    try {
      const resetUrl = `${process.env.APP_ORIGIN || 'https://pickleballer-pwa.eunika.xyz'}/reset-password?token=${encodeURIComponent(token)}`;
      const { html, text } = passwordResetEmail(resetUrl);
      await sendEmail({
        to: user.email!,
        subject: 'Reset your PickleBallers password',
        body: text,
        html,
        userInfo: `${user.displayName} - ${user.roleDefault || 'player'}`,
      });
      emailed = true;
    } catch (err) {
      // Email failed — fall back to returning the token inline so the flow
      // isn't broken. Log it so the operator can investigate.
      console.error('[forgot-password] Gmail send failed:', (err as Error).message);
    }
  }

  return c.json({
    data: {
      message: emailed
        ? 'If that email is registered, a reset link has been sent to it.'
        : 'If that email is registered, a reset link has been sent.',
      ...(!emailed ? { token } : {}),
    },
  });
}

/** POST /auth/reset-password — validates the token and sets a new password. */
export async function resetPassword(c: any) {
  const body = resetPasswordSchema.parse(await c.req.json());

  const record = await PasswordResetToken.findOne({ token: body.token, usedAt: null });
  if (!record || record.expiresAt < new Date()) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Reset token is invalid or has expired.' } }, 400);
  }

  const user = await User.findById(record.userId);
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  await User.findByIdAndUpdate(user._id, { passwordHash });

  // Mark the token as used so it can't be reused.
  await PasswordResetToken.findByIdAndUpdate(record._id, { usedAt: new Date() });

  // Send a notification email so the user knows their password was changed.
  if (isGmailConfigured() && hasValidTokens()) {
    try {
      const { html, text } = passwordChangedEmail();
      await sendEmail({
        to: user.email!,
        subject: 'Your PickleBallers password has been changed',
        body: text,
        html,
        userInfo: `${user.displayName} - ${user.roleDefault || 'player'}`,
      });
    } catch (err) {
      console.error('[reset-password] Gmail send failed:', (err as Error).message);
    }
  }

  return c.json({ data: { message: 'Password has been reset. You can now log in.' } });
}

// ── Email verification ───────────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

/** POST /auth/verify-email — validates the token and marks the user's email as verified. */
export async function verifyEmail(c: any) {
  const body = verifyEmailSchema.parse(await c.req.json());

  const record = await EmailVerificationToken.findOne({ token: body.token, verifiedAt: null });
  if (!record || record.expiresAt < new Date()) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Verification token is invalid or has expired.' } }, 400);
  }

  await User.findByIdAndUpdate(record.userId, { isVerified: true });
  await EmailVerificationToken.findByIdAndUpdate(record._id, { verifiedAt: new Date() });

  return c.json({ data: { message: 'Email verified. Thank you!' } });
}

/** POST /auth/resend-verification — generates a new verification token for the
 *  current user (requires auth). In dev the token is returned inline. */
export async function resendVerification(c: any) {
  const tokenUser = c.get('user');
  const user = await User.findById(tokenUser.sub);
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  if (user.isVerified) {
    return c.json({ data: { message: 'Email is already verified.' } });
  }

  // Expire any unused tokens for this email.
  await EmailVerificationToken.updateMany(
    { userId: user._id, verifiedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { verifiedAt: new Date() } },
  );

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await EmailVerificationToken.create({ userId: user._id, email: user.email!, token, expiresAt });

  const devToken = !process.env.EMAIL_FROM ? token : undefined;

  return c.json({
    data: {
      message: 'Verification email sent.',
      ...(devToken ? { token: devToken } : {}),
    },
  });
}

// ── Gmail OAuth 2.0 (admin-only setup) ─────────────────────────────

/** GET /auth/gmail-oauth-url — returns the Google consent-screen URL.
 *  Admin-only — visit this once to authorize the server to send email. */
export async function gmailOAuthUrl(c: any) {
  if (!isGmailConfigured()) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.' } }, 500);
  }
  const url = getOAuthUrl();
  return c.json({ data: { url } });
}

/** GET /auth/gmail-callback — Google redirects here after the admin grants
 *  consent. Exchanges the authorization code for tokens and stores them. */
export async function gmailCallback(c: any) {
  const code = c.req.query('code');
  if (!code) {
    return c.html('<h1>Missing code</h1><p>No authorization code was provided.</p>');
  }
  try {
    const { email } = await exchangeCode(code);
    return c.html(`<!doctype html>
<html><head><title>Gmail Authorized</title>
<style>body{font:16px/1.5 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0fdf4;color:#166534}main{text-align:center;padding:2rem}</style></head>
<body><main><h1>✅ Gmail Authorized</h1><p>PickleBallers can now send email${email ? ` as <strong>${email}</strong>` : ''}.</p><p>You can close this window.</p></main></body></html>`);
  } catch (err) {
    return c.html(`<!doctype html>
<html><head><title>Authorization Failed</title>
<style>body{font:16px/1.5 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2;color:#991b1b}main{text-align:center;padding:2rem}</style></head>
<body><main><h1>❌ Authorization Failed</h1><p>${(err as Error).message}</p><p>Try visiting the OAuth URL again.</p></main></body></html>`);
  }
}

/** GET /auth/gmail-status — check whether Gmail is configured and authorized. */
export async function gmailStatus(c: any) {
  const tokens = getStoredTokens();
  return c.json({
    data: {
      configured: isGmailConfigured(),
      authorized: hasValidTokens(),
      email: tokens?.email ?? null,
    },
  });
}
