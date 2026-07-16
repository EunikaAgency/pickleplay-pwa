import { z } from 'zod';
import { Coach, CoachService } from './coaches.model.js';
import { Venue } from '../venues/venues.model.js';
import { CoachApplication } from '../coach-applications/coach-applications.model.js';
import { CoachReview } from './coach-reviews.model.js';
import { CoachBooking } from '../coach-bookings/coach-bookings.model.js';
import { User } from '../auth/auth.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import {
  activeSubscriberIds, hasActivePartnerSubscription,
} from '../partner-subscriptions/partner-subscriptions.model.js';

const listQuery = z.object({
  venueId: z.string().optional(),
  specialty: z.string().optional(),
  minRating: z.coerce.number().optional(),
  search: z.string().optional(),
  // Find Coach passes this: return only coaches holding a live subscription, so
  // the imported/unclaimed directory profiles don't dilute the list. Left off
  // by default so existing surfaces (venue coach lists, search) don't change.
  subscribed: z.coerce.boolean().optional(),
});

const createCoachReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(5000).optional(),
});

const updateMyCoachSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  coachRoleLabel: z.string().max(200).nullable().optional(),
  specialty: z.string().max(100).nullable().optional(),
  certifications: z.array(z.string().max(100)).optional(),
  languages: z.array(z.string().max(50)).optional(),
  location: z.string().max(100).nullable().optional(),
  cityPrimary: z.string().max(100).nullable().optional(),
  regionsServed: z.array(z.string().max(100)).optional(),
  bio: z.string().max(5000).nullable().optional(),
  experienceYears: z.number().min(0).max(80).nullable().optional(),
  coachingStyle: z.string().max(100).nullable().optional(),
  duprRating: z.number().min(0).max(10).nullable().optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  websiteUrl: z.string().max(2000).nullable().optional(),
  facebookUrl: z.string().max(2000).nullable().optional(),
  instagramUrl: z.string().max(2000).nullable().optional(),
  externalBookingUrl: z.string().max(2000).nullable().optional(),
  rateFrom: z.number().min(0).nullable().optional(),
  pricePrivatePerHour: z.number().min(0).nullable().optional(),
  priceGroupPerPlayer: z.number().min(0).nullable().optional(),
  priceCurrency: z.string().max(10).nullable().optional(),
  bookingLeadTimeHours: z.number().int().min(0).max(720).nullable().optional(),
  isListed: z.boolean().optional(),
  // Per-venue rate overrides. Sent as the full list (a venue omitted here is
  // cleared back to the global rate), and every venueId must be one the coach
  // is actually approved at — checked in updateMyCoach, not by the schema.
  venueRates: z.array(z.object({
    venueId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    pricePrivatePerHour: z.number().min(0).nullable().optional(),
    priceGroupPerPlayer: z.number().min(0).nullable().optional(),
  })).optional(),
});

// Self-service coach profile creation at registration. The profile is created
// unlisted + unverified and must be verified by an admin before it goes public.
const createMyCoachSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  coachRoleLabel: z.string().max(200).optional(),
  specialty: z.string().max(100).optional(),
  certifications: z.array(z.string().max(100)).optional(),
  certificationTier: z.string().max(20).optional(),
  languages: z.array(z.string().max(50)).optional(),
  location: z.string().max(100).optional(),
  cityId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  cityPrimary: z.string().max(100).optional(),
  regionsServed: z.array(z.string().max(100)).optional(),
  bio: z.string().max(5000).optional(),
  experienceYears: z.coerce.number().min(0).max(80).optional(),
  coachingStyle: z.string().max(100).optional(),
  duprRating: z.coerce.number().min(0).max(10).optional(),
  avatarUrl: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  websiteUrl: z.string().max(2000).optional(),
  facebookUrl: z.string().max(2000).optional(),
  instagramUrl: z.string().max(2000).optional(),
  externalBookingUrl: z.string().max(2000).optional(),
  rateFrom: z.coerce.number().min(0).optional(),
  pricePrivatePerHour: z.coerce.number().min(0).optional(),
  priceGroupPerPlayer: z.coerce.number().min(0).optional(),
  priceCurrency: z.string().max(10).optional(),
  bookingLeadTimeHours: z.coerce.number().int().min(0).max(720).optional(),
});

function slugifyName(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return base || 'coach';
}

