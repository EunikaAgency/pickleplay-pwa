import { z } from 'zod';
import { Venue } from './venues.model.js';
import { VenueClaim, SuggestedEdit } from './venue-management.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import { notifyUser } from '../../shared/lib/notify.js';

const createClaimSchema = z.object({
  venueId: z.string(),
  proofDescription: z.string().min(10).max(2000),
  proofDocumentUrls: z.array(z.string()).max(5).optional(),
  // Owner identity verification — who is making the claim.
  claimantLegalName: z.string().max(120).optional(),
  claimantRole: z.string().max(60).optional(),
  claimantContact: z.string().max(160).optional(),
});

const reviewClaimSchema = z.object({
  status: z.enum(['approved', 'rejected', 'needs_info']),
  reviewNotes: z.string().max(1000).optional(),
});

const resubmitClaimSchema = z.object({
  proofDescription: z.string().min(10).max(2000).optional(),
  proofDocumentUrls: z.array(z.string()).max(5).optional(),
});

const createEditSchema = z.object({
  editType: z.string().max(50),
  payloadJson: z.record(z.unknown()),
  sourceNotes: z.string().max(1000).optional(),
});

const reviewEditSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().max(1000).optional(),
});

const reviewVenueSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().max(1000).optional(),
});

export function requireAdmin() {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!hasPermission(user, 'admin.moderation.manage')) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin moderation permission required' } }, 403);
    await next();
  };
}

export async function createClaim(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'owner.venues.claim')) return c.json({ error: { code: 'FORBIDDEN', message: 'Venue claim permission required' } }, 403);
  const body = createClaimSchema.parse(await c.req.json());
  const venue = await Venue.findById(body.venueId).select('state').lean();
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (venue.state === 'claimed') return c.json({ error: { code: 'CONFLICT', message: 'Venue is already claimed' } }, 409);
  const existing = await VenueClaim.findOne({ venueId: body.venueId, claimedByUserId: user.sub, status: 'pending' }).lean();
  if (existing) return c.json({ error: { code: 'CONFLICT', message: 'You already have a pending claim for this venue' } }, 409);
  const result = await VenueClaim.create({
    venueId: body.venueId,
    claimedByUserId: user.sub,
    proofDescription: body.proofDescription,
    proofDocumentUrls: body.proofDocumentUrls,
    claimantLegalName: body.claimantLegalName,
    claimantRole: body.claimantRole,
    claimantContact: body.claimantContact,
  });
  return c.json({ data: result.toObject() }, 201);
}

export async function listClaims(c: any) {
  const status = c.req.query('status');
  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  const rows = await VenueClaim.find(filter).populate('venueId', 'displayName').populate('claimedByUserId', 'displayName').sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueName: r.venueId?.displayName, claimantName: r.claimedByUserId?.displayName })) });
}

export async function reviewClaim(c: any) {
  const user = c.get('user'); const id = c.req.param('id'); const body = reviewClaimSchema.parse(await c.req.json());
  const claim = await VenueClaim.findById(id).lean();
  if (!claim) return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  if (claim.status !== 'pending') return c.json({ error: { code: 'CONFLICT', message: 'Claim has already been reviewed' } }, 409);
  const result = await VenueClaim.findByIdAndUpdate(id, { status: body.status, reviewedBy: user.sub, reviewNotes: body.reviewNotes || null }, { new: true }).lean();
  if (body.status === 'approved') {
    await Venue.findByIdAndUpdate(claim.venueId, { state: 'claimed', ownerUserId: claim.claimedByUserId });
  }
  // Notify claimant on every status change (V6).
  const notif = body.status === 'approved'
    ? { type: 'claim_approved', title: 'Venue claim approved', body: 'Your claim has been approved. The venue is now linked to your account.', icon: 'verified', linkUrl: '/owner/venues' }
    : body.status === 'rejected'
    ? { type: 'claim_rejected', title: 'Venue claim rejected', body: `Your claim was not approved. ${body.reviewNotes ? `Reason: ${body.reviewNotes}` : ''}`, icon: 'cancel', linkUrl: '/owner/venues' }
    : { type: 'claim_needs_info', title: 'More info needed for your claim', body: `The reviewer needs more information. ${body.reviewNotes || ''}`, icon: 'info', linkUrl: '/owner/venues' };
  notifyUser(claim.claimedByUserId.toString(), notif).catch(() => {/* best-effort */});
  return c.json({ data: { ...result, id: result!._id } });
}

