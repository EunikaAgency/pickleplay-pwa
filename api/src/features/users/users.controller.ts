import { User, UserRole } from '../auth/auth.model.js';
import { Venue } from '../venues/venues.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { hasActivePartnerSubscription } from '../partner-subscriptions/partner-subscriptions.model.js';

/**
 * GET /users/:id — another player's PUBLIC profile.
 *
 * Deliberately narrow: never leaks email, phone, gcashNumber, or the postal
 * address (which the partner subscription now collects). City/province are the
 * only location granularity shown, matching what a venue listing exposes.
 */
export async function getPublicUser(c: any) {
  const id = c.req.param('id');
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const user = await User.findById(id)
    .select('displayName avatarUrl bio skillLevel skillLevelLabel city province roleDefault privacySetting isVerified coachId createdAt lastActiveAt')
    .lean() as any;
  if (!user || user.isActive === false) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  // A private profile shows only the identity card — no bio, skill, or location.
  const isPrivate = user.privacySetting === 'private';

  // Roles: the account default plus every granted role (global from a partner
  // subscription, venue-scoped from an approved application).
  const grants = await UserRole.find({ userId: user._id }).select('role scopeType scopeId').lean() as any[];
  const roles = [...new Set([user.roleDefault || 'player', ...grants.map((g) => g.role).filter(Boolean)])];

  // Per-venue partner badges — "Coach at Quezon Smash Club".
  const venueGrants = grants.filter((g) => g.scopeType === 'venue' && g.scopeId);
  const venueIds = [...new Set(venueGrants.map((g) => g.scopeId.toString()))];
  const venueRows = venueIds.length
    ? await Venue.find({ _id: { $in: venueIds } }).select('displayName').lean() as any[]
    : [];
  const venueById = new Map(venueRows.map((v) => [v._id.toString(), v.displayName]));
  // A grant can outlive its venue (stale seed rows). Skip those rather than
  // print "Coach at Unknown venue", and collapse duplicate role+venue pairs.
  const seenBadges = new Set<string>();
  const partnerRoles = venueGrants.flatMap((g) => {
    const venueId = g.scopeId.toString();
    const venueName = venueById.get(venueId);
    if (!venueName) return [];
    const key = `${g.role}|${venueId}`;
    if (seenBadges.has(key)) return [];
    seenBadges.add(key);
    return [{ role: g.role, venueId, venueName }];
  });

  // The "Coach" badge means a LIVE subscription, not merely the role — a lapsed
  // coach shouldn't wear the badge or be bookable.
  const isCoach = await hasActivePartnerSubscription(user._id, 'coach');
  const isOrganizer = await hasActivePartnerSubscription(user._id, 'organizer');

  const coach = isCoach && user.coachId
    ? await Coach.findById(user.coachId).select('slug displayName specialty rating reviewCount pricePrivatePerHour priceCurrency isListed').lean() as any
    : null;

  return c.json({
    data: {
      id: user._id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      isVerified: !!user.isVerified,
      bio: isPrivate ? null : (user.bio ?? null),
      skillLevel: isPrivate ? null : (user.skillLevel ?? null),
      skillLevelLabel: isPrivate ? null : (user.skillLevelLabel ?? null),
      city: isPrivate ? null : (user.city ?? null),
      province: isPrivate ? null : (user.province ?? null),
      roles,
      partnerRoles,
      isCoach,
      isOrganizer,
      coach: coach ? {
        id: coach._id,
        slug: coach.slug,
        specialty: coach.specialty ?? null,
        rating: coach.rating ?? 0,
        reviewCount: coach.reviewCount ?? 0,
        pricePrivatePerHour: coach.pricePrivatePerHour ?? null,
        priceCurrency: coach.priceCurrency ?? 'PHP',
      } : null,
      privacySetting: user.privacySetting ?? 'public',
      memberSince: user.createdAt,
    },
  });
}
