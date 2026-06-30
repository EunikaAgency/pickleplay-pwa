import mongoose from 'mongoose';
import { z } from 'zod';
import { Tournament, TournamentRegistration } from '../content/content.model.js';
import { User } from '../auth/auth.model.js';
import { TournamentEntrant, Bracket, BracketMatch } from './brackets.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import { notifyUsers } from '../../shared/lib/notify.js';
import {
  generateBracket,
  applyMatchResult,
  applyResultToBracket,
  computeStandings,
  resolveByesList,
  BracketError,
  type BracketFormat,
  type EngineMatch,
  type CompletedMatch,
  type Slot,
} from './bracketEngine.js';

const BRACKETS_PERM = 'organizer.brackets.manage' as const;
const objectId = /^[0-9a-fA-F]{24}$/;

// The web form stores `format` as free text; map it onto the engine enum.
const FORMAT_MAP: Record<string, BracketFormat> = {
  'single elimination': 'single_elimination',
  single_elimination: 'single_elimination',
  'double elimination': 'double_elimination',
  double_elimination: 'double_elimination',
  'round robin': 'round_robin',
  round_robin: 'round_robin',
  'pool play + knockout': 'pool_play',
  'pool play': 'pool_play',
  pool_play: 'pool_play',
};

function resolveFormat(input?: string | null): BracketFormat | null {
  if (!input) return null;
  return FORMAT_MAP[input.toLowerCase().trim()] ?? null;
}

const oid = (id: string | null | undefined): mongoose.Types.ObjectId | null =>
  id ? new mongoose.Types.ObjectId(id) : null;

function forbidden(c: any, message: string) {
  return c.json({ error: { code: 'FORBIDDEN', message } }, 403);
}
function notFound(c: any, message: string) {
  return c.json({ error: { code: 'NOT_FOUND', message } }, 404);
}
function conflict(c: any, message: string) {
  return c.json({ error: { code: 'CONFLICT', message } }, 409);
}

// Load a tournament owned by the current user (gated on brackets.manage).
async function loadOwnedTournament(
  c: any,
): Promise<{ ok: true; tournament: any } | { ok: false; res: any }> {
  const user = c.get('user');
  if (!hasPermission(user, BRACKETS_PERM)) {
    return { ok: false, res: forbidden(c, 'Bracket management permission required') };
  }
  const id = c.req.param('id');
  if (!objectId.test(id)) return { ok: false, res: notFound(c, 'Tournament not found') };
  const t = await Tournament.findById(id);
  if (!t) return { ok: false, res: notFound(c, 'Tournament not found') };
  if (t.organizerUserId?.toString() !== user.sub) {
    return { ok: false, res: forbidden(c, 'You do not own this tournament') };
  }
  return { ok: true, tournament: t };
}

// ── serialization ────────────────────────────────────────────────────────────

function entrantView(e: any) {
  return {
    id: String(e._id),
    seed: e.seed ?? null,
    displayName: e.displayName,
    status: e.status,
    players: (e.players ?? []).map((p: any) => ({
      userId: p.userId ? String(p.userId) : null,
      registrationId: p.registrationId ? String(p.registrationId) : null,
      name: p.name ?? '',
    })),
  };
}

function matchView(m: any) {
  return {
    id: String(m._id),
    key: m.key,
    bracket: m.bracket,
    round: m.round,
    slotInRound: m.slotInRound,
    poolKey: m.poolKey ?? null,
    entrantA: m.entrantA ? String(m.entrantA) : null,
    entrantB: m.entrantB ? String(m.entrantB) : null,
    isByeA: m.isByeA,
    isByeB: m.isByeB,
    games: (m.games ?? []).map((g: any) => ({ a: g.a, b: g.b })),
    winner: m.winner ?? null,
    status: m.status,
    isGrandFinalReset: m.isGrandFinalReset,
    seedSourceA: m.seedSourceA?.poolKey ? { poolKey: m.seedSourceA.poolKey, rank: m.seedSourceA.rank } : null,
    seedSourceB: m.seedSourceB?.poolKey ? { poolKey: m.seedSourceB.poolKey, rank: m.seedSourceB.rank } : null,
  };
}

