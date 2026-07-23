// Pickleballers API — Run the full seed pipeline from the terminal.
//
// The CLI half of the admin console's "Run full seed". Both walk the SAME
// manifest (`pipeline.ts`), so the two can't drift.
//
// Usage: npm run db:seed:all
//        npm run db:seed:all -- --only=import,users     # a subset, in pipeline order
//        npm run db:seed:all -- --list                  # print the steps and exit
//        npm run db:seed:all -- --continue-on-error     # don't stop at the first failure
//
// Point it at a scratch database to rehearse without touching live data:
//   MONGODB_URI=mongodb://localhost:27017/pickleballers_seedtest npm run db:seed:all

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { SEED_PIPELINE, selectSteps } from './pipeline.js';

const API_ROOT = path.resolve(import.meta.dirname, '../../../');
const TSX_BIN = path.join(API_ROOT, 'node_modules/.bin/tsx');

const argv = process.argv.slice(2);
const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
const keepGoing = argv.includes('--continue-on-error');

if (argv.includes('--list')) {
  console.log('Seed pipeline (in order):\n');
  for (const [i, s] of SEED_PIPELINE.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${s.key.padEnd(18)} ${s.label}${s.network ? '  [network]' : ''}`);
    console.log(`      ${s.why}\n`);
  }
  process.exit(0);
}

const { steps, unknown } = selectSteps(only?.split(',').map((s) => s.trim()).filter(Boolean));
if (unknown.length) {
  console.error(`❌ Unknown step(s): ${unknown.join(', ')}`);
  console.error(`   Known: ${SEED_PIPELINE.map((s) => s.key).join(', ')}`);
  process.exit(1);
}

console.log(`🌱 Running ${steps.length} seed step(s) against ${process.env.MONGODB_URI || 'mongodb://localhost:27017/pickleballers'}\n`);

const failed: string[] = [];
const startedAll = Date.now();

for (const [i, step] of steps.entries()) {
  console.log(`\n──── [${i + 1}/${steps.length}] ${step.label} ────`);
  const startedAt = Date.now();
  const res = spawnSync(TSX_BIN, [step.script, ...(step.args ?? [])], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, TZ: process.env.TZ || 'Asia/Manila' },
  });
  const secs = Math.round((Date.now() - startedAt) / 1000);

  if (res.status === 0) {
    console.log(`✔ ${step.key} done in ${secs}s`);
    continue;
  }

  failed.push(step.key);
  console.error(`✖ ${step.key} exited ${res.status ?? 'with a signal'} after ${secs}s`);
  if (!keepGoing) {
    // Later steps depend on earlier ones, so continuing buries the real error
    // under a cascade of downstream ones.
    console.error(`\n❌ Stopped. Remaining steps skipped: ${steps.slice(i + 1).map((s) => s.key).join(', ') || 'none'}`);
    console.error('   Re-run with --continue-on-error to push through failures.');
    process.exit(1);
  }
}

console.log(`\n${failed.length ? '⚠️' : '✅'} Pipeline finished in ${Math.round((Date.now() - startedAll) / 1000)}s`);
if (failed.length) {
  console.error(`   Failed step(s): ${failed.join(', ')}`);
  process.exit(1);
}
