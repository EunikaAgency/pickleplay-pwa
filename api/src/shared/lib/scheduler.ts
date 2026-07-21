// Minimal in-process job scheduling.
//
// There is no job-runner dependency in this project (no node-cron / agenda /
// bull), and nothing here adds one. This is the smallest thing that reliably
// re-runs a function, extracted from the ad-hoc `setTimeout`/`setInterval` in
// `index.ts` so the same four mistakes aren't repeated per job:
//
//   1. it runs once at boot rather than sleeping until the first tick (the
//      pricing job waits until 3am, so a 2am restart means no run for 25 hours);
//   2. the body is wrapped, so one throw can't kill the interval for the
//      process's remaining lifetime;
//   3. the timer is `unref`'d, so tests and one-off scripts can still exit;
//   4. every run logs a line, so a job that silently stopped working is visible.
//
// Deliberately in-process: with more than one API instance, every instance runs
// every job. Callers must therefore be idempotent and safe to run concurrently.
// The booking sweeper achieves that with a status-guarded `findOneAndUpdate`
// per row rather than a lock — see `bookings.controller.ts`.

type JobResult = string | void;

export function everyMinutes(name: string, fn: () => Promise<JobResult>, minutes: number): void {
  const run = async () => {
    const started = Date.now();
    try {
      const summary = await fn();
      // Only log when the job did something, so a 2-minute heartbeat doesn't
      // bury real output. Failures always log.
      if (summary) console.log(`[${name}] ${summary} (${Date.now() - started}ms)`);
    } catch (err) {
      console.warn(`[${name}] run failed:`, (err as Error).message);
    }
  };

  void run();
  const timer = setInterval(() => { void run(); }, minutes * 60_000);
  timer.unref();
  console.log(`[${name}] Scheduled every ${minutes} min.`);
}
