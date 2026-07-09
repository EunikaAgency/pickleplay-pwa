import { z } from 'zod';
import {
  OpenPlaySession, Tournament, Event, Post, TournamentRegistration, TournamentAnnouncement,
  TournamentMessage, OpenPlaySeries, OpenPlayRegistration,
} from './content.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUser, notifyUsers } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { resolveVenueId } from '../venues/venues.controller.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const ORGANIZER_PERM = 'organizer.tournaments.manage' as const;
const EVENTS_PERM = 'organizer.events.manage' as const;
const JOIN_PERM = 'player.tournaments.join' as const;
// Statuses a tournament can be in to surface publicly (e.g. on a venue page).
const PUBLIC_TOURNAMENT_STATUSES = ['approved', 'registration_open', 'ongoing', 'completed', 'open'];

const listQuery = z.object({
  venueId: z.string().optional(), city: z.string().optional(), date: z.string().optional(),
  status: z.string().optional(), pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/** Venue fields a session carries for the Play feed — coordinates drive distance
 *  ranking, price drives the card. Kept in sync with VENUE_SELECT in games.controller. */
const SESSION_VENUE_SELECT = 'displayName slug area city lat lng priceFrom priceFromLabel mainImageUrl';

export async function listOpenPlay(c: any) {
  const filters = listQuery.parse(c.req.query());
  const filter: Record<string, any> = { status: 'published' };
  if (filters.venueId) filter.venueId = filters.venueId;
  if (filters.date) filter.date = filters.date;
  else filter.date = { $gte: new Date().toISOString().slice(0, 10) };
  const rows = await OpenPlaySession.find(filter)
    .populate('venueId', SESSION_VENUE_SELECT)
    .sort({ date: 1, startTime: 1 })
    .limit(filters.pageSize)
    .lean();
  return c.json({ data: rows.map(sessionView) });
}

// GET /api/v1/open-play/registrations/mine - every open-play session the current
// player has joined. Used by the player Games tab to fill Open Play > Joined and
// exclude already-joined sessions from Discover.
export async function getMyOpenPlayRegistrations(c: any) {
  const user = c.get('user');
  const regs = await OpenPlayRegistration.find({ userId: user.sub }).select('sessionId status').lean();
  return c.json({
    data: regs.map((r: any) => ({ sessionId: r.sessionId?.toString(), status: r.status })),
  });
}

// GET /api/v1/open-play/:id - public session detail. The user's registration is
// included when authenticated so the app can render Join/Leave correctly.
export async function getOpenPlaySession(c: any) {
  const id = c.req.param('id');
  const sess = await OpenPlaySession.findById(id).populate('venueId', SESSION_VENUE_SELECT).lean();
  if (!sess) return c.json({ error: { code: 'NOT_FOUND', message: 'Open Play session not found' } }, 404);
  const user = c.get('user');
  const reg = user
    ? await OpenPlayRegistration.findOne({ sessionId: (sess as any)._id, userId: user.sub }).select('status').lean()
    : null;
  // Open Play is interest-based: everyone who tapped "I'm Interested" (a registration)
  // is surfaced so the detail can show how many and WHO are interested.
  const regs = await OpenPlayRegistration.find({ sessionId: (sess as any)._id, status: 'registered' }).select('userId').lean();
  const uids = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  const users = uids.length
    ? await User.find({ _id: { $in: uids } }).select('displayName avatarUrl').lean()
    : [];
  const interestedUsers = (users as any[]).map((u) => ({ id: String(u._id), displayName: u.displayName, avatarUrl: u.avatarUrl ?? null }));
  return c.json({ data: {
    ...sessionView(sess),
    myRegistrationStatus: (reg as any)?.status ?? null,
    interestedUsers,
    interestedCount: interestedUsers.length,
  } });
}

export async function listTournaments(c: any) {
  const filters = listQuery.parse(c.req.query());
  const filter: Record<string, any> = {
    status: filters.status || { $in: PUBLIC_TOURNAMENT_STATUSES },
    $or: [{ visibility: "public" }, { visibility: { $exists: false } }],
  };
  // Scope to one venue (used by the venue detail page). Accepts a slug or _id;
  // an unknown venue yields an empty list rather than a cast error. When
  // filtering by venue we only surface publicly-visible, non-draft tournaments.
  if (filters.venueId) {
    const venueId = await resolveVenueId(filters.venueId);
    if (!venueId) return c.json({ data: [] });
    filter.venueId = venueId;
    if (!filters.status) filter.status = { $in: PUBLIC_TOURNAMENT_STATUSES };
    filter.$or = [{ visibility: 'public' }, { visibility: { $exists: false } }];
  }
  const rows = await Tournament.find(filter).populate('venueId', 'displayName slug').sort({ startDate: 1 }).limit(filters.pageSize).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueName: r.venueId?.displayName, venueSlug: r.venueId?.slug })) });
}

