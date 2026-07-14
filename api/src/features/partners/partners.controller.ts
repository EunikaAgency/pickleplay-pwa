import { CoachApplication } from '../coach-applications/coach-applications.model.js';
import { shapeOwnerApps } from '../coach-applications/coach-applications.controller.js';
import { OrganizerApplication } from '../organizer-applications/organizer-applications.model.js';
import { shapeOwnerOrganizerApps } from '../organizer-applications/organizer-applications.controller.js';
import { Venue } from '../venues/venues.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { CoachBooking } from '../coach-bookings/coach-bookings.model.js';
import { Tournament, TournamentRegistration } from '../content/content.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// The owner Partners surface: one combined feed of coach + organizer
// applications across the owner's venues, each tagged with its `kind`, plus
// the KPI counts the screen's summary cards render.
//
// Every stat here is REAL — read from the coach profile, completed coach
// bookings, and paid tournament registrations. A partner with no history gets
// nulls, and the client renders nothing rather than a placeholder. (Until
// 2026-07-14 the app fabricated these client-side from a hash of the partner's
// NAME — revenue, rating, and even certifications — and showed them to the
// venue owner approving that partner. Never invent a stat here.)
const COACH_OWNER_PERM = 'owner.coaches.manage' as const;
const ORGANIZER_OWNER_PERM = 'owner.tournaments.manage' as const;
const ADMIN_PERM = 'admin.venues.manage' as const;

/** Per-partner stats the Partners cards render. `null` = no data, show nothing. */
export interface PartnerStats {
  specialty: string | null;
  certification: string | null;
  rating: number | null;
  reviewCount: number;
  sessions: number | null;      // coaches: completed lessons
  eventCount: number | null;    // organizers: tournaments run
  revenue: number;              // completed lessons / paid tournament entries
}

const EMPTY_STATS: PartnerStats = {
  specialty: null, certification: null, rating: null,
  reviewCount: 0, sessions: null, eventCount: null, revenue: 0,
};

/**
 * Real stats for every coach userId, in 3 batched queries (never per-partner).
 * Revenue = what the coach earned through completed lessons. Under the 14 July
 * pricing rule the platform takes 0% of it — this is the coach's money, shown
 * to the owner as a measure of activity at their venue.
 */
