// Guards for the launch-critical lobby fixes (workstream A):
//  A1 — the READ handlers (getGame, listGames) must pass the viewer to serialize,
//       or a pending player's `viewerPendingJoin` reads false on every refetch and
//       the app lets them re-tap "Request to join" into a 409. This is the exact
//       regression these tests exist to catch — the fix is a call-site one, so a
//       serialize unit test alone would not have caught it.
//  A2 — cancelJoinRequest lets a pending player withdraw their own request, drops
//       them from pendingJoinUserIds only (no seat, no leaveLog), and 404s when
//       there's nothing to cancel.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Game } from './games.model.js';
import { getGame, listGames, cancelJoinRequest } from './games.controller.js';

let mongod: MongoMemoryServer;

const hostId = new Types.ObjectId();
const marcoId = new Types.ObjectId();

/** Minimal fake Hono context. Handlers return whatever c.json() returns, so we
 *  capture the status + payload for assertions. */
function ctx(opts: { param?: Record<string, string>; user?: { sub: string }; query?: Record<string, string> }) {
  return {
    req: {
      param: (k: string) => opts.param?.[k],
      query: () => opts.query ?? {},
      json: async () => ({}),
    },
    get: (k: string) => (k === 'user' ? opts.user : undefined),
    json: (payload: any, status?: number) => ({ status: status ?? 200, payload }),
  } as any;
}

async function seedGame(over: Record<string, any> = {}) {
  const _id = new Types.ObjectId();
  await mongoose.connection.collection('games').insertOne({
    _id, creatorId: hostId, gameType: 'open', title: 'Approval OP',
    genderPolicy: 'all', capacity: 4, requiresApproval: true, status: 'published',
    visibility: 'public', date: '2999-01-01', // always "upcoming" so listGames keeps it
    participantIds: [hostId], interestedUserIds: [], invitedUserIds: [],
    pendingLeaveUserIds: [], pendingJoinUserIds: [marcoId], leaveLog: [],
    ...over,
  });
  return String(_id);
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Real user docs so POPULATE resolves the pending ref to an object with an id.
  await mongoose.connection.collection('users').insertMany([
    { _id: hostId, displayName: 'Rina' },
    { _id: marcoId, displayName: 'Marco' },
  ]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Game.deleteMany({});
});

describe('A1 — reads pass the viewer to serialize', () => {
  it('getGame: a pending viewer sees viewerPendingJoin=true', async () => {
    const id = await seedGame();
    const res = await getGame(ctx({ param: { id }, user: { sub: String(marcoId) } }));
    expect(res.status).toBe(200);
    expect(res.payload.data.viewerPendingJoin).toBe(true);
    expect(res.payload.data.pendingJoinCount).toBe(1);
  });

  it('getGame: a non-pending viewer (the host) sees viewerPendingJoin=false', async () => {
    const id = await seedGame();
    const res = await getGame(ctx({ param: { id }, user: { sub: String(hostId) } }));
    expect(res.payload.data.viewerPendingJoin).toBe(false);
  });

  it('listGames: the pending viewer sees viewerPendingJoin=true on the row', async () => {
    const id = await seedGame();
    const res = await listGames(ctx({ user: { sub: String(marcoId) } }));
    const row = res.payload.data.find((g: any) => g.id === id);
    expect(row).toBeTruthy();
    expect(row.viewerPendingJoin).toBe(true);
  });
});

describe('A2 — cancelJoinRequest', () => {
  it('withdraws the caller from pendingJoinUserIds (and holds no seat)', async () => {
    const id = await seedGame();
    const res = await cancelJoinRequest(ctx({ param: { id }, user: { sub: String(marcoId) } }));
    expect(res.status).toBe(200);
    expect(res.payload.data.viewerPendingJoin).toBe(false);
    expect(res.payload.data.pendingJoinCount).toBe(0);
    // Never took a seat, so the roster is unchanged (host only).
    expect(res.payload.data.participantCount).toBe(1);
    const doc: any = await Game.findById(id).lean();
    expect(doc.pendingJoinUserIds.map(String)).not.toContain(String(marcoId));
    expect(doc.leaveLog ?? []).toHaveLength(0); // no cooldown penalty for cancelling a request
  });

  it('404s when the caller has no pending request', async () => {
    const id = await seedGame({ pendingJoinUserIds: [] });
    const res = await cancelJoinRequest(ctx({ param: { id }, user: { sub: String(marcoId) } }));
    expect(res.status).toBe(404);
  });

  it('404s for an unknown game', async () => {
    const res = await cancelJoinRequest(ctx({ param: { id: String(new Types.ObjectId()) }, user: { sub: String(marcoId) } }));
    expect(res.status).toBe(404);
  });
});