export async function listEvents(c: any) {
  const filters = listQuery.parse(c.req.query());
  const filter: Record<string, any> = { status: 'published' };
  if (filters.venueId) filter.venueId = filters.venueId;
  const rows = await Event.find(filter).populate('venueId', 'displayName slug').sort({ date: 1 }).limit(filters.pageSize).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id, venueName: r.venueId?.displayName, venueSlug: r.venueId?.slug })) });
}

export async function listPosts(c: any) {
  const rows = await Post.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

/* ─── Organizer tournament management ─────────────────────────────────
 * Organizers (organizer.tournaments.manage) create and manage their own
 * tournaments. The venue link + reservation happen separately via the
 * tournament-applications feature (owner approval). See its controller.
 */

function slugifyTournament(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'tournament';
}

async function uniqueTournamentSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Tournament.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 100);
  }
  return slug;
}

// Shape a tournament document for organizer-facing responses.
function tournamentView(t: any) {
  if (!t) return null;
  const { _id, ...rest } = t;
  return { id: _id, ...rest, venueName: t.venueId?.displayName, venueSlug: t.venueId?.slug };
}

// The editable field set, shared by create + update (slug/status/venue are
// managed by the server, not set directly here).
const tournamentInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  tournamentType: z.enum(['singles', 'doubles', 'mixed', 'team']).optional(),
  skillLevel: z.string().max(50).optional(),
  ageDivision: z.string().max(100).optional(),
  genderDivision: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  registrationOpenDate: z.string().optional(),
  registrationCloseDate: z.string().optional(),
  checkInTime: z.string().optional(),
  matchStartTime: z.string().optional(),
  courtsRequired: z.coerce.number().int().min(1).optional(),
  maxPlayers: z.coerce.number().int().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  allowWaitlist: z.boolean().optional(),
  format: z.string().max(100).optional(),
  matchFormat: z.enum(['bo1', 'bo3', 'bo5']).optional(),
  pointsPerGame: z.coerce.number().refine((n) => [11, 15, 21].includes(n), 'invalid points').optional(),
  prizeChampion: z.string().optional(),
  prizeRunnerUp: z.string().optional(),
  prizeThird: z.string().optional(),
  organizerName: z.string().max(200).optional(),
  organizerPhone: z.string().max(50).optional(),
  contactEmail: z.string().max(255).optional(),
  rules: z.string().optional(),
  refundPolicy: z.string().optional(),
  visibility: z.enum(['public', 'private', 'invite_only']).optional(),
  bannerUrl: z.string().optional(),
});

// POST /api/v1/tournaments — create a draft tournament owned by the organizer.
export async function createTournament(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403);
  }
  const body = tournamentInput.parse(await c.req.json());
  const slug = await uniqueTournamentSlug(slugifyTournament(body.name));
  const created = await Tournament.create({
    ...body,
    slug,
    organizerUserId: user.sub,
    status: 'draft',
  });
  return c.json({ data: tournamentView(created.toObject()) }, 201);
}

// GET /api/v1/tournaments/mine — the organizer's own tournaments, newest first.
export async function getMyTournaments(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403);
  }
  const rows = await Tournament.find({ organizerUserId: user.sub })
    .populate('venueId', 'displayName slug')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: rows.map(tournamentView) });
}

// GET /api/v1/tournaments/:id — detail. Owner sees their own at any status;
// everyone else only public tournaments. Accepts _id or slug.
export async function getTournament(c: any) {
  const idOrSlug = c.req.param('id');
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
  const t = await Tournament.findOne(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug })
    .populate('venueId', 'displayName slug')
    .lean();
  if (!t) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  const user = c.get('user');
  const isOwner = user && (t as any).organizerUserId?.toString() === user.sub;
  if (!isOwner && (t as any).visibility && (t as any).visibility !== 'public') {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  }
  return c.json({ data: tournamentView(t) });
}

// Load a tournament owned by the current user, or return the error response.
// Discriminated on `ok` so callers narrow `tournament` cleanly.
async function loadOwnedTournament(c: any): Promise<
  { ok: true; tournament: any } | { ok: false; res: any }
> {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return { ok: false, res: c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403) };
  }
  const t = await Tournament.findById(c.req.param('id'));
  if (!t) return { ok: false, res: c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404) };
  if (t.organizerUserId?.toString() !== user.sub) {
    return { ok: false, res: c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this tournament' } }, 403) };
  }
  return { ok: true, tournament: t };
}

