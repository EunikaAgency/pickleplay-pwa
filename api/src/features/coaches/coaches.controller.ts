import { z } from 'zod';
import { Coach, CoachService } from './coaches.model.js';
import { Venue } from '../venues/venues.model.js';
import { CoachApplication } from '../coach-applications/coach-applications.model.js';
import { CoachReview } from './coach-reviews.model.js';
import { User } from '../auth/auth.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const listQuery = z.object({
  venueId: z.string().optional(),
  specialty: z.string().optional(),
  minRating: z.coerce.number().optional(),
  search: z.string().optional(),
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

async function coachPayload(coach: any) {
  const coachId = coach._id.toString();
  const linkedVenueIds = (coach.venues || []).map((id: any) => id?.toString()).filter(Boolean);
  const applicationFilter: Record<string, any> = { status: 'approved' };
  const applicationOr: Record<string, any>[] = [{ coachId: coach._id }];
  if (coach.userId) applicationOr.push({ coachUserId: coach.userId });
  applicationFilter.$or = applicationOr;

  const [services, venues] = await Promise.all([
    CoachService.find({ coachId }).lean(),
    CoachApplication.find(applicationFilter).select('venueId').lean()
      .then((apps: any[]) => {
        const applicationVenueIds = apps.map((a) => a.venueId?.toString()).filter(Boolean);
        const venueIds = [...new Set([...linkedVenueIds, ...applicationVenueIds])];
        return venueIds.length
          ? Venue.find({ _id: { $in: venueIds } }).select('displayName slug area region fullAddress').lean()
          : [];
      }),
  ]);
  const base = typeof coach.toObject === 'function' ? coach.toObject() : coach;
  const result: Record<string, any> = { ...base, id: coach._id };
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
  coach.set(body);
  await coach.save();
  return c.json({ data: await coachPayload(coach) });
}

export async function createMyCoach(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'coach.profile.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach profile management permission required' } }, 403);
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