/** The current user's own claims — claimant-facing, auth-gated. */
export async function getMyClaims(c: any) {
  const user = c.get('user');
  const rows = await VenueClaim.find({ claimedByUserId: user.sub })
    .populate('venueId', 'displayName slug')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueName: r.venueId?.displayName, venueSlug: r.venueId?.slug })) });
}

/** Single claim detail — claimant or admin. */
export async function getClaim(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const isAdmin = hasPermission(user, 'admin.moderation.manage');
  const filter: Record<string, any> = isAdmin ? { _id: id } : { _id: id, claimedByUserId: user.sub };
  const claim = await VenueClaim.findOne(filter)
    .populate('venueId', 'displayName slug')
    .lean();
  if (!claim) return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  return c.json({ data: { ...claim, id: claim._id, venueName: (claim.venueId as any)?.displayName, venueSlug: (claim.venueId as any)?.slug } });
}

/** Claimant resubmits after a 'needs_info' review — resets status to pending. */
export async function resubmitClaim(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const claim = await VenueClaim.findOne({ _id: id, claimedByUserId: user.sub, status: 'needs_info' }).lean();
  if (!claim) return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found or not in needs_info state' } }, 404);
  const body = resubmitClaimSchema.parse(await c.req.json());
  const update: Record<string, any> = { status: 'pending', reviewNotes: null };
  if (body.proofDescription) update.proofDescription = body.proofDescription;
  if (body.proofDocumentUrls) update.proofDocumentUrls = body.proofDocumentUrls;
  const result = await VenueClaim.findByIdAndUpdate(id, update, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

export async function createSuggestedEdit(c: any) {
  const user = c.get('user'); const venueId = c.req.param('id'); const body = createEditSchema.parse(await c.req.json());
  const venue = await Venue.findById(venueId).select('_id').lean();
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const result = await SuggestedEdit.create({ venueId, suggestedByUserId: user.sub, editType: body.editType, payloadJson: JSON.stringify(body.payloadJson), sourceNotes: body.sourceNotes || null });
  return c.json({ data: result.toObject() }, 201);
}

export async function listSuggestedEdits(c: any) {
  const status = c.req.query('status');
  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  const rows = await SuggestedEdit.find(filter).populate('venueId', 'displayName').populate('suggestedByUserId', 'displayName').sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueName: r.venueId?.displayName, submitterName: r.suggestedByUserId?.displayName })) });
}

export async function reviewSuggestedEdit(c: any) {
  const user = c.get('user'); const id = c.req.param('id'); const body = reviewEditSchema.parse(await c.req.json());
  const edit = await SuggestedEdit.findById(id).lean();
  if (!edit) return c.json({ error: { code: 'NOT_FOUND', message: 'Suggested edit not found' } }, 404);
  if (edit.status !== 'pending') return c.json({ error: { code: 'CONFLICT', message: 'Edit has already been reviewed' } }, 409);
  const result = await SuggestedEdit.findByIdAndUpdate(id, { status: body.status, reviewedBy: user.sub, reviewedAt: new Date() }, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

// Claimed-directory venues land with listingStatus:'pending'. Admins review
// them here; approving publishes the venue, rejecting keeps it out of public
// listings. (Owner-created venues are published immediately — no review needed.)
export async function listPendingVenues(c: any) {
  const rows = await Venue.find({ listingStatus: 'pending' })
    .populate('ownerUserId', 'displayName email')
    .populate('cityId', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return c.json({ data: rows.map((r: any) => ({
    ...r,
    id: r._id,
    ownerName: r.ownerUserId?.displayName,
    ownerEmail: r.ownerUserId?.email,
    cityName: r.cityId?.name,
  })) });
}

export async function reviewVenueApproval(c: any) {
  const id = c.req.param('id');
  const body = reviewVenueSchema.parse(await c.req.json());
  const venue = await Venue.findById(id).select('listingStatus displayName').lean();
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (venue.listingStatus !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Venue is not awaiting approval' } }, 409);
  }
  const listingStatus = body.status === 'approved' ? 'published' : 'rejected';
  const result = await Venue.findByIdAndUpdate(id, { listingStatus }, { new: true })
    .select('displayName slug listingStatus').lean();
  return c.json({ data: { ...result, id: result!._id } });
}