// PATCH /api/v1/tournaments/:id — edit an owned tournament.
export async function updateTournament(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const body = tournamentInput.partial().parse(await c.req.json());
  Object.assign(tournament, body);
  await tournament.save();
  const populated = await tournament.populate('venueId', 'displayName slug');
  return c.json({ data: tournamentView(populated.toObject()) });
}

// PATCH /api/v1/tournaments/:id/cancel — cancel an owned tournament.
export async function cancelTournament(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  tournament.status = 'cancelled';
  await tournament.save();
  // Tell everyone registered/waitlisted the tournament is off (best-effort).
  const regs = await TournamentRegistration.find({ tournamentId: tournament._id }).select('userId').lean();
  const recipientIds = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  if (recipientIds.length) {
    await notifyUsers(recipientIds, {
      type: 'tournament',
      title: 'Tournament cancelled',
      body: `${tournament.title || 'A tournament you registered for'} has been cancelled by the organizer.`,
      icon: 'event_busy',
      linkUrl: `/tournaments/${tournament.slug}`,
      tag: `tournament-cancel-${tournament._id}`,
    });
  }
  return c.json({ data: { id: tournament._id, status: tournament.status } });
}

// PATCH /api/v1/tournaments/:id/open-registration — owner opens registration
// (approved → registration_open) so players can join.
export async function openTournamentRegistration(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  if (!['approved', 'registration_open'].includes(tournament.status)) {
    return c.json({ error: { code: 'CONFLICT', message: 'Registration can only be opened once the venue has approved the tournament' } }, 409);
  }
  tournament.status = 'registration_open';
  await tournament.save();
  return c.json({ data: { id: tournament._id, status: tournament.status } });
}

/* ─── Tournament registration (players join) ──────────────────────────
 * Players (player.tournaments.join) register for tournaments that are open
 * for registration. Capacity is `maxPlayers`; when full, a waitlist is used
 * if the organizer allowed one, otherwise the join is rejected.
 */

// Confirmed-spot count (waitlisted/pending entries don't consume a spot).
async function confirmedCount(tournamentId: any): Promise<number> {
  return TournamentRegistration.countDocuments({ tournamentId, status: 'registered' });
}

// Promote the oldest waitlisted player to a freed spot and notify them.
async function promoteNextTournamentWaitlist(tournamentId: any): Promise<any> {
  const next = await TournamentRegistration.findOne({ tournamentId, status: 'waitlisted' }).sort({ createdAt: 1 });
  if (!next) return null;
  next.status = 'registered';
  await next.save();
  await notifyUser(next.userId, {
    type: 'tournament', title: "You're in!",
    body: "A spot opened up — you've been moved off the waitlist into the tournament.",
    icon: 'how_to_reg', linkUrl: '/tournaments',
  });
  return next;
}

// POST /api/v1/tournaments/:id/register
export async function registerForTournament(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, JOIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Permission to join tournaments required' } }, 403);
  }
  // Organizers manage tournaments — they don't register as competitors.
  if (hasPermission(user, 'organizer.access')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer accounts manage tournaments — they cannot register as a competitor.' } }, 403);
  }
  const tournament = await Tournament.findById(c.req.param('id'));
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  // `registration_open` is the lifecycle status; `open` is the legacy/seed
  // equivalent the public catalogue (PUBLIC_TOURNAMENT_STATUSES) also exposes as
  // joinable — accept both so discoverable tournaments are actually registerable.
  if (tournament.status !== 'registration_open' && tournament.status !== 'open') {
    return c.json({ error: { code: 'CONFLICT', message: 'Registration is not open for this tournament' } }, 409);
  }

  const existing = await TournamentRegistration.findOne({ tournamentId: tournament._id, userId: user.sub }).lean();
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'You are already registered' }, status: (existing as any).status }, 409);
  }

  const max = tournament.maxPlayers ?? 0;
  const taken = await confirmedCount(tournament._id);
  const full = max > 0 && taken >= max;
  if (full && !tournament.allowWaitlist && tournament.visibility !== 'invite_only') {
    return c.json({ error: { code: 'CONFLICT', message: 'This tournament is full' } }, 409);
  }
  // Invite-only tournaments hold every join for organizer approval; otherwise
  // confirm if there's room, else waitlist.
  const status = tournament.visibility === 'invite_only' ? 'pending' : (full ? 'waitlisted' : 'registered');

  const reg = await TournamentRegistration.create({ tournamentId: tournament._id, userId: user.sub, status });
  if (status === 'registered') {
    await Tournament.updateOne({ _id: tournament._id }, { registeredPlayers: taken + 1 });
  }
  return c.json({ data: { id: reg._id, status: reg.status } }, 201);
}

