import { CoachApplication } from '../coach-applications/coach-applications.model.js';
import { shapeOwnerApps } from '../coach-applications/coach-applications.controller.js';
import { OrganizerApplication } from '../organizer-applications/organizer-applications.model.js';
import { shapeOwnerOrganizerApps } from '../organizer-applications/organizer-applications.controller.js';
import { Venue } from '../venues/venues.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// The owner Partners surface: one combined feed of coach + organizer
// applications across the owner's venues, each tagged with its `kind`, plus
// the KPI counts the screen's summary cards render. Partner Revenue has no
// rollup yet (no partner-payment data) — always null in v1.
const COACH_OWNER_PERM = 'owner.coaches.manage' as const;
const ORGANIZER_OWNER_PERM = 'owner.tournaments.manage' as const;
const ADMIN_PERM = 'admin.venues.manage' as const;

// GET /api/v1/partners/owner — coach + organizer applications across every
// venue the current owner owns, newest first, + KPI counts.
export async function getOwnerPartners(c: any) {
  const user = c.get('user');
  const canCoaches = hasPermission(user, COACH_OWNER_PERM);
  const canOrganizers = hasPermission(user, ORGANIZER_OWNER_PERM);
  if (!canCoaches && !canOrganizers && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner partner-management permission required' } }, 403);
  }

  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id displayName slug').lean() as any[];
  const venueIds = venues.map((v) => v._id);
  const empty = { partners: [], kpis: { activeCoaches: 0, activeOrganizers: 0, pendingReview: 0, partnerRevenue: null }, venues: [] };
  if (!venueIds.length) return c.json({ data: empty });

  // Optional per-venue filter (the Partners screen's dropdown).
  const filterVenueId = c.req.query('venueId');
  const scopeIds = filterVenueId && venueIds.some((id: any) => id.toString() === filterVenueId)
    ? [filterVenueId]
    : venueIds;

  // Fetch both kinds in parallel.
  const [coachApps, organizerApps] = await Promise.all([
    canCoaches
      ? CoachApplication.find({ venueId: { $in: scopeIds } })
          .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
          .sort({ createdAt: -1 })
          .lean()
      : [],
    canOrganizers
      ? OrganizerApplication.find({ venueId: { $in: scopeIds } })
          .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  // Shape both kinds, tagged with `kind`.
  const coachRows = (await shapeOwnerApps(coachApps as any[])).map(({ coach, ...rest }: any) => ({
    ...rest,
    kind: 'coach' as const,
    applicant: coach,
  }));
  const organizerRows = (await shapeOwnerOrganizerApps(organizerApps as any[])).map((r: any) => ({
    ...r,
    kind: 'organizer' as const,
  }));

  // Merge, newest first.
  const partners = [...coachRows, ...organizerRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // KPIs — distinct approved applicants per kind.
  const activeCoaches = new Set(
    coachRows.filter((p: any) => p.status === 'approved').map((p: any) => p.applicant.userId?.toString()),
  ).size;
  const activeOrganizers = new Set(
    organizerRows.filter((p: any) => p.status === 'approved').map((p: any) => p.applicant.userId?.toString()),
  ).size;
  const pendingReview = partners.filter((p: any) => p.status === 'pending').length;

  return c.json({
    data: {
      partners,
      kpis: { activeCoaches, activeOrganizers, pendingReview, partnerRevenue: null },
      venues: venues.map((v: any) => ({ id: v._id, name: v.displayName, slug: v.slug })),
    },
  });
}
