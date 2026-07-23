// Pickleballers API — Admin Data tools: full truncate + full seed.
//
// Two operations the launch needs and nothing else provides: wipe the database
// down to a publishable blank state, and rebuild the whole demo dataset from
// the seed pipeline. Both are triggered from the PWA admin console.
//
// The wipe is deny-by-default in reverse — it clears every collection Mongo
// reports EXCEPT the exceptions in `data-ops.policy.ts` — so a model added
// later is wiped without anyone remembering to register it.

import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { hasPermission } from '../../shared/lib/permissions.js';
import { User } from '../auth/auth.model.js';
import { Media } from '../media/media.model.js';
import { AuditLog } from '../subscriptions/subscriptions.model.js';
import { SEED_PIPELINE, selectSteps } from '../../shared/db/pipeline.js';
import {
  KEEP_WHOLE,
  SCOPE_TO_KEPT_USERS,
  UPLOAD_SWEEP_SKIP_DIRS,
  UPLOAD_TRASH_PREFIX,
  isSystemCollection,
} from './data-ops.policy.js';
import {
  API_ROOT,
  createJob,
  currentJob,
  findJob,
  finishJob,
  isBusy,
  log,
  runScript,
  serializeJob,
  type Job,
} from './data-ops.jobs.js';

const UPLOAD_DIR = path.join(API_ROOT, 'uploads');
const GMAIL_TOKEN_FILE = path.join(API_ROOT, '.gmail-tokens.json');

/** Typed by the admin to arm the wipe. Deliberately not a yes/no. */
const CONFIRM_PHRASE = 'DELETE ALL DATA';

const truncateSchema = z.object({
  confirm: z.string(),
  password: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
  sweepUploads: z.boolean().optional().default(true),
});

const seedSchema = z.object({
  steps: z.array(z.string()).optional(),
  // Must be sent when the selection includes destructive steps and the DB
  // already holds data. The client sets it only after the admin ticks an
  // explicit "this replaces existing data" acknowledgement.
  acceptDestructive: z.boolean().optional().default(false),
});

const forbidden = (c: any, message: string) =>
  c.json({ error: { code: 'FORBIDDEN', message } }, 403);

/**
 * Both operations are irreversible platform surgery, so they sit behind the
 * strictest admin permission rather than plain `admin.access` — the same gate
 * the rest of the console's System section uses. Reusing it means no new
 * permission to sync across the api / app / web copies.
 */
function canRunDataOps(c: any): boolean {
  return hasPermission(c.get('user'), 'admin.settings.manage');
}

/* ─── Preserved accounts ───────────────────────────────────────── */

/**
 * The users a wipe must leave behind: every admin, plus the caller (an admin
 * whose `roleDefault` has drifted must not be able to lock themselves out), plus
 * anyone named in `PRESERVE_USER_EMAILS` for a one-off escape hatch.
 */