// POST /api/v1/tournaments/:id/withdraw — player withdraws their registration.
export async function withdrawFromTournament(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, JOIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Permission to join tournaments required' } }, 403);
  }
  const tournamentId = c.req.param('id');
  const reg = await TournamentRegistration.findOneAndDelete({ tournamentId, userId: user.sub });
  if (!reg) return c.json({ error: { code: 'NOT_FOUND', message: 'You are not registered' } }, 404);
  if ((reg as any).status === 'registered') {
    await promoteNextTournamentWaitlist(tournamentId);   // fill the freed spot
    const taken = await confirmedCount(tournamentId);
    await Tournament.updateOne({ _id: tournamentId }, { registeredPlayers: taken });
  }
  return c.json({ data: { ok: true } });
}

// GET /api/v1/tournaments/:id/my-registration — current user's registration
// (or null). Drives the Join button state.
export async function getMyTournamentRegistration(c: any) {
  const user = c.get('user');
  if (!user) return c.json({ data: null });
  const reg = await TournamentRegistration.findOne({ tournamentId: c.req.param('id'), userId: user.sub }).lean();
  return c.json({ data: reg ? { id: (reg as any)._id, status: (reg as any).status } : null });
}

// GET /api/v1/tournaments/registrations/mine — every tournament the current
// user has registered for ({ tournamentId, status }), in one call. Backs the
// player Tournament tab's "Joined" filter + the "not already joined" exclusion
// on Open (so the UI doesn't probe my-registration tournament-by-tournament).
export async function getMyTournamentRegistrations(c: any) {
  const user = c.get('user');
  if (!user) return c.json({ data: [] });
  const regs = await TournamentRegistration.find({ userId: user.sub }).select('tournamentId status').lean();
  return c.json({
    data: regs.map((r: any) => ({ tournamentId: r.tournamentId?.toString(), status: r.status })),
  });
}

// GET /api/v1/tournaments/:id/registrations — participant list. Organizer
// (tournament owner) or admin only.
export async function getTournamentRegistrations(c: any) {
  const user = c.get('user');
  const tournament = await Tournament.findById(c.req.param('id')).select('organizerUserId');
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  const isOwner = tournament.organizerUserId?.toString() === user?.sub;
  if (!isOwner && !hasPermission(user, 'admin.venues.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the organizer can view participants' } }, 403);
  }
  const regs = await TournamentRegistration.find({ tournamentId: tournament._id }).sort({ createdAt: 1 }).lean();
  const userIds = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('displayName avatarUrl email').lean()
    : [];
  const userById = new Map((users as any[]).map((u) => [u._id.toString(), u]));
  const data = regs.map((r: any) => {
    const u = userById.get(r.userId?.toString());
    return {
      id: r._id,
      status: r.status,
      attended: !!r.attended,
      paid: !!r.paid,
      paymentNote: r.paymentNote || '',
      createdAt: r.createdAt,
      player: { userId: r.userId, name: u?.displayName || 'Player', email: u?.email || '', avatar: u?.avatarUrl || null },
    };
  });
  return c.json({ data });
}

// Organizer manages one registration: mark attendance (check-in), approve a
// pending/waitlisted join, or decline (remove) it.
const manageRegInput = z.object({
  attended: z.boolean().optional(),
  paid: z.boolean().optional(),
  paymentNote: z.string().max(200).optional(),
  action: z.enum(['approve', 'decline']).optional(),
});

// PATCH /api/v1/tournaments/:id/registrations/:regId
export async function manageTournamentRegistration(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const reg = await TournamentRegistration.findOne({ _id: c.req.param('regId'), tournamentId: tournament._id });
  if (!reg) return c.json({ error: { code: 'NOT_FOUND', message: 'Registration not found' } }, 404);
  const body = manageRegInput.parse(await c.req.json());

  if (body.action === 'decline') {
    const declinedUserId = reg.userId;
    await reg.deleteOne();
    const taken = await confirmedCount(tournament._id);
    await Tournament.updateOne({ _id: tournament._id }, { registeredPlayers: taken });
    // Let the player know their request wasn't accepted (best-effort).
    await notifyUser(declinedUserId, {
      type: 'tournament',
      title: 'Registration declined',
      body: `Your registration for ${tournament.title || 'the tournament'} wasn't accepted.`,
      icon: 'cancel',
      linkUrl: `/tournaments/${tournament.slug}`,
      tag: `tournament-reg-${reg._id}`,
    });
    return c.json({ data: { id: reg._id, removed: true } });
  }
  if (body.action === 'approve') {
    const max = tournament.maxPlayers ?? 0;
    const taken = await confirmedCount(tournament._id);
    if (max > 0 && taken >= max) {
      return c.json({ error: { code: 'CONFLICT', message: 'Tournament is full' } }, 409);
    }
    reg.status = 'registered';
    // Confirm the spot to the player (best-effort).
    await notifyUser(reg.userId, {
      type: 'tournament',
      title: "You're in!",
      body: `Your spot in ${tournament.title || 'the tournament'} is confirmed.`,
      icon: 'how_to_reg',
      linkUrl: `/tournaments/${tournament.slug}`,
      tag: `tournament-reg-${reg._id}`,
    });
  }
  if (typeof body.attended === 'boolean') reg.attended = body.attended;
  if (typeof body.paid === 'boolean') reg.paid = body.paid;
  if (typeof body.paymentNote === 'string') reg.paymentNote = body.paymentNote;
  await reg.save();
  const taken = await confirmedCount(tournament._id);
  await Tournament.updateOne({ _id: tournament._id }, { registeredPlayers: taken });
  return c.json({ data: { id: reg._id, status: reg.status, attended: reg.attended, paid: reg.paid, paymentNote: reg.paymentNote } });
}