function docToCompleted(d: any): CompletedMatch {
  return {
    entrantA: d.entrantA ? String(d.entrantA) : null,
    entrantB: d.entrantB ? String(d.entrantB) : null,
    winner: d.winner ?? null,
    games: (d.games ?? []).map((g: any) => ({ a: g.a, b: g.b })),
    poolKey: d.poolKey ?? null,
  };
}

// Assemble the full bracket payload the web UI renders from.
async function buildBracketResponse(tournamentId: any) {
  const bracket = await Bracket.findOne({ tournamentId }).lean();
  if (!bracket) return null;
  const [entrants, matches] = await Promise.all([
    TournamentEntrant.find({ tournamentId }).sort({ seed: 1, createdAt: 1 }).lean(),
    BracketMatch.find({ tournamentId }).sort({ bracket: 1, round: 1, slotInRound: 1 }).lean(),
  ]);

  const standings = computeBracketStandings(bracket, entrants, matches);

  return {
    bracket: {
      id: String((bracket as any)._id),
      tournamentId: String((bracket as any).tournamentId),
      format: (bracket as any).format,
      matchFormat: (bracket as any).matchFormat,
      pointsPerGame: (bracket as any).pointsPerGame,
      entrantCount: (bracket as any).entrantCount,
      bracketSize: (bracket as any).bracketSize,
      status: (bracket as any).status,
      locked: (bracket as any).locked,
      playoffSize: (bracket as any).playoffSize ?? null,
      playoffSeeded: (bracket as any).playoffSeeded ?? false,
      championEntrantId: (bracket as any).championEntrantId ? String((bracket as any).championEntrantId) : null,
      pools: ((bracket as any).pools ?? []).map((p: any) => ({
        key: p.key,
        label: p.label,
        advancers: p.advancers,
        entrantIds: (p.entrantIds ?? []).map((id: any) => String(id)),
      })),
      generatedAt: (bracket as any).generatedAt ?? null,
    },
    entrants: entrants.map(entrantView),
    matches: matches.map(matchView),
    standings,
  };
}

function computeBracketStandings(bracket: any, entrants: any[], matches: any[]) {
  if (bracket.format === 'round_robin') {
    const ids = entrants.map((e) => String(e._id));
    const completed = matches.filter((m) => m.bracket === 'main' && m.winner).map(docToCompleted);
    return [{ poolKey: null, label: 'Standings', rows: computeStandings(ids, completed) }];
  }
  if (bracket.format === 'pool_play') {
    return (bracket.pools ?? []).map((p: any) => {
      const ids = (p.entrantIds ?? []).map((id: any) => String(id));
      const completed = matches
        .filter((m) => m.bracket === 'main' && m.poolKey === p.key && m.winner)
        .map(docToCompleted);
      return { poolKey: p.key, label: p.label, rows: computeStandings(ids, completed, p.key) };
    });
  }
  return [];
}

// ── entrants ─────────────────────────────────────────────────────────────────

export async function listEntrants(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.test(id)) return notFound(c, 'Tournament not found');
  const t = await Tournament.findById(id).select('organizerUserId');
  if (!t) return notFound(c, 'Tournament not found');
  const isOwner = t.organizerUserId?.toString() === user?.sub;
  if (!isOwner && !hasPermission(user, 'admin.venues.manage')) {
    return forbidden(c, 'Only the organizer can view entrants');
  }
  const entrants = await TournamentEntrant.find({ tournamentId: id }).sort({ seed: 1, createdAt: 1 }).lean();
  return c.json({ data: entrants.map(entrantView) });
}

// Reject entrant edits once the bracket is locked (a score has been entered).
async function ensureUnlocked(c: any, tournamentId: any): Promise<any | null> {
  const bracket = await Bracket.findOne({ tournamentId }).select('locked');
  if (bracket?.locked) return conflict(c, 'Clear match results before editing entrants.');
  return null;
}

const buildSchema = z.object({
  mode: z.enum(['auto', 'pairs']).default('auto'),
  pairs: z.array(z.tuple([z.string().regex(objectId), z.string().regex(objectId)])).optional(),
});

