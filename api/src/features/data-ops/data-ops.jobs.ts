// Pickleballers API — Background job runner for the admin Data tools.
//
// A full seed takes minutes and spans a dozen child processes, so the HTTP call
// can't wait for it: `start()` returns immediately with a job id and the client
// polls. State is module-level because PM2 runs this API as a single fork
// instance (`ecosystem.config.json` → `exec_mode: "fork"`, `instances: 1`) —
// there is no second process to share it with. A restart loses in-flight job
// state, which is fine: the work itself is idempotent and the console falls
// back to reading live collection counts.

import { spawn } from 'node:child_process';
import path from 'node:path';

export const API_ROOT = path.resolve(import.meta.dirname, '../../../');
const TSX_BIN = path.join(API_ROOT, 'node_modules/.bin/tsx');

/** Bounded so a chatty seed can't grow the log without limit. */
const MAX_LOG_LINES = 2000;
/** Finished jobs kept for polling after they end. */
const HISTORY_LIMIT = 5;

export type JobStatus = 'running' | 'done' | 'failed';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface JobStep {
  key: string;
  label: string;
  status: StepStatus;
  exitCode?: number;
  durationMs?: number;
  error?: string;
}

export interface Job {
  id: string;
  kind: 'seed' | 'truncate';
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  steps: JobStep[];
  log: string[];
  /** Set on the terminal failure that ended the job. */
  error?: string;
  /** Free-form result payload (truncate counts, sweep totals, …). */
  result?: unknown;
  actor: { id?: string; email?: string };
}

let current: Job | null = null;
const history: Job[] = [];
let seq = 0;

export function currentJob(): Job | null {
  return current;
}

export function findJob(id: string): Job | null {
  if (current?.id === id) return current;
  return history.find((j) => j.id === id) ?? null;
}

/** A job is running — callers must refuse to start a second one. */
export function isBusy(): boolean {
  return current?.status === 'running';
}

export function createJob(
  kind: Job['kind'],
  steps: Array<{ key: string; label: string }>,
  actor: Job['actor'],
): Job {
  const job: Job = {
    id: `${kind}-${Date.now().toString(36)}-${(seq++).toString(36)}`,
    kind,
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: steps.map((s) => ({ ...s, status: 'pending' })),
    log: [],
    actor,
  };
  current = job;
  return job;
}

export function log(job: Job, line: string): void {
  for (const part of line.split('\n')) {
    if (!part.trim()) continue;
    job.log.push(part.trimEnd());
  }
  if (job.log.length > MAX_LOG_LINES) {
    job.log.splice(0, job.log.length - MAX_LOG_LINES);
  }
}

export function finishJob(job: Job, status: JobStatus, error?: string): void {
  job.status = status;
  job.finishedAt = new Date().toISOString();
  if (error) job.error = error;
  history.unshift(job);
  history.splice(HISTORY_LIMIT);
  if (current?.id === job.id) current = null;
}

/**
 * Run one pipeline script to completion, streaming its output into the job log.
 * Resolves with the exit code; never rejects on a non-zero exit — the caller
 * decides whether to stop the pipeline.
 */
export function runScript(
  job: Job,
  step: JobStep,
  script: string,
  args: string[] = [],
): Promise<number> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    step.status = 'running';
    log(job, `\n──── ${step.label} ────`);
    log(job, `$ tsx ${script}${args.length ? ' ' + args.join(' ') : ''}`);

    const child = spawn(TSX_BIN, [script, ...args], {
      cwd: API_ROOT,
      env: { ...process.env, TZ: 'Asia/Manila' },
    });

    child.stdout.on('data', (b: Buffer) => log(job, b.toString()));
    child.stderr.on('data', (b: Buffer) => log(job, b.toString()));

    child.on('error', (err) => {
      step.status = 'failed';
      step.error = err.message;
      step.durationMs = Date.now() - startedAt;
      log(job, `✖ could not start: ${err.message}`);
      resolve(-1);
    });

    child.on('close', (code) => {
      // The 'error' handler already settled this promise; don't double-resolve.
      if (step.status !== 'running') return;
      step.exitCode = code ?? -1;
      step.durationMs = Date.now() - startedAt;
      step.status = code === 0 ? 'done' : 'failed';
      log(job, code === 0 ? `✔ done in ${Math.round(step.durationMs / 1000)}s` : `✖ exited ${code}`);
      resolve(code ?? -1);
    });
  });
}

/** A compact view for the polling endpoint. */
export function serializeJob(job: Job, logFrom = 0) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    steps: job.steps,
    error: job.error,
    result: job.result,
    actor: job.actor,
    logFrom,
    logTotal: job.log.length,
    log: job.log.slice(logFrom),
  };
}