/* ─── Tournament announcements (organizer → participants) ──────────────
 * The organizer broadcasts a message to everyone registered/waitlisted for a
 * tournament — schedule changes, venue moves, general notices. Each send is
 * stored as a durable feed entry AND fanned out as a Notification per player.
 * Gated by the same `organizer.tournaments.manage` + ownership as other
 * tournament management (managing a tournament includes messaging its players).
 */

// `kind` → the icon shown on the notification + the feed entry.
const ANNOUNCEMENT_ICONS: Record<string, string> = {
  general: 'campaign',
  schedule: 'event',
  venue: 'place',
};

const announcementInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  kind: z.enum(['general', 'schedule', 'venue']).optional().default('general'),
});

function announcementView(a: any) {
  if (!a) return null;
  const { _id, ...rest } = a;
  return { id: _id, ...rest };
}

// POST /api/v1/tournaments/:id/announcements — broadcast to participants.
export async function createTournamentAnnouncement(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const body = announcementInput.parse(await c.req.json());

  // Recipients: everyone registered or waitlisted for this tournament.
  const regs = await TournamentRegistration.find({ tournamentId: tournament._id }).select('userId').lean();
  const recipientIds = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];

  const icon = ANNOUNCEMENT_ICONS[body.kind] || 'campaign';
  const linkUrl = `/tournaments/${tournament.slug}`;
  if (recipientIds.length) {
    await notifyUsers(recipientIds, {
      type: 'tournament',
      title: body.title,
      body: body.body,
      icon,
      linkUrl,
    });
  }

  const ann = await TournamentAnnouncement.create({
    tournamentId: tournament._id,
    organizerUserId: tournament.organizerUserId,
    kind: body.kind,
    title: body.title,
    body: body.body,
    recipientCount: recipientIds.length,
  });
  return c.json({ data: announcementView(ann.toObject()), recipientCount: recipientIds.length }, 201);
}

// GET /api/v1/tournaments/:id/announcements — announcement feed for a
// tournament (newest first). Readable by anyone who can see the tournament so
// participants get the reschedule/venue notices in context.
export async function listTournamentAnnouncements(c: any) {
  const tournamentId = c.req.param('id');
  const rows = await TournamentAnnouncement.find({ tournamentId }).sort({ createdAt: -1 }).limit(100).lean();
  return c.json({ data: rows.map(announcementView) });
}

/* ─── Tournament participant group chat ───────────────────────────────
 * Two-way roster chat (organizer + every registrant), mirroring the game chat.
 * Read = roster membership; send = roster + player.tournaments.chat. Each send
 * fans a realtime event to other roster members' open apps + a notification.
 */

const isObjectIdStr = (s: string) => /^[0-9a-fA-F]{24}$/.test(s);

// True if the user is the organizer of, or has any registration row in, the
// tournament — i.e. allowed in the participant chat.
async function canAccessTournamentChat(tournament: any, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  if (tournament.organizerUserId?.toString() === userId) return true;
  const reg = await TournamentRegistration.findOne({ tournamentId: tournament._id, userId }).select('_id').lean();
  return !!reg;
}

function tournamentMessageView(m: any, meId: string) {
  const sid = String(m.senderId?._id ?? m.senderId);
  return {
    id: String(m._id),
    senderId: sid,
    senderName: m.senderId?.displayName ?? 'Player',
    senderAvatarUrl: m.senderId?.avatarUrl ?? null,
    body: m.body,
    createdAt: m.createdAt,
    mine: sid === meId,
  };
}