async function uniqueCoachSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (await Coach.exists({ slug })) slug = `${base}-${++n}`;
  return slug;
}

async function resolveCoachId(id: string): Promise<string | null> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const coach = isObjectId ? await Coach.findById(id).select('_id') : await Coach.findOne({ slug: id }).select('_id');
  return coach ? coach._id.toString() : null;
}

async function findCoachForUser(userId: string) {
  const user = await User.findById(userId).select('_id coachId managedCoachId').lean();
  if (!user) return null;

  const linkedIds = [user.coachId, user.managedCoachId].filter(Boolean);
  const or: Record<string, any>[] = [{ userId: user._id }];
  if (linkedIds.length) {
    or.push({ _id: { $in: linkedIds } });
    or.push({ coachId: { $in: linkedIds.map((id: any) => id.toString()) } });
  }

  return Coach.findOne({ $or: or });
}

/** Every venue the coach works at — linked directly on the profile or granted by
 *  an approved application. This is exactly the set a per-venue rate may target. */
async function approvedVenueIds(coach: any): Promise<string[]> {
  const linked = (coach.venues || []).map((id: any) => id?.toString()).filter(Boolean);
  const or: Record<string, any>[] = [{ coachId: coach._id }];
  if (coach.userId) or.push({ coachUserId: coach.userId });
  const apps = await CoachApplication.find({ status: 'approved', $or: or }).select('venueId').lean();
  const applied = apps.map((a: any) => a.venueId?.toString()).filter(Boolean);
  return [...new Set([...linked, ...applied])];
}

async function coachPayload(coach: any) {
  const coachId = coach._id.toString();

  const [services, venues] = await Promise.all([
    CoachService.find({ coachId }).lean(),
    approvedVenueIds(coach).then((venueIds) => (venueIds.length
      ? Venue.find({ _id: { $in: venueIds } }).select('displayName slug area region fullAddress').lean()
      : [])),
  ]);
  const base = typeof coach.toObject === 'function' ? coach.toObject() : coach;
  const result: Record<string, any> = { ...base, id: coach._id };

  // If the coach has no profile photo, fall back to the linked user's avatar.
  if (!result.avatarUrl && !result.imageUrl && coach.userId) {
    const user = await User.findById(coach.userId).select('avatarUrl skillLevel skillLevelLabel').lean();
    if (user) {
      if (user.avatarUrl) result.avatarUrl = user.avatarUrl;
      result.skillLevel = user.skillLevel ?? null;
      result.skillLevelLabel = user.skillLevelLabel ?? null;
    }
  }

  // Coaching metrics — how many unique students, how many completed sessions.
  const completed = await CoachBooking.countDocuments({ coachId, status: 'completed' });
  if (completed > 0) {
    const students = await CoachBooking.distinct('player', { coachId, status: 'completed' });
    result.completedSessionCount = completed;
    result.studentCount = students.length;
  }

  result.services = services.map((s: any) => ({ ...s, id: s._id }));
  result.venueIds = venues.map((v: any) => v._id);
  result.venues = venues.map((v: any) => ({
    id: v._id,
    name: v.displayName,
    slug: v.slug,
    location: v.area || v.region || v.fullAddress || '',
  }));
  return result;
}