async function resolveKeptUsers(callerId?: string) {
  const extraEmails = (process.env.PRESERVE_USER_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  const or: Record<string, unknown>[] = [{ roleDefault: 'admin' }];
  if (extraEmails.length) or.push({ email: { $in: extraEmails } });
  if (callerId && mongoose.isValidObjectId(callerId)) {
    or.push({ _id: new mongoose.Types.ObjectId(callerId) });
  }

  return User.find({ $or: or }).select('_id email displayName roleDefault avatarUrl').lean();
}

/* ─── Status ───────────────────────────────────────────────────── */

export async function getDataStatus(c: any) {
  if (!canRunDataOps(c)) return forbidden(c, 'Admin settings access required');

  const db = mongoose.connection.db;
  if (!db) return c.json({ error: { code: 'DB_UNAVAILABLE', message: 'No database connection' } }, 503);

  const names = (await db.listCollections().toArray())
    .map((i) => i.name)
    .filter((n) => !isSystemCollection(n))
    .sort();

  const collections = await Promise.all(names.map(async (name) => ({
    name,
    count: await db.collection(name).countDocuments(),
    disposition: (KEEP_WHOLE as readonly string[]).includes(name)
      ? 'preserved' as const
      : SCOPE_TO_KEPT_USERS[name]
        ? 'scoped' as const
        : 'wiped' as const,
  })));

  const keptUsers = await resolveKeptUsers();
  const job = currentJob();

  return c.json({
    data: {
      collections,
      totalCollections: collections.length,
      totalDocuments: collections.reduce((sum, x) => sum + x.count, 0),
      preserved: {
        collections: [...KEEP_WHOLE],
        userScopedCollections: Object.keys(SCOPE_TO_KEPT_USERS),
        users: keptUsers.map((u) => ({
          id: String(u._id), email: u.email, displayName: u.displayName,
        })),
        // Surfaced so the console can state it plainly: the mailer's credentials
        // are a file on disk, so no database operation can reach them.
        smtpTokenFile: { path: '.gmail-tokens.json', exists: fs.existsSync(GMAIL_TOKEN_FILE) },
        uploadDirsSkipped: UPLOAD_SWEEP_SKIP_DIRS,
      },
      confirmPhrase: CONFIRM_PHRASE,
      seedSteps: SEED_PIPELINE.map(({ key, label, why, network, destructive }) => ({ key, label, why, network: !!network, destructive: !!destructive })),
      job: job ? serializeJob(job, Math.max(0, job.log.length - 50)) : null,
    },
  });
}

/* ─── Truncate ─────────────────────────────────────────────────── */

interface SweepResult {
  scanned: number;
  swept: number;
  bytes: number;
  trashDir: string | null;
  skippedDirs: string[];
}

/**
 * Clear orphaned root-level files out of `uploads/`. Only the flat files are in
 * scope — `uploads/images/` is the venue photo tree the CSV import lays down,
 * i.e. source data the seeder needs, not user content.
 *
 * Files are MOVED into a timestamped trash dir, never unlinked, so a mistaken
 * sweep is recoverable with `mv`.
 */
async function sweepUploads(dryRun: boolean): Promise<SweepResult> {
  const result: SweepResult = {
    scanned: 0, swept: 0, bytes: 0, trashDir: null, skippedDirs: [...UPLOAD_SWEEP_SKIP_DIRS],
  };
  if (!fs.existsSync(UPLOAD_DIR)) return result;

  // What the surviving documents still point at. After a wipe this is tiny (a
  // preserved admin's avatar), but the same code is correct for a partial one.
  const referenced = new Set<string>();
  const addRef = (url?: string | null) => {
    if (!url) return;
    const base = url.split('?')[0]!.split('/').pop();
    if (base) referenced.add(base);
  };
  (await Media.distinct('url')).forEach(addRef);
  (await User.distinct('avatarUrl')).forEach(addRef);

  const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
  const trashDir = path.join(UPLOAD_DIR, `${UPLOAD_TRASH_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}`);

  for (const entry of entries) {
    if (!entry.isFile()) continue;                            // dirs are out of scope
    if (entry.name.startsWith('.')) continue;                 // dotfiles + trash dirs
    result.scanned++;
    if (referenced.has(entry.name)) continue;

    const from = path.join(UPLOAD_DIR, entry.name);
    result.bytes += fs.statSync(from).size;
    result.swept++;
    if (dryRun) continue;

    if (!result.trashDir) {
      fs.mkdirSync(trashDir, { recursive: true });
      result.trashDir = path.relative(API_ROOT, trashDir);
    }
    fs.renameSync(from, path.join(trashDir, entry.name));
  }

  return result;
}

export async function truncateData(c: any) {
  if (!canRunDataOps(c)) return forbidden(c, 'Admin settings access required');
  if (isBusy()) {
    return c.json({ error: { code: 'JOB_RUNNING', message: 'Another data job is already running' } }, 409);
  }

  const body = truncateSchema.parse(await c.req.json());
  if (body.confirm !== CONFIRM_PHRASE) {
    return c.json({ error: { code: 'CONFIRM_MISMATCH', message: `Type "${CONFIRM_PHRASE}" to confirm` } }, 400);
  }

  // Re-authenticate: a forgotten open session on a shared machine must not be
  // enough to wipe production.
  const caller = c.get('user');
  const callerDoc = await User.findById(caller?.sub).select('email passwordHash');
  if (!callerDoc?.passwordHash || !(await bcrypt.compare(body.password, callerDoc.passwordHash))) {
    return c.json({ error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' } }, 401);
  }

  const db = mongoose.connection.db;
  if (!db) return c.json({ error: { code: 'DB_UNAVAILABLE', message: 'No database connection' } }, 503);

  const keptUsers = await resolveKeptUsers(caller?.sub);
  const keptIds = keptUsers.map((u) => u._id);

  const names = (await db.listCollections().toArray())
    .map((i) => i.name)
    .filter((n) => !isSystemCollection(n))
    .sort();

  const collections: Array<{ name: string; before: number; deleted: number; kept: number; disposition: string }> = [];

  for (const name of names) {
    const col = db.collection(name);
    const before = await col.countDocuments();

    if ((KEEP_WHOLE as readonly string[]).includes(name)) {
      collections.push({ name, before, deleted: 0, kept: before, disposition: 'preserved' });
      continue;
    }

    const scopeField = SCOPE_TO_KEPT_USERS[name];
    // `deleteMany`, not `dropCollection` — dropping would take the indexes with
    // it, and Mongoose only rebuilds them lazily on the next write.
    const filter = scopeField ? { [scopeField]: { $nin: keptIds } } : {};
    const deleted = body.dryRun
      ? await col.countDocuments(filter)
      : (await col.deleteMany(filter)).deletedCount;

    collections.push({
      name, before, deleted, kept: before - deleted,
      disposition: scopeField ? 'scoped' : 'wiped',
    });
  }

  const uploads = body.sweepUploads
    ? await sweepUploads(body.dryRun)
    : { scanned: 0, swept: 0, bytes: 0, trashDir: null, skippedDirs: [...UPLOAD_SWEEP_SKIP_DIRS] };

  const summary = {
    dryRun: body.dryRun,
    totalDeleted: collections.reduce((s, x) => s + x.deleted, 0),
    totalKept: collections.reduce((s, x) => s + x.kept, 0),
    collections,
    uploads,
    keptUsers: keptUsers.map((u) => ({ id: String(u._id), email: u.email })),
  };

  // Written AFTER the wipe on purpose: `auditlogs` is one of the collections
  // that gets cleared, so a row written first would delete itself.
  if (!body.dryRun) {
    await AuditLog.create({
      actorId: callerDoc._id,
      action: 'data.truncate',
      entityType: 'database',
      entityId: callerDoc._id,
      newValues: {
        totalDeleted: summary.totalDeleted,
        collections: collections.filter((x) => x.deleted > 0).map((x) => `${x.name}:${x.deleted}`),
        uploadsSwept: uploads.swept,
      },
      ipAddress: c.req.header('x-forwarded-for') || undefined,
    }).catch(() => { /* the wipe already succeeded; don't fail the response */ });
  }

  return c.json({ data: summary });
}

/* ─── Seed ─────────────────────────────────────────────────────── */

export async function seedData(c: any) {
  if (!canRunDataOps(c)) return forbidden(c, 'Admin settings access required');
  if (isBusy()) {
    return c.json({ error: { code: 'JOB_RUNNING', message: 'Another data job is already running' } }, 409);
  }

  const body = seedSchema.parse(await c.req.json().catch(() => ({})));
  const { steps, unknown } = selectSteps(body.steps);
  if (unknown.length) {
    return c.json({ error: { code: 'UNKNOWN_STEP', message: `Unknown seed steps: ${unknown.join(', ')}` } }, 400);
  }
  if (!steps.length) {
    return c.json({ error: { code: 'NO_STEPS', message: 'Select at least one seed step' } }, 400);
  }

  // The hard lesson of 2026-07-23: the import step DROPS the venue directory,
  // and one unguarded click replaced every court on the live site. Destructive
  // steps on a database that already holds venues therefore demand the same
  // deliberateness as a wipe — an explicit acknowledgement, not a default.
  const destructive = steps.filter((s) => s.destructive);
  if (destructive.length && !body.acceptDestructive) {
    const venueCount = await mongoose.connection.db?.collection('venues').countDocuments() ?? 0;
    if (venueCount > 0) {
      return c.json({
        error: {
          code: 'DESTRUCTIVE_STEPS',
          message: `Steps ${destructive.map((s) => s.key).join(', ')} replace existing data (the venue directory / demo accounts). ` +
            'Re-send with acceptDestructive: true, or deselect them.',
          steps: destructive.map((s) => s.key),
        },
      }, 400);
    }
  }

  const caller = c.get('user');
  const job = createJob('seed', steps.map(({ key, label }) => ({ key, label })), {
    id: caller?.sub, email: caller?.email,
  });

  // Fire and forget — the client polls `/jobs/:id`.
  void runPipeline(job, steps);

  return c.json({ data: serializeJob(job) }, 202);
}

async function runPipeline(job: Job, steps: typeof SEED_PIPELINE): Promise<void> {
  log(job, `Seeding ${steps.length} step(s) as ${job.actor.email ?? 'admin'}`);
  try {
    for (const [i, step] of steps.entries()) {
      const jobStep = job.steps[i]!;
      const code = await runScript(job, jobStep, step.script, step.args);
      if (code !== 0) {
        // Stop on the first failure: later steps depend on earlier ones, so
        // pushing on would bury the real error under a cascade of them.
        for (const rest of job.steps.slice(i + 1)) rest.status = 'skipped';
        log(job, `\n✖ Stopped at "${step.label}". Later steps were skipped.`);
        finishJob(job, 'failed', `Step "${step.key}" exited ${code}`);
        return;
      }
    }
    log(job, '\n✅ Seed pipeline complete.');
    finishJob(job, 'done');
  } catch (err) {
    log(job, `\n✖ ${(err as Error).message}`);
    finishJob(job, 'failed', (err as Error).message);
  }
}

/* ─── Job polling ──────────────────────────────────────────────── */

export async function getDataJob(c: any) {
  if (!canRunDataOps(c)) return forbidden(c, 'Admin settings access required');

  const job = findJob(c.req.param('id'));
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, 404);

  // The client sends back how many log lines it already has, so a long-running
  // seed streams deltas instead of resending the whole buffer every 1.5s.
  const from = Math.max(0, Number(c.req.query('logFrom') ?? 0) || 0);
  return c.json({ data: serializeJob(job, Math.min(from, job.log.length)) });
}