// GET /tournaments/:id/messages — roster group chat. Roster membership required.
export async function listTournamentMessages(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!isObjectIdStr(id)) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  const tournament = await Tournament.findById(id).select('organizerUserId name slug').lean();
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  if (!(await canAccessTournamentChat(tournament, user?.sub))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Register for this tournament to see its chat' } }, 403);
  }
  const rows = await TournamentMessage.find({ tournamentId: id })
    .sort({ createdAt: 1 }).limit(200)
    .populate({ path: 'senderId', select: 'displayName avatarUrl' })
    .lean();
  const messages = rows.map((m: any) => tournamentMessageView(m, user.sub));
  return c.json({ data: { tournamentId: id, title: (tournament as any).name || null, messages } });
}

// POST /tournaments/:id/messages — post to the roster chat. Roster + player.tournaments.chat.
export async function sendTournamentMessage(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.tournaments.chat')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tournament chat permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!isObjectIdStr(id)) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  const tournament = await Tournament.findById(id).select('organizerUserId name slug').lean();
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  if (!(await canAccessTournamentChat(tournament, user.sub))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Register for this tournament to chat' } }, 403);
  }
  const body = z.object({ body: z.string().min(1).max(4000) }).parse(await c.req.json()).body;
  const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
  const now = new Date();
  const msg = await TournamentMessage.create({ tournamentId: id, senderId: user.sub, body });
  const senderName = (me as any)?.displayName ?? 'Player';
  const view = {
    id: String((msg as any)._id),
    senderId: String(user.sub),
    senderName,
    senderAvatarUrl: (me as any)?.avatarUrl ?? null,
    body,
    createdAt: now,
  };
  // Realtime fan-out to every OTHER roster member (organizer + registrants) +
  // a collapsed notification so they're alerted when not in the chat.
  const regs = await TournamentRegistration.find({ tournamentId: id }).select('userId').lean();
  const roster = [String((tournament as any).organizerUserId), ...regs.map((r: any) => String(r.userId))];
  const others = [...new Set(roster)].filter((uid) => uid && uid !== 'undefined' && uid !== user.sub);
  others.forEach((uid) => publishUserEvent(uid, 'tournament.message.created', { tournamentId: id, message: { ...view, mine: false } }));
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  await notifyUsers(others, {
    type: 'tournament_message',
    title: `${senderName} · ${(tournament as any).name || 'Tournament'}`,
    body: preview,
    icon: 'chat',
    linkUrl: `/tournaments/${(tournament as any).slug}/chat`,
    tag: `tournament-chat-${id}`,
  });
  return c.json({ data: { ...view, mine: true } }, 201);
}

/* ─── Recurring open-play sessions (organizer-managed) ─────────────────
 * Organizers (organizer.events.manage) define a weekly series; creating it
 * stamps out individual session instances over a horizon. Players join an
 * instance (capacity → waitlist); the organizer sees the roster and can cancel
 * one instance (weather) or the whole series. This finishes the previously
 * read-only OpenPlaySession surface.
 */

function slugifyBase(s: string): string {
  return (s || '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'open-play';
}

async function uniqueOpenPlaySlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await OpenPlaySession.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 100);
  }
  return slug;
}