export async function listCoaches(c: any) {
  const filters = listQuery.parse(c.req.query());
  const filter: Record<string, any> = { isListed: true };
  if (filters.venueId) filter.venues = filters.venueId;
  if (filters.specialty) filter.specialty = { $regex: filters.specialty, $options: 'i' };
  if (filters.minRating !== undefined) filter.rating = { $gte: filters.minRating };
  if (filters.search) {
    filter.$or = [
      { displayName: { $regex: filters.search, $options: 'i' } },
      { specialty: { $regex: filters.search, $options: 'i' } },
    ];
  }
  const rows = await Coach.find(filter).sort({ displayName: 1 }).limit(100).lean();

  // Batch-fetch user avatars for coaches without their own photo.
  const needAvatar = rows.filter((r: any) => r.userId && !r.avatarUrl && !r.imageUrl);
  if (needAvatar.length) {
    const userIds = needAvatar.map((r: any) => r.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('_id avatarUrl').lean();
    const byId = new Map(users.map((u: any) => [u._id.toString(), u.avatarUrl]));
    for (const r of needAvatar) {
      const av = byId.get(String(r.userId));
      if (av) r.avatarUrl = av;
    }
  }

  if (filters.subscribed) {
    // A coach is "legit" only while their platform subscription is live. Batch
    // the check (one query for the page) rather than per-row. Imported profiles
    // carry no `userId`, so they can never be subscribed and drop out here.
    const userIds = rows.map((r: any) => r.userId).filter(Boolean);
    const subscribed = await activeSubscriberIds(userIds, 'coach');
    const listed = rows.filter((r: any) => r.userId && subscribed.has(r.userId.toString()));
    return c.json({ data: listed.map((r: any) => ({ ...r, id: r._id })) });
  }

  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function getCoach(c: any) {
  const id = c.req.param('id');
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const coach = isObjectId ? await Coach.findById(id) : await Coach.findOne({ slug: id });
  if (!coach) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach not found' } }, 404);
  return c.json({ data: await coachPayload(coach) });
}

export async function getMyCoach(c: any) {
  const user = c.get('user');
  const coach = await findCoachForUser(user.sub);
  if (!coach) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach profile not found' } }, 404);
  return c.json({ data: await coachPayload(coach) });
}

export async function updateMyCoach(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'coach.profile.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach profile management permission required' } }, 403);
  }

  const coach = await findCoachForUser(user.sub);
  if (!coach) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach profile not found' } }, 404);

  const body = updateMyCoachSchema.parse(await c.req.json());

  if (body.venueRates) {
    // A rate may only target a venue the coach actually works at, or a coach
    // could price venues they have no relationship with.
    const allowed = new Set(await approvedVenueIds(coach));
    const stray = body.venueRates.find((r) => !allowed.has(r.venueId));
    if (stray) {
      return c.json({ error: { code: 'VENUE_NOT_APPROVED', message: 'You are not an approved coach at that venue.' } }, 403);
    }
    // An entry with no prices left on it just means "bill this venue at the
    // global rate" — that's the absence of an override, so don't store a row.
    body.venueRates = body.venueRates.filter(
      (r) => r.pricePrivatePerHour != null || r.priceGroupPerPlayer != null,
    );
  }

  coach.set(body);
  await coach.save();
  return c.json({ data: await coachPayload(coach) });
}

export async function createMyCoach(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'coach.profile.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach profile management permission required' } }, 403);
  }
  // The paid subscription is what unlocks becoming a coach. Checked explicitly
  // (not just via the role) so a lapsed subscription closes the door even while
  // the user still holds a venue-scoped coach grant from an old approval.
  if (!(await hasActivePartnerSubscription(user.sub, 'coach'))) {
    return c.json({ error: { code: 'SUBSCRIPTION_REQUIRED', message: 'A coach subscription is required to create a coach profile.' } }, 402);
  }
  const existing = await findCoachForUser(user.sub);
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'A coach profile already exists for this account' } }, 409);
  }
  const body = createMyCoachSchema.parse(await c.req.json());
  const account = await User.findById(user.sub).select('displayName').lean();
  const displayName = body.displayName || account?.displayName || 'Coach';
  const slug = await uniqueCoachSlug(slugifyName(displayName));
  const coach = await Coach.create({
    ...body,
    displayName,
    slug,
    userId: user.sub,
    isListed: false,
    isVerified: false,
    claimStatus: 'pending',
  });
  await User.findByIdAndUpdate(user.sub, { coachId: coach._id });
  return c.json({ data: await coachPayload(coach) }, 201);
}

export async function listCoachReviews(c: any) {
  const coachId = await resolveCoachId(c.req.param('id'));
  if (!coachId) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach not found' } }, 404);
  const rows = await CoachReview.find({ coachId }).sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function createCoachReview(c: any) {
  const user = c.get('user');
  const coachId = await resolveCoachId(c.req.param('id'));
  if (!coachId) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach not found' } }, 404);
  const existing = await CoachReview.findOne({ coachId, userId: user.sub });
  if (existing) return c.json({ error: { code: 'CONFLICT', message: 'You have already reviewed this coach' } }, 409);
  const body = createCoachReviewSchema.parse(await c.req.json());
  const result = await CoachReview.create({ coachId, userId: user.sub, rating: body.rating, text: body.text || null, status: 'approved' });
  return c.json({ data: result.toObject() }, 201);
}
