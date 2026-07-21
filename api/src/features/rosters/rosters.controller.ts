import { z } from 'zod';
import { OrganizerRoster } from './rosters.model.js';
import { User } from '../auth/auth.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// Rosters are an organizer-events capability (same crowd they run sessions for).
const ROSTER_PERM = 'organizer.events.manage' as const;

function forbidden(c: any) {
  return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer events permission required' } }, 403);
}

function rosterView(r: any) {
  if (!r) return null;
  const { _id, members, ...rest } = r;
  const list = members || [];
  return {
    id: _id,
    ...rest,
    memberCount: list.length,
    members: list.map((m: any) => ({ id: m._id, userId: m.userId || null, name: m.name, email: m.email || '' })),
  };
}

const rosterInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

const memberInput = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().max(255).optional(),
});

// Load a roster owned by the current user, or return the error response.
async function loadOwned(c: any): Promise<{ ok: true; roster: any } | { ok: false; res: any }> {
  const user = c.get('user');
  if (!hasPermission(user, ROSTER_PERM)) return { ok: false, res: forbidden(c) };
  const r = await OrganizerRoster.findById(c.req.param('id'));
  if (!r) return { ok: false, res: c.json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } }, 404) };
  if (r.organizerUserId?.toString() !== user.sub) {
    return { ok: false, res: c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this roster' } }, 403) };
  }
  return { ok: true, roster: r };
}

// GET /api/v1/rosters — the organizer's saved lists.
export async function listRosters(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ROSTER_PERM)) return forbidden(c);
  const rows = await OrganizerRoster.find({ organizerUserId: user.sub }).sort({ createdAt: -1 }).lean();
  return c.json({ data: rows.map(rosterView) });
}

// POST /api/v1/rosters — create a new list.
export async function createRoster(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ROSTER_PERM)) return forbidden(c);
  const body = rosterInput.parse(await c.req.json());
  const r = await OrganizerRoster.create({ ...body, organizerUserId: user.sub, members: [] });
  return c.json({ data: rosterView(r.toObject()) }, 201);
}

// PATCH /api/v1/rosters/:id — rename / edit description.
export async function updateRoster(c: any) {
  const loaded = await loadOwned(c);
  if (!loaded.ok) return loaded.res;
  const body = rosterInput.partial().parse(await c.req.json());
  Object.assign(loaded.roster, body);
  await loaded.roster.save();
  return c.json({ data: rosterView(loaded.roster.toObject()) });
}

// DELETE /api/v1/rosters/:id
export async function deleteRoster(c: any) {
  const loaded = await loadOwned(c);
  if (!loaded.ok) return loaded.res;
  await loaded.roster.deleteOne();
  return c.json({ data: { ok: true } });
}

// POST /api/v1/rosters/:id/members — add a player (by userId, or free-text).
export async function addRosterMember(c: any) {
  const loaded = await loadOwned(c);
  if (!loaded.ok) return loaded.res;
  const body = memberInput.parse(await c.req.json());
  let { name, email } = body;
  const { userId } = body;
  if (userId) {
    const u = await User.findById(userId).select('displayName email').lean();
    if (!u) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    name = name || (u as any).displayName;
    email = email || (u as any).email;
  }
  if (!name) return c.json({ error: { code: 'VALIDATION', message: 'name or userId is required' } }, 400);
  // Atomic add (A7): $push instead of read-modify-save so a concurrent add/remove
  // isn't clobbered. When a userId is given, the `$ne` guard makes the insert
  // conditional on them not already being a member → 409 on the duplicate race.
  const rosterId = loaded.roster._id;
  if (userId) {
    const updated = await OrganizerRoster.findOneAndUpdate(
      { _id: rosterId, 'members.userId': { $ne: userId } },
      { $push: { members: { userId, name, email } } },
      { new: true },
    );
    if (!updated) return c.json({ error: { code: 'CONFLICT', message: 'Already in this roster' } }, 409);
    return c.json({ data: rosterView(updated.toObject()) }, 201);
  }
  const updated = await OrganizerRoster.findByIdAndUpdate(
    rosterId,
    { $push: { members: { name, email } } },
    { new: true },
  );
  return c.json({ data: rosterView(updated!.toObject()) }, 201);
}

// DELETE /api/v1/rosters/:id/members/:memberId
export async function removeRosterMember(c: any) {
  const loaded = await loadOwned(c);
  if (!loaded.ok) return loaded.res;
  const memberId = c.req.param('memberId');
  // Atomic remove (A7): $pull the one member so a concurrent add isn't lost.
  const updated = await OrganizerRoster.findByIdAndUpdate(
    loaded.roster._id,
    { $pull: { members: { _id: memberId } } },
    { new: true },
  );
  return c.json({ data: rosterView((updated ?? loaded.roster).toObject()) });
}