// Upcoming YYYY-MM-DD dates matching the given weekdays, today → weeksAhead out.
function generateSessionDates(daysOfWeek: number[], weeksAhead: number): string[] {
  const out: string[] = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + Math.max(1, weeksAhead) * 7);
  const wanted = new Set(daysOfWeek.filter((d) => d >= 0 && d <= 6));
  const cur = new Date(start);
  while (cur <= end && out.length < 80) {
    if (wanted.has(cur.getDay())) out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const seriesInput = z.object({
  title: z.string().min(1).max(200),
  venueId: z.string().min(1),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  levelLabel: z.string().max(50).optional(),
  skillLevelMin: z.coerce.number().optional(),
  skillLevelMax: z.coerce.number().optional(),
  price: z.coerce.number().min(0).optional().default(0),
  capacity: z.coerce.number().int().min(1).max(200).optional().default(8),
  description: z.string().optional(),
  weeksAhead: z.coerce.number().int().min(1).max(26).optional().default(8),
});

function seriesView(s: any) {
  if (!s) return null;
  const { _id, ...rest } = s;
  return { id: _id, ...rest, venueName: s.venueId?.displayName, venueSlug: s.venueId?.slug };
}

function sessionView(s: any) {
  if (!s) return null;
  const { _id, ...rest } = s;
  const v = s.venueId && typeof s.venueId === 'object' ? s.venueId : null;
  return {
    id: _id,
    ...rest,
    venueId: v ? String(v._id) : (s.venueId ? String(s.venueId) : null),
    venueName: v?.displayName,
    venueSlug: v?.slug,
    // Venue location + pricing, mirroring the game serializer's `venue` block so
    // the Play feed can rank and render sessions and games the same way. Null
    // whenever the caller populated a narrower select.
    venueArea: v?.area ?? null,
    venueCity: v?.city ?? null,
    venueLat: v?.lat ?? null,
    venueLng: v?.lng ?? null,
    venueImage: v?.mainImageUrl ?? null,
    priceFrom: v?.priceFrom ?? null,
    priceFromLabel: v?.priceFromLabel ?? null,
  };
}

// Map registration rows → player cards (shared shape with tournaments).
async function hydratePlayers(regs: any[]) {
  const userIds = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('displayName avatarUrl email').lean()
    : [];
  const byId = new Map((users as any[]).map((u) => [u._id.toString(), u]));
  return regs.map((r: any) => {
    const u = byId.get(r.userId?.toString());
    return {
      id: r._id,
      status: r.status,
      attended: !!r.attended,
      paid: !!r.paid,
      paymentNote: r.paymentNote || '',
      createdAt: r.createdAt,
      player: { userId: r.userId, name: u?.displayName || 'Player', email: u?.email || '', avatar: u?.avatarUrl || null },
    };
  });
}

// POST /api/v1/open-play — create a recurring series + generate instances.
export async function createOpenPlaySeries(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, EVENTS_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer events permission required' } }, 403);
  }
  const body = seriesInput.parse(await c.req.json());
  const venueId = await resolveVenueId(body.venueId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const series = await OpenPlaySeries.create({ ...body, venueId, organizerUserId: user.sub, status: 'active' });
  const u = await User.findById(user.sub).select('displayName').lean();
  const dates = generateSessionDates(body.daysOfWeek, body.weeksAhead ?? 8);
  const base = slugifyBase(body.title);
  let instanceCount = 0;
  for (const date of dates) {
    // eslint-disable-next-line no-await-in-loop
    const slug = await uniqueOpenPlaySlug(`${base}-${date}`);
    // eslint-disable-next-line no-await-in-loop
    await OpenPlaySession.create({
      slug, title: body.title, venueId, organizerUserId: user.sub, seriesId: series._id,
      date, startTime: body.startTime, endTime: body.endTime,
      levelLabel: body.levelLabel, skillLevelMin: body.skillLevelMin, skillLevelMax: body.skillLevelMax,
      price: body.price ?? 0, capacity: body.capacity ?? 8,
      organizerName: (u as any)?.displayName || undefined, organizerType: 'organizer',
      isRecurring: true, description: body.description, status: 'published',
    });
    instanceCount += 1;
  }
  return c.json({ data: { series: seriesView(series.toObject()), instanceCount } }, 201);
}

// GET /api/v1/open-play/mine — the organizer's series + all their session
// instances (the console groups sessions under their series).
export async function getMyOpenPlay(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, EVENTS_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer events permission required' } }, 403);
  }
  const [series, sessions] = await Promise.all([
    OpenPlaySeries.find({ organizerUserId: user.sub }).populate('venueId', 'displayName slug').sort({ createdAt: -1 }).lean(),
    OpenPlaySession.find({ organizerUserId: user.sub }).populate('venueId', 'displayName slug').sort({ date: 1 }).lean(),
  ]);
  return c.json({ data: { series: series.map(seriesView), sessions: sessions.map(sessionView) } });
}

// PATCH /api/v1/open-play/series/:id/cancel — cancel a series + its future
// instances (past/completed ones are left as history).
export async function cancelOpenPlaySeries(c: any) {
  const user = c.get('user');
  const series = await OpenPlaySeries.findById(c.req.param('id'));
  if (!series) return c.json({ error: { code: 'NOT_FOUND', message: 'Series not found' } }, 404);
  if (!hasPermission(user, EVENTS_PERM) || series.organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this series' } }, 403);
  }
  series.status = 'cancelled';
  await series.save();
  const today = new Date().toISOString().slice(0, 10);
  await OpenPlaySession.updateMany(
    { seriesId: series._id, date: { $gte: today }, status: 'published' },
    { status: 'cancelled' },
  );
  return c.json({ data: { id: series._id, status: 'cancelled' } });
}

// PATCH /api/v1/open-play/:id/cancel — cancel a single session instance and
// notify everyone who joined (e.g. weather).
export async function cancelOpenPlaySession(c: any) {
  const user = c.get('user');
  const sess = await OpenPlaySession.findById(c.req.param('id'));
  if (!sess) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);
  if (!hasPermission(user, EVENTS_PERM) || sess.organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403);
  }
  sess.status = 'cancelled';
  await sess.save();
  const regs = await OpenPlayRegistration.find({ sessionId: sess._id }).select('userId').lean();
  const ids = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  if (ids.length) {
    await notifyUsers(ids, {
      type: 'open_play', title: 'Session cancelled',
      body: `"${sess.title}" on ${sess.date} was cancelled by the organizer.`,
      icon: 'event_busy', linkUrl: '/open-play',
    });
  }
  return c.json({ data: { id: sess._id, status: 'cancelled' } });
}