// POST /tournaments/:id/entrants/build — (re)build entrants from registrations.
export async function buildEntrants(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const locked = await ensureUnlocked(c, tournament._id);
  if (locked) return locked;
  if (await Bracket.findOne({ tournamentId: tournament._id }).select('_id')) {
    return conflict(c, 'Clear the bracket before rebuilding entrants.');
  }
  const body = buildSchema.parse(await c.req.json().catch(() => ({})));

  const regs = await TournamentRegistration.find({
    tournamentId: tournament._id,
    status: { $in: ['registered', 'waitlisted'] },
  })
    .sort({ createdAt: 1 })
    .lean();
  const userIds = [...new Set(regs.map((r: any) => r.userId?.toString()).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('displayName').lean()
    : [];
  const nameById = new Map((users as any[]).map((u) => [String(u._id), u.displayName || 'Player']));
  const regById = new Map(regs.map((r: any) => [String(r._id), r]));

  await TournamentEntrant.deleteMany({ tournamentId: tournament._id });

  let entrantDocs: any[] = [];
  if (body.mode === 'pairs') {
    if (!body.pairs?.length) return conflict(c, 'Provide at least one pair.');
    entrantDocs = body.pairs.map((pair, i) => {
      const players = pair.map((regId) => {
        const r: any = regById.get(regId);
        return { userId: r?.userId, registrationId: r?._id, name: r ? nameById.get(String(r.userId)) : 'Player' };
      });
      return {
        tournamentId: tournament._id,
        seed: i + 1,
        displayName: players.map((p) => p.name).join(' / '),
        players,
      };
    });
  } else {
    entrantDocs = regs.map((r: any, i) => ({
      tournamentId: tournament._id,
      seed: i + 1,
      displayName: nameById.get(String(r.userId)) || 'Player',
      players: [{ userId: r.userId, registrationId: r._id, name: nameById.get(String(r.userId)) || 'Player' }],
    }));
  }

  if (entrantDocs.length) await TournamentEntrant.insertMany(entrantDocs);
  const entrants = await TournamentEntrant.find({ tournamentId: tournament._id }).sort({ seed: 1 }).lean();
  return c.json({ data: entrants.map(entrantView) }, 201);
}

const addEntrantSchema = z.object({
  displayName: z.string().min(1).max(200),
  players: z
    .array(
      z.object({
        userId: z.string().regex(objectId).optional(),
        registrationId: z.string().regex(objectId).optional(),
        name: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(2),
});

// POST /tournaments/:id/entrants — add one entrant manually.
export async function addEntrant(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const locked = await ensureUnlocked(c, tournament._id);
  if (locked) return locked;
  const body = addEntrantSchema.parse(await c.req.json());
  const count = await TournamentEntrant.countDocuments({ tournamentId: tournament._id });
  const created = await TournamentEntrant.create({
    tournamentId: tournament._id,
    seed: count + 1,
    displayName: body.displayName,
    players: body.players.map((p) => ({ userId: oid(p.userId), registrationId: oid(p.registrationId), name: p.name })),
  });
  return c.json({ data: entrantView(created.toObject()) }, 201);
}

const updateEntrantSchema = z.object({
  seed: z.coerce.number().int().min(1).optional(),
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'withdrawn']).optional(),
});

// PATCH /tournaments/:id/entrants/:entrantId
export async function updateEntrant(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const locked = await ensureUnlocked(c, tournament._id);
  if (locked) return locked;
  const entrantId = c.req.param('entrantId');
  if (!objectId.test(entrantId)) return notFound(c, 'Entrant not found');
  const body = updateEntrantSchema.parse(await c.req.json());
  const entrant = await TournamentEntrant.findOne({ _id: entrantId, tournamentId: tournament._id });
  if (!entrant) return notFound(c, 'Entrant not found');
  if (body.seed !== undefined) {
    entrant.seed = body.seed;
    entrant.seededManually = true;
  }
  if (body.displayName !== undefined) entrant.displayName = body.displayName;
  if (body.status !== undefined) entrant.status = body.status;
  await entrant.save();
  return c.json({ data: entrantView(entrant.toObject()) });
}

// DELETE /tournaments/:id/entrants/:entrantId
export async function removeEntrant(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const locked = await ensureUnlocked(c, tournament._id);
  if (locked) return locked;
  const entrantId = c.req.param('entrantId');
  if (!objectId.test(entrantId)) return notFound(c, 'Entrant not found');
  const removed = await TournamentEntrant.findOneAndDelete({ _id: entrantId, tournamentId: tournament._id });
  if (!removed) return notFound(c, 'Entrant not found');
  return c.json({ data: { ok: true } });
}

const seedSchema = z.object({
  method: z.enum(['auto', 'manual']).default('auto'),
  seeds: z.record(z.string().regex(objectId), z.coerce.number().int().min(1)).optional(),
});

// POST /tournaments/:id/entrants/seed — auto- or manual-seed the field.
export async function seedEntrants(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const locked = await ensureUnlocked(c, tournament._id);
  if (locked) return locked;
  const body = seedSchema.parse(await c.req.json().catch(() => ({})));

  if (body.method === 'manual' && body.seeds) {
    await Promise.all(
      Object.entries(body.seeds).map(([entrantId, seed]) =>
        TournamentEntrant.updateOne(
          { _id: entrantId, tournamentId: tournament._id },
          { seed, seededManually: true },
        ),
      ),
    );
  } else {
    // Auto: number 1..n by current order (seeded first, then registration order).
    const entrants = await TournamentEntrant.find({ tournamentId: tournament._id })
      .sort({ seed: 1, createdAt: 1 })
      .select('_id');
    await Promise.all(entrants.map((e, i) => TournamentEntrant.updateOne({ _id: e._id }, { seed: i + 1 })));
  }
  const entrants = await TournamentEntrant.find({ tournamentId: tournament._id }).sort({ seed: 1 }).lean();
  return c.json({ data: entrants.map(entrantView) });
}

// ── bracket generation ─────────────────────────────────────────────────────

const generateSchema = z.object({
  format: z.string().optional(),
  // How many games decide a match (best-of). Defaults to the tournament's
  // setting, else bo3 — picked in the generator so the organizer can override.
  matchFormat: z.enum(['bo1', 'bo3', 'bo5']).optional(),
  poolCount: z.coerce.number().int().min(2).max(16).optional(),
  advancersPerPool: z.coerce.number().int().min(1).max(8).optional(),
});

// POST /tournaments/:id/bracket — generate the bracket for the chosen format.
export async function generateBracketHandler(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  if (await Bracket.findOne({ tournamentId: tournament._id }).select('_id')) {
    return conflict(c, 'A bracket already exists. Clear it before regenerating.');
  }
  const body = generateSchema.parse(await c.req.json().catch(() => ({})));
  const format = resolveFormat(body.format) ?? resolveFormat(tournament.format);
  if (!format) return c.json({ error: { code: 'BAD_FORMAT', message: 'Choose a bracket format.' } }, 400);

  // Normalize seeds to 1..n by current order so the engine ranking is stable.
  const ordered = await TournamentEntrant.find({ tournamentId: tournament._id, status: 'active' })
    .sort({ seed: 1, createdAt: 1 })
    .lean();
  if (ordered.length < 2) return conflict(c, 'Add at least 2 active entrants before generating a bracket.');
  await Promise.all(ordered.map((e: any, i) => TournamentEntrant.updateOne({ _id: e._id }, { seed: i + 1 })));
  const engineEntrants = ordered.map((e: any, i) => ({ id: String(e._id), seed: i + 1 }));

  let generated;
  try {
    generated = generateBracket(format, engineEntrants, {
      poolCount: body.poolCount,
      advancersPerPool: body.advancersPerPool,
    });
  } catch (e) {
    if (e instanceof BracketError) return c.json({ error: { code: e.code, message: e.message } }, 400);
    throw e;
  }

  const matchFormat = body.matchFormat ?? tournament.matchFormat ?? 'bo3';
  const pointsPerGame = tournament.pointsPerGame ?? 11;
  const bracketDoc = await Bracket.create({
    tournamentId: tournament._id,
    format,
    matchFormat,
    pointsPerGame,
    entrantCount: engineEntrants.length,
    bracketSize: generated.bracketSize,
    status: 'active',
    locked: false,
    pools: (generated.pools ?? []).map((p) => ({
      key: p.key,
      label: p.label,
      advancers: p.advancers,
      entrantIds: p.entrantIds.map((id) => oid(id)),
    })),
    playoffSize: generated.playoffSize,
    playoffSeeded: false,
    generatedAt: new Date(),
  });

  const keyToId = new Map<string, mongoose.Types.ObjectId>();
  for (const m of generated.matches) keyToId.set(m.key, new mongoose.Types.ObjectId());
  const docs = generated.matches.map((m) => ({
    _id: keyToId.get(m.key),
    tournamentId: tournament._id,
    bracketId: bracketDoc._id,
    key: m.key,
    bracket: m.bracket,
    round: m.round,
    slotInRound: m.slotInRound,
    poolKey: m.poolKey,
    entrantA: oid(m.entrantA),
    entrantB: oid(m.entrantB),
    isByeA: m.isByeA,
    isByeB: m.isByeB,
    nextMatchId: m.nextMatchKey ? keyToId.get(m.nextMatchKey) : null,
    nextSlot: m.nextSlot,
    nextLoserMatchId: m.nextLoserMatchKey ? keyToId.get(m.nextLoserMatchKey) : null,
    nextLoserSlot: m.nextLoserSlot,
    games: [],
    winner: m.winner,
    status: m.status,
    isGrandFinalReset: m.isGrandFinalReset,
    seedSourceA: m.seedSourceA,
    seedSourceB: m.seedSourceB,
  }));
  await BracketMatch.insertMany(docs);

  if (!['completed', 'cancelled'].includes(tournament.status)) {
    tournament.status = 'ongoing';
    await tournament.save();
  }
  // Tell every entrant's players the bracket is live so they can find their match.
  const entrantUserIds = ordered.flatMap((e: any) => (e.players ?? []).map((p: any) => p.userId).filter(Boolean));
  await notifyUsers(entrantUserIds, {
    type: 'tournament',
    title: 'Bracket is live',
    body: `The bracket for ${tournament.title || 'your tournament'} is set — check your matches.`,
    icon: 'account_tree',
    linkUrl: `/tournaments/${tournament.slug}`,
    tag: `bracket-live-${tournament._id}`,
  });
  return c.json({ data: await buildBracketResponse(tournament._id) }, 201);
}

// GET /tournaments/:id/bracket — full bracket (or null if none yet).
export async function getBracket(c: any) {
  const id = c.req.param('id');
  if (!objectId.test(id)) return notFound(c, 'Tournament not found');
  const t = await Tournament.findById(id).select('organizerUserId visibility').lean();
  if (!t) return notFound(c, 'Tournament not found');
  const user = c.get('user');
  const isOwner = user && (t as any).organizerUserId?.toString() === user.sub;
  if (!isOwner && (t as any).visibility && (t as any).visibility !== 'public') {
    return notFound(c, 'Tournament not found');
  }
  return c.json({ data: await buildBracketResponse(id) });
}

// DELETE /tournaments/:id/bracket — clear it so it can be regenerated.
export async function deleteBracket(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const bracket = await Bracket.findOne({ tournamentId: tournament._id });
  if (!bracket) return notFound(c, 'No bracket to clear');
  if (bracket.locked) return conflict(c, 'Clear match results before regenerating the bracket.');
  await Promise.all([
    BracketMatch.deleteMany({ tournamentId: tournament._id }),
    Bracket.deleteOne({ _id: bracket._id }),
  ]);
  if (tournament.status === 'ongoing') {
    tournament.status = 'registration_open';
    await tournament.save();
  }
  return c.json({ data: { ok: true } });
}

const swapSchema = z.object({
  a: z.object({ matchId: z.string().regex(objectId), slot: z.enum(['A', 'B']) }),
  b: z.object({ matchId: z.string().regex(objectId), slot: z.enum(['A', 'B']) }),
});

// POST /tournaments/:id/bracket/swap — swap two entrants in the first round to
// re-seed the draw before they play. Allowed only for first-round matches that
// haven't been decided: a completed/bye match means a player already advanced,
// so they can no longer be moved.
export async function swapEntrants(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const bracket = await Bracket.findOne({ tournamentId: tournament._id });
  if (!bracket) return notFound(c, 'No bracket for this tournament');
  const body = swapSchema.parse(await c.req.json());

  const ids = [...new Set([body.a.matchId, body.b.matchId])];
  const docs = await BracketMatch.find({ _id: { $in: ids }, tournamentId: tournament._id });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const mA = byId.get(body.a.matchId);
  const mB = byId.get(body.b.matchId);
  if (!mA || !mB) return notFound(c, 'Match not found');
  if (mA.bracket !== mB.bracket) return conflict(c, 'Players can only be swapped within the same bracket.');

  // First round of this section = the smallest round number present.
  const firstDoc = await BracketMatch.find({ tournamentId: tournament._id, bracket: mA.bracket })
    .sort({ round: 1 })
    .limit(1)
    .select('round');
  const firstRound = firstDoc[0]?.round;
  const slotEntrant = (m: any, slot: string) => (slot === 'A' ? m.entrantA : m.entrantB);
  const swappable = (m: any, slot: string) =>
    m.round === firstRound && m.status !== 'completed' && m.status !== 'bye' && !!slotEntrant(m, slot);
  if (!swappable(mA, body.a.slot) || !swappable(mB, body.b.slot)) {
    return conflict(c, 'Only first-round players who have not advanced can be swapped.');
  }

  const ea = slotEntrant(mA, body.a.slot);
  const eb = slotEntrant(mB, body.b.slot);
  const setSlot = (m: any, slot: string, v: any) => {
    if (slot === 'A') m.entrantA = v;
    else m.entrantB = v;
  };
  setSlot(mA, body.a.slot, eb);
  setSlot(mB, body.b.slot, ea);
  await mA.save();
  if (mB !== mA) await mB.save();
  return c.json({ data: await buildBracketResponse(tournament._id) });
}

// ── match results ────────────────────────────────────────────────────────────

function buildEngineView(docs: any[]) {
  const idToKey = new Map(docs.map((d) => [String(d._id), d.key]));
  const em: EngineMatch[] = docs.map((d) => ({
    key: d.key,
    bracket: d.bracket,
    round: d.round,
    slotInRound: d.slotInRound,
    poolKey: d.poolKey ?? null,
    entrantA: d.entrantA ? String(d.entrantA) : null,
    entrantB: d.entrantB ? String(d.entrantB) : null,
    isByeA: d.isByeA,
    isByeB: d.isByeB,
    nextMatchKey: d.nextMatchId ? idToKey.get(String(d.nextMatchId)) ?? null : null,
    nextSlot: d.nextSlot ?? null,
    nextLoserMatchKey: d.nextLoserMatchId ? idToKey.get(String(d.nextLoserMatchId)) ?? null : null,
    nextLoserSlot: d.nextLoserSlot ?? null,
    isGrandFinalReset: d.isGrandFinalReset,
    status: d.status,
    winner: d.winner ?? null,
    seedSourceA: d.seedSourceA?.poolKey ? { poolKey: d.seedSourceA.poolKey, rank: d.seedSourceA.rank } : undefined,
    seedSourceB: d.seedSourceB?.poolKey ? { poolKey: d.seedSourceB.poolKey, rank: d.seedSourceB.rank } : undefined,
  }));
  const docByKey = new Map(docs.map((d) => [d.key, d]));
  return { em, docByKey };
}

// Copy the engine view's mutated slots/status back onto the Mongoose docs.
function writeBack(em: EngineMatch[], docByKey: Map<string, any>) {
  for (const m of em) {
    const d = docByKey.get(m.key);
    if (!d) continue;
    d.entrantA = oid(m.entrantA);
    d.entrantB = oid(m.entrantB);
    d.isByeA = m.isByeA;
    d.isByeB = m.isByeB;
    d.status = m.status;
    d.winner = m.winner;
  }
}

const resultSchema = z.object({
  games: z.array(z.object({ a: z.coerce.number().int().min(0), b: z.coerce.number().int().min(0) })).optional(),
  walkover: z.enum(['A', 'B']).optional(),
});

// POST /tournaments/:id/matches/:matchId/result — score a match + advance.
export async function submitMatchResult(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const matchId = c.req.param('matchId');
  if (!objectId.test(matchId)) return notFound(c, 'Match not found');

  const bracket = await Bracket.findOne({ tournamentId: tournament._id });
  if (!bracket) return notFound(c, 'No bracket for this tournament');
  const body = resultSchema.parse(await c.req.json());

  const docs = await BracketMatch.find({ tournamentId: tournament._id }).sort({ bracket: 1, round: 1, slotInRound: 1 });
  const target = docs.find((d) => String(d._id) === matchId);
  if (!target) return notFound(c, 'Match not found');
  if (target.status !== 'ready') return conflict(c, 'This match is not ready to be scored.');

  let outcome;
  try {
    outcome = applyMatchResult(
      { games: body.games, walkover: body.walkover as Slot | undefined },
      { matchFormat: bracket.matchFormat as any, pointsPerGame: bracket.pointsPerGame as number },
    );
  } catch (e) {
    if (e instanceof BracketError) return c.json({ error: { code: e.code, message: e.message } }, 400);
    throw e;
  }

  (target as any).games = body.walkover ? [] : (body.games ?? []);
  const { em, docByKey } = buildEngineView(docs);
  const { championEntrantId } = applyResultToBracket(em, target.key, outcome.winner, bracket.format as BracketFormat);
  writeBack(em, docByKey);
  bracket.locked = true;

  // Pool play: once every pool match is settled, seed the playoff from standings.
  if (bracket.format === 'pool_play' && !bracket.playoffSeeded) {
    const mainsDone = docs.filter((d) => d.bracket === 'main').every((d) => d.status === 'completed' || d.status === 'bye');
    if (mainsDone) {
      seedPlayoff(em, docs, bracket);
      writeBack(em, docByKey);
      bracket.playoffSeeded = true;
    }
  }

  // Champion: elimination/playoff via the engine; round robin via standings.
  let champ: string | null = championEntrantId;
  if (!champ && bracket.format === 'round_robin') {
    const allDone = docs.every((d) => d.status === 'completed' || d.status === 'bye');
    if (allDone) {
      const rows = computeStandings(
        (await TournamentEntrant.find({ tournamentId: tournament._id }).select('_id').lean()).map((e: any) => String(e._id)),
        docs.map(docToCompleted),
      );
      champ = rows[0]?.entrantId ?? null;
    }
  }
  if (champ) {
    bracket.championEntrantId = oid(champ);
    bracket.status = 'completed';
  }

  await Promise.all(docs.map((d) => d.save()));
  await bracket.save();
  if (bracket.status === 'completed' && tournament.status !== 'completed') {
    tournament.status = 'completed';
    await tournament.save();
  }

  // ── Notify the players of this match's outcome (best-effort) ──
  const sideIds = [target.entrantA, target.entrantB].filter(Boolean);
  if (sideIds.length) {
    const ents = await TournamentEntrant.find({ _id: { $in: sideIds } }).select('players').lean();
    const winnerEntrantId = outcome.winner === 'A' ? String(target.entrantA) : String(target.entrantB);
    const isFinal = bracket.status === 'completed';
    await Promise.all(ents.map((e: any) => {
      const uids = (e.players ?? []).map((p: any) => p.userId).filter(Boolean);
      const won = String(e._id) === winnerEntrantId;
      // The final's winner gets the richer champion notification below, so skip
      // the generic "you advanced" for them to avoid a duplicate.
      if (won && isFinal) return Promise.resolve();
      return notifyUsers(uids, {
        type: 'tournament',
        title: won ? 'You won your match!' : 'Match result recorded',
        body: won
          ? `You advanced in ${tournament.title || 'the tournament'}.`
          : `Your match in ${tournament.title || 'the tournament'} has been scored.`,
        icon: won ? 'sports_score' : 'scoreboard',
        linkUrl: `/tournaments/${tournament.slug}`,
        tag: `match-${matchId}`,
      });
    }));
  }
  // Crown the champion when the bracket completes.
  if (bracket.status === 'completed' && champ) {
    const champEnt = await TournamentEntrant.findById(champ).select('players').lean();
    const champUids = ((champEnt as any)?.players ?? []).map((p: any) => p.userId).filter(Boolean);
    await notifyUsers(champUids, {
      type: 'tournament',
      title: '🏆 Champions!',
      body: `You won ${tournament.title || 'the tournament'}. Congratulations!`,
      icon: 'emoji_events',
      linkUrl: `/tournaments/${tournament.slug}`,
      tag: `champion-${tournament._id}`,
    });
  }
  return c.json({ data: await buildBracketResponse(tournament._id) });
}

// Fill pool-play playoff round-1 slots from pool standings, then settle byes.
function seedPlayoff(em: EngineMatch[], docs: any[], bracket: any) {
  const poolRanks = new Map<string, string[]>();
  for (const pool of bracket.pools ?? []) {
    const ids = (pool.entrantIds ?? []).map((id: any) => String(id));
    const completed = docs
      .filter((d) => d.bracket === 'main' && d.poolKey === pool.key && d.winner)
      .map(docToCompleted);
    poolRanks.set(pool.key, computeStandings(ids, completed, pool.key).map((r) => r.entrantId));
  }
  for (const m of em) {
    if (m.bracket !== 'playoff' || m.round !== 1) continue;
    if (m.seedSourceA) m.entrantA = poolRanks.get(m.seedSourceA.poolKey)?.[m.seedSourceA.rank - 1] ?? null;
    if (m.seedSourceB) m.entrantB = poolRanks.get(m.seedSourceB.poolKey)?.[m.seedSourceB.rank - 1] ?? null;
    m.status = m.entrantA !== null && m.entrantB !== null ? 'ready' : m.status;
  }
  resolveByesList(em);
}

// DELETE /tournaments/:id/matches/:matchId/result — conservative single undo.
export async function clearMatchResult(c: any) {
  const loaded = await loadOwnedTournament(c);
  if (!loaded.ok) return loaded.res;
  const { tournament } = loaded;
  const matchId = c.req.param('matchId');
  if (!objectId.test(matchId)) return notFound(c, 'Match not found');
  const bracket = await Bracket.findOne({ tournamentId: tournament._id });
  if (!bracket) return notFound(c, 'No bracket for this tournament');

  const docs = await BracketMatch.find({ tournamentId: tournament._id });
  const target = docs.find((d) => String(d._id) === matchId);
  if (!target) return notFound(c, 'Match not found');
  if (target.status !== 'completed' || target.bracket === 'grand_final') {
    // Grand-final undo is omitted (reset coupling) — regenerate instead.
    return conflict(c, 'This result cannot be cleared. Regenerate the bracket to start over.');
  }

  const downstream = docs.filter(
    (d) =>
      (target.nextMatchId && String(d._id) === String(target.nextMatchId)) ||
      (target.nextLoserMatchId && String(d._id) === String(target.nextLoserMatchId)),
  );
  if (downstream.some((d) => d.status === 'completed')) {
    return conflict(c, 'Clear the later-round result first.');
  }

  // Pull the advanced entrants back out of the downstream slots.
  const winnerId = target.winner === 'A' ? target.entrantA : target.entrantB;
  const loserId = target.winner === 'A' ? target.entrantB : target.entrantA;
  const clearSlot = (d: any, slot: string | null | undefined, id: any) => {
    if (!d || !slot) return;
    if (slot === 'A' && String(d.entrantA) === String(id)) {
      d.entrantA = null;
      d.status = 'pending';
    } else if (slot === 'B' && String(d.entrantB) === String(id)) {
      d.entrantB = null;
      d.status = 'pending';
    }
  };
  const nextDoc = docs.find((d) => String(d._id) === String(target.nextMatchId));
  const loserDoc = docs.find((d) => String(d._id) === String(target.nextLoserMatchId));
  clearSlot(nextDoc, target.nextSlot, winnerId);
  clearSlot(loserDoc, target.nextLoserSlot, loserId);

  target.winner = null;
  (target as any).games = [];
  target.status = 'ready';

  // If no scored matches remain, unlock so the field/bracket can be redone.
  if (!docs.some((d) => d.status === 'completed')) bracket.locked = false;

  if (bracket.status === 'completed') {
    bracket.status = 'active';
    bracket.championEntrantId = null;
    if (tournament.status === 'completed') {
      tournament.status = 'ongoing';
      await tournament.save();
    }
  }
  await Promise.all(docs.map((d) => d.save()));
  await bracket.save();
  return c.json({ data: await buildBracketResponse(tournament._id) });
}

// GET /tournaments/:id/standings — round-robin / pool standings.
export async function getStandings(c: any) {
  const id = c.req.param('id');
  if (!objectId.test(id)) return notFound(c, 'Tournament not found');
  const bracket = await Bracket.findOne({ tournamentId: id }).lean();
  if (!bracket) return c.json({ data: [] });
  const [entrants, matches] = await Promise.all([
    TournamentEntrant.find({ tournamentId: id }).lean(),
    BracketMatch.find({ tournamentId: id }).lean(),
  ]);
  return c.json({ data: computeBracketStandings(bracket, entrants, matches) });
}