async function coachStatsFor(userIds: string[]): Promise<Map<string, PartnerStats>> {
  const out = new Map<string, PartnerStats>();
  if (!userIds.length) return out;

  const profiles = await Coach.find({ userId: { $in: userIds } })
    .select('userId specialty certifications certificationTier rating reviewCount')
    .lean() as any[];

  // coachId → userId, so booking rollups land on the right partner.
  const coachToUser = new Map<string, string>();
  for (const p of profiles) coachToUser.set(p._id.toString(), p.userId?.toString());

  const rollup = profiles.length
    ? await CoachBooking.aggregate([
        { $match: { coachId: { $in: profiles.map((p) => p._id) }, status: 'completed' } },
        { $group: { _id: '$coachId', sessions: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      ])
    : [];

  const byCoach = new Map<string, { sessions: number; revenue: number }>();
  for (const r of rollup) byCoach.set(r._id.toString(), { sessions: r.sessions, revenue: r.revenue });

  for (const p of profiles) {
    const uid = p.userId?.toString();
    if (!uid) continue;
    const booked = byCoach.get(p._id.toString());
    // A rating of 0 means "nobody has reviewed them", not "rated zero".
    const rated = p.reviewCount > 0 && p.rating > 0;
    out.set(uid, {
      specialty: p.specialty || null,
      certification: p.certifications?.[0] || p.certificationTier || null,
      rating: rated ? Math.round(p.rating * 10) / 10 : null,
      reviewCount: p.reviewCount || 0,
      sessions: booked?.sessions ?? 0,
      eventCount: null,
      revenue: booked?.revenue ?? 0,
    });
  }
  return out;
}

/**
 * Real stats for every organizer userId, in 2 batched queries.
 * Revenue = entry fee × registrations the organizer has marked PAID (the
 * `paid` flag is their own payment ledger). Unpaid sign-ups earn nothing, so
 * they are not counted.
 */
async function organizerStatsFor(userIds: string[]): Promise<Map<string, PartnerStats>> {
  const out = new Map<string, PartnerStats>();
  if (!userIds.length) return out;

  const tournaments = await Tournament.find({ organizerUserId: { $in: userIds } })
    .select('_id organizerUserId price')
    .lean() as any[];
  if (!tournaments.length) {
    for (const uid of userIds) out.set(uid, { ...EMPTY_STATS, eventCount: 0 });
    return out;
  }

  const paid = await TournamentRegistration.aggregate([
    { $match: { tournamentId: { $in: tournaments.map((t) => t._id) }, paid: true } },
    { $group: { _id: '$tournamentId', n: { $sum: 1 } } },
  ]);
  const paidBy = new Map<string, number>();
  for (const r of paid) paidBy.set(r._id.toString(), r.n);

  for (const uid of userIds) out.set(uid, { ...EMPTY_STATS, eventCount: 0 });
  for (const t of tournaments) {
    const uid = t.organizerUserId?.toString();
    if (!uid) continue;
    const s = out.get(uid) ?? { ...EMPTY_STATS, eventCount: 0 };
    s.eventCount = (s.eventCount ?? 0) + 1;
    s.revenue += (t.price || 0) * (paidBy.get(t._id.toString()) || 0);
    out.set(uid, s);
  }
  return out;
}

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
  // No venues → no partners → ₱0 earned. Zero, never null: the client formats
  // this as money, and a null here white-screened the whole Partners page.
  const empty = { partners: [], kpis: { activeCoaches: 0, activeOrganizers: 0, pendingReview: 0, partnerRevenue: 0 }, venues: [] };
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
  const merged = [...coachRows, ...organizerRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Real stats, batched per kind, then attached to each row.
  const idsOf = (rows: any[]) => [...new Set(
    rows.map((p) => p.applicant?.userId?.toString()).filter(Boolean),
  )] as string[];
  const [coachStats, organizerStats] = await Promise.all([
    coachStatsFor(idsOf(coachRows)),
    organizerStatsFor(idsOf(organizerRows)),
  ]);
  const statsFor = (p: any): PartnerStats => {
    const uid = p.applicant?.userId?.toString();
    const src = p.kind === 'coach' ? coachStats : organizerStats;
    return (uid && src.get(uid)) || EMPTY_STATS;
  };
  const partners = merged.map((p: any) => ({ ...p, stats: statsFor(p) }));

  // KPIs — distinct approved applicants per kind.
  const activeCoaches = new Set(
    coachRows.filter((p: any) => p.status === 'approved').map((p: any) => p.applicant.userId?.toString()),
  ).size;
  const activeOrganizers = new Set(
    organizerRows.filter((p: any) => p.status === 'approved').map((p: any) => p.applicant.userId?.toString()),
  ).size;
  const pendingReview = partners.filter((p: any) => p.status === 'pending').length;

  // Partner revenue — each distinct APPROVED partner counted once (a coach at
  // 5 venues is one coach, not five). Real money only; no partners → ₱0.
  const counted = new Set<string>();
  let partnerRevenue = 0;
  for (const p of partners) {
    if (p.status !== 'approved') continue;
    const uid = p.applicant?.userId?.toString();
    if (!uid) continue;
    const key = `${p.kind}|${uid}`;
    if (counted.has(key)) continue;
    counted.add(key);
    partnerRevenue += p.stats.revenue;
  }

  return c.json({
    data: {
      partners,
      kpis: { activeCoaches, activeOrganizers, pendingReview, partnerRevenue },
      venues: venues.map((v: any) => ({ id: v._id, name: v.displayName, slug: v.slug })),
    },
  });
}