// Interest count for a session (everyone who tapped "I'm Interested").
async function sessionConfirmedCount(sessionId: any): Promise<number> {
  return OpenPlayRegistration.countDocuments({ sessionId, status: 'registered' });
}

// POST /api/v1/open-play/:id/join — player marks interest in a session.
export async function joinOpenPlay(c: any) {
  const user = c.get('user');
  const sess = await OpenPlaySession.findById(c.req.param('id'));
  if (!sess) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);
  if (sess.status !== 'published') {
    return c.json({ error: { code: 'CONFLICT', message: 'This session is not open' } }, 409);
  }
  const existing = await OpenPlayRegistration.findOne({ sessionId: sess._id, userId: user.sub }).lean();
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'You already showed interest' }, status: (existing as any).status }, 409);
  }
  // Interest-based Open Play: everyone who taps is "interested" (registered). No
  // capacity gate and no waitlist — it's a soft signal, not a committed spot.
  const reg = await OpenPlayRegistration.create({ sessionId: sess._id, userId: user.sub, status: 'registered' });
  const taken = await sessionConfirmedCount(sess._id);
  await OpenPlaySession.updateOne({ _id: sess._id }, { joinedCount: taken });
  return c.json({ data: { id: reg._id, status: reg.status } }, 201);
}

// POST /api/v1/open-play/:id/leave — player leaves a session.
export async function leaveOpenPlay(c: any) {
  const user = c.get('user');
  const sessionId = c.req.param('id');
  const reg = await OpenPlayRegistration.findOneAndDelete({ sessionId, userId: user.sub });
  if (!reg) return c.json({ error: { code: 'NOT_FOUND', message: 'You are not interested in this session' } }, 404);
  // Interest-based: no waitlist to promote when someone drops out.
  const taken = await sessionConfirmedCount(sessionId);
  await OpenPlaySession.updateOne({ _id: sessionId }, { joinedCount: taken });
  return c.json({ data: { ok: true } });
}

// PATCH /api/v1/open-play/:id/registrations/:regId — organizer marks attendance
// or approves/declines a waitlisted player.
export async function manageOpenPlayRegistration(c: any) {
  const user = c.get('user');
  const sess = await OpenPlaySession.findById(c.req.param('id'));
  if (!sess) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);
  if (!hasPermission(user, EVENTS_PERM) || sess.organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this session' } }, 403);
  }
  const reg = await OpenPlayRegistration.findOne({ _id: c.req.param('regId'), sessionId: sess._id });
  if (!reg) return c.json({ error: { code: 'NOT_FOUND', message: 'Registration not found' } }, 404);
  const body = manageRegInput.parse(await c.req.json());

  if (body.action === 'decline') {
    await reg.deleteOne();
    const taken = await sessionConfirmedCount(sess._id);
    await OpenPlaySession.updateOne({ _id: sess._id }, { joinedCount: taken });
    return c.json({ data: { id: reg._id, removed: true } });
  }
  if (body.action === 'approve') {
    const taken = await sessionConfirmedCount(sess._id);
    if ((sess.capacity ?? 0) > 0 && taken >= (sess.capacity ?? 0)) {
      return c.json({ error: { code: 'CONFLICT', message: 'Session is full' } }, 409);
    }
    reg.status = 'registered';
  }
  if (typeof body.attended === 'boolean') reg.attended = body.attended;
  if (typeof body.paid === 'boolean') reg.paid = body.paid;
  if (typeof body.paymentNote === 'string') reg.paymentNote = body.paymentNote;
  await reg.save();
  const taken = await sessionConfirmedCount(sess._id);
  await OpenPlaySession.updateOne({ _id: sess._id }, { joinedCount: taken });
  return c.json({ data: { id: reg._id, status: reg.status, attended: reg.attended, paid: reg.paid, paymentNote: reg.paymentNote } });
}

// GET /api/v1/open-play/:id/registrations — session roster (organizer/admin).
export async function getOpenPlayRegistrations(c: any) {
  const user = c.get('user');
  const sess = await OpenPlaySession.findById(c.req.param('id')).select('organizerUserId');
  if (!sess) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);
  const isOwner = sess.organizerUserId?.toString() === user?.sub;
  if (!isOwner && !hasPermission(user, 'admin.venues.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the organizer can view participants' } }, 403);
  }
  const regs = await OpenPlayRegistration.find({ sessionId: sess._id }).sort({ createdAt: 1 }).lean();
  return c.json({ data: await hydratePlayers(regs) });
}
